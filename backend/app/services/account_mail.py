"""Encrypted, durable account-action mail queue; never log tokens or recipients."""
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, InvalidArgumentError
from app.models.account import AccountActionTokenModel, MailJobModel


def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fernet():
    try:
        return Fernet(settings.mail_encryption_key.encode())
    except (ValueError, TypeError):
        raise AppError(503, "Mail delivery is not configured.", "UNAVAILABLE") from None


def validate_mail_configuration():
    origin = urlsplit(settings.public_app_origin)
    local = origin.hostname in ("localhost", "127.0.0.1", "::1")
    if (not settings.smtp_enabled or not settings.smtp_host or not settings.smtp_from_email
            or not origin.hostname or origin.username or origin.password or origin.query or origin.fragment
            or origin.path not in ("", "/") or (origin.scheme != "https" and not (local and origin.scheme == "http"))):
        raise AppError(503, "Mail delivery is not configured.", "UNAVAILABLE")
    _fernet()


def decrypt_payload(value):
    try:
        return json.loads(_fernet().decrypt(value).decode())
    except (InvalidToken, ValueError, TypeError):
        raise AppError(503, "Mail payload cannot be processed.", "UNAVAILABLE") from None


def queue_action(db: Session, account, purpose: str):
    validate_mail_configuration()
    now = now_utc()
    duration = timedelta(hours=24) if purpose == "verify_email" else timedelta(minutes=30)
    db.query(AccountActionTokenModel).filter_by(owner_id=account.id, purpose=purpose, consumed_at=None).update({AccountActionTokenModel.consumed_at: now}, synchronize_session=False)
    raw = secrets.token_urlsafe(32)
    token = AccountActionTokenModel(id=str(uuid.uuid4()), owner_id=account.id, purpose=purpose,
        target_email=account.email, token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        created_at=now, expires_at=now + duration)
    payload = json.dumps({"recipient": account.email, "purpose": purpose, "token": raw}, ensure_ascii=False).encode()
    job = MailJobModel(id=str(uuid.uuid4()), owner_id=account.id, action_token_id=token.id,
        status="queued", attempts=0, encrypted_payload=_fernet().encrypt(payload), created_at=now,
        expires_at=token.expires_at, next_attempt_at=now)
    db.add_all([token, job])
    db.commit()


def consume_action(db: Session, raw: str, purpose: str, owner_id=None):
    from app.models.account import AccountModel
    if len(raw) > 256:
        raise InvalidArgumentError("Action link is invalid or expired.")
    digest = hashlib.sha256(raw.encode()).hexdigest()
    token = db.query(AccountActionTokenModel).filter_by(token_hash=digest, purpose=purpose).first()
    now = now_utc()
    if not token or (owner_id and token.owner_id != owner_id):
        raise InvalidArgumentError("Action link is invalid or expired.")
    # Match the account-then-token lock order used by queueing and deletion.
    if not db.query(AccountModel).filter_by(id=token.owner_id).with_for_update().first():
        raise InvalidArgumentError("Action link is invalid or expired.")
    changed = db.query(AccountActionTokenModel).filter(
        AccountActionTokenModel.id == token.id, AccountActionTokenModel.consumed_at.is_(None),
        AccountActionTokenModel.expires_at > now,
    ).update({AccountActionTokenModel.consumed_at: now}, synchronize_session=False)
    if changed != 1:
        raise InvalidArgumentError("Action link is invalid or expired.")
    return token


def send_smtp(payload):
    """Send one known template using encrypted SMTP, without logging transport details."""
    import smtplib
    import ssl
    from email.message import EmailMessage
    from email.utils import formataddr
    from urllib.parse import quote

    validate_mail_configuration()
    purpose = payload['purpose']
    if purpose not in ('verify_email', 'reset_password'):
        raise ValueError('Unsupported mail template')
    route = '/verify-email' if purpose == 'verify_email' else '/reset-password'
    title = '验证邮箱' if purpose == 'verify_email' else '重置密码'
    duration = '24 小时' if purpose == 'verify_email' else '30 分钟'
    url = settings.public_app_origin.rstrip('/') + route + '#token=' + quote(payload['token'], safe='')
    message = EmailMessage()
    message['From'] = formataddr((settings.smtp_from_name, settings.smtp_from_email))
    message['To'] = payload['recipient']
    message['Subject'] = '简序 · ' + title
    message.set_content(f'请打开以下链接{title}，链接 {duration}内有效：\n\n{url}\n\n如非本人操作，请忽略。')
    context = ssl.create_default_context()
    if settings.smtp_tls_mode == 'tls':
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15, context=context) as smtp:
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    elif settings.smtp_tls_mode == 'starttls':
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    else:
        raise ValueError('Encrypted SMTP is required')


def process_mail_jobs(db: Session):
    """Lease one message; failed delivery remains encrypted and is retried."""
    from sqlalchemy import or_, and_
    now = now_utc()
    job = db.query(MailJobModel).filter(
        MailJobModel.expires_at > now,
        or_(and_(MailJobModel.status == 'queued', MailJobModel.next_attempt_at <= now),
            and_(MailJobModel.status == 'sending', MailJobModel.lease_until < now)),
    ).order_by(MailJobModel.created_at).with_for_update(skip_locked=True).first()
    if not job:
        db.query(MailJobModel).filter(MailJobModel.expires_at <= now, MailJobModel.encrypted_payload.is_not(None)).update(
            {MailJobModel.encrypted_payload: None, MailJobModel.status: 'expired'}, synchronize_session=False)
        db.commit()
        return 0
    token = db.get(AccountActionTokenModel, job.action_token_id)
    if not token or token.consumed_at or token.expires_at <= now:
        job.encrypted_payload = None
        job.status = 'cancelled'
        db.commit()
        return 0
    job.status = 'sending'
    job.attempts += 1
    job.lease_until = now + timedelta(minutes=2)
    job_id = job.id
    encrypted = job.encrypted_payload
    db.commit()
    try:
        send_smtp(decrypt_payload(encrypted))
        sent = True
    except Exception:
        # SMTP exceptions can include credentials, recipient or message body.
        sent = False
    job = db.query(MailJobModel).filter_by(id=job_id, status='sending').with_for_update().first()
    if job:
        if sent:
            job.status = 'sent'
            job.encrypted_payload = None
        elif job.attempts >= 5:
            job.status = 'failed'
            job.encrypted_payload = None
        else:
            job.status = 'queued'
            job.next_attempt_at = now_utc() + timedelta(seconds=min(900, 30 * 2 ** (job.attempts - 1)))
        job.lease_until = None
        db.commit()
    return int(sent)


def mail_request_allowed(db: Session, address: str, email: str, purpose: str):
    """Apply shared fixed-window limits without storing email addresses or IPs."""
    import hmac
    from sqlalchemy.exc import IntegrityError
    from app.models.account import MailRateLimitModel

    if not settings.mail_rate_limit_key:
        raise AppError(503, "Mail delivery is not configured.", "UNAVAILABLE")
    now = now_utc()
    seconds = int(now.replace(tzinfo=timezone.utc).timestamp())
    scopes = [
        ('ip', address, 3600, 20), ('global', 'all', 3600, 100),
        ('email-minute', purpose + ':' + email, 60, 1),
        ('email-hour', purpose + ':' + email, 3600, 5),
        ('email-day', purpose + ':' + email, 86400, 10),
    ]
    allowed = True
    for dimension, subject, window, limit in scopes:
        if dimension == 'email-minute':
            material = f'{dimension}:{subject}'.encode()
            key = hmac.new(settings.mail_rate_limit_key.encode(), material, hashlib.sha256).hexdigest()
            changed = db.query(MailRateLimitModel).filter(
                MailRateLimitModel.key == key, MailRateLimitModel.expires_at <= now
            ).update({MailRateLimitModel.count: 1,
                      MailRateLimitModel.expires_at: now + timedelta(seconds=60)}, synchronize_session=False)
            if not changed and not db.get(MailRateLimitModel, key):
                db.add(MailRateLimitModel(key=key, count=1, expires_at=now + timedelta(seconds=60)))
                try:
                    db.commit()
                    continue
                except IntegrityError:
                    db.rollback()
            else:
                db.commit()
            if not changed:
                allowed = False
            continue
        bucket = seconds // window
        material = f'{dimension}:{subject}:{bucket}'.encode()
        key = hmac.new(settings.mail_rate_limit_key.encode(), material, hashlib.sha256).hexdigest()
        row = db.get(MailRateLimitModel, key)
        if not row:
            db.add(MailRateLimitModel(key=key, count=0, expires_at=datetime.fromtimestamp((bucket + 1) * window, timezone.utc).replace(tzinfo=None)))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
        changed = db.query(MailRateLimitModel).filter(MailRateLimitModel.key == key, MailRateLimitModel.count < limit).update(
            {MailRateLimitModel.count: MailRateLimitModel.count + 1}, synchronize_session=False)
        db.commit()
        if not changed:
            if dimension in ('ip', 'global'):
                raise AppError(429, 'Too many requests. Retry later.', 'RESOURCE_EXHAUSTED')
            allowed = False
    db.query(MailRateLimitModel).filter(MailRateLimitModel.expires_at < now).delete()
    db.commit()
    return allowed
