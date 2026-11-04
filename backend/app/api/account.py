"""Email/password accounts and per-account sessions; no unverified email claims."""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.errors import AppError, UnauthenticatedError
from app.core.security import get_current_owner, session_hash, verify_origin
from app.models.account import AccountModel, SessionModel
from app.schemas.account import Credentials, RegistrationCredentials, AccountResource, AccountUpdate, TokenRequest, EmailRequest, ResetPasswordRequest, CurrentPasswordRequest, ChangePasswordRequest
from app.services.image_service import normalize_image
from app.services.auth_limits import check_attempt

router = APIRouter(prefix="/account", tags=["account"])


def password_hash(password: str, salt: str) -> str:
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


def establish_session(db: Session, account: AccountModel, response: Response, request: Request):
    token = secrets.token_urlsafe(48)
    db.add(SessionModel(token_hash=session_hash(token), owner_id=account.id, expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)))
    db.commit()
    response.set_cookie("cvory_session", token, httponly=True, secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https", samesite="lax", max_age=604800)
    response.headers["Cache-Control"] = "no-store"
    return AccountResource.model_validate(account)


@router.post(":register", response_model=AccountResource, operation_id="registerAccount", status_code=201)
def register(payload: RegistrationCredentials, request: Request, response: Response, db: Session = Depends(get_db)):
    verify_origin(request)
    check_attempt(db, request.client.host if request.client else "local", payload.email)
    salt = secrets.token_hex(16)
    account = AccountModel(id=str(uuid.uuid4()), public_id=secrets.token_urlsafe(12), email=payload.email, display_name=payload.display_name.strip() or payload.email.split("@")[0], password_hash=salt + ":" + password_hash(payload.password, salt))
    db.add(account)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "Account cannot be registered.", "ALREADY_EXISTS", [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "ACCOUNT_EXISTS"}]) from exc
    return establish_session(db, account, response, request)


@router.post(":login", response_model=AccountResource, operation_id="loginAccount")
def login(payload: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    verify_origin(request)
    check_attempt(db, request.client.host if request.client else "local", payload.email)
    account = db.query(AccountModel).filter(AccountModel.email == payload.email).first()
    salt, saved = account.password_hash.split(":") if account else ("0" * 32, "0" * 128)
    if not hmac.compare_digest(password_hash(payload.password, salt), saved) or not account or account.status != "active":
        raise UnauthenticatedError("Email or password is incorrect.")
    return establish_session(db, account, response, request)


@router.get("", response_model=AccountResource, operation_id="getAccount")
def get_account(db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    return AccountResource.model_validate(db.get(AccountModel, owner))


@router.patch("", response_model=AccountResource, operation_id="updateAccount")
def update_account(payload: AccountUpdate, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    account = db.get(AccountModel, owner)
    account.display_name = payload.display_name
    account.avatar = normalize_image(payload.avatar)
    db.commit()
    return AccountResource.model_validate(account)


@router.post(":logout", status_code=204, operation_id="logoutAccount")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    verify_origin(request)
    token = request.cookies.get("cvory_session", "")
    db.query(SessionModel).filter(SessionModel.token_hash == session_hash(token)).delete()
    db.commit()
    response.delete_cookie("cvory_session")


@router.post(":requestEmailVerification", status_code=202, operation_id="requestEmailVerification")
def request_email_verification(request: Request, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    from app.services.account_mail import queue_action, mail_request_allowed, validate_mail_configuration
    validate_mail_configuration()
    account = db.query(AccountModel).filter_by(id=owner).one()
    allowed = mail_request_allowed(db, request.client.host if request.client else "local", account.email, "verify_email")
    account = db.query(AccountModel).filter_by(id=owner).with_for_update().one()
    if allowed and not account.email_verified_at:
        queue_action(db, account, "verify_email")
    return {"message": "If eligible, instructions will be sent."}


@router.post(":verifyEmail", response_model=AccountResource, operation_id="verifyEmail")
def verify_email(payload: TokenRequest, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    from app.services.account_mail import consume_action, now_utc
    from app.core.errors import InvalidArgumentError
    token = consume_action(db, payload.token, "verify_email", owner)
    account = db.query(AccountModel).filter_by(id=owner).with_for_update().one()
    if account.email != token.target_email or account.status != "active":
        db.rollback()
        raise InvalidArgumentError("Action link is invalid or expired.")
    account.email_verified_at = now_utc()
    db.commit()
    return AccountResource.model_validate(account)


@router.post(":requestPasswordReset", status_code=202, operation_id="requestPasswordReset")
def request_password_reset(payload: EmailRequest, request: Request, db: Session = Depends(get_db)):
    from app.services.account_mail import queue_action, validate_mail_configuration, mail_request_allowed
    verify_origin(request)
    validate_mail_configuration()
    allowed = mail_request_allowed(db, request.client.host if request.client else "local", payload.email, "reset_password")
    account = db.query(AccountModel).filter_by(email=payload.email, status="active").with_for_update().first()
    if allowed and account and account.email_verified_at:
        queue_action(db, account, "reset_password")
    return {"message": "If eligible, instructions will be sent."}


@router.post(":resetPassword", status_code=204, operation_id="resetPassword")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    from app.services.account_mail import consume_action, now_utc
    from app.models.account import AccountActionTokenModel
    from app.core.errors import InvalidArgumentError
    verify_origin(request)
    token = consume_action(db, payload.token, "reset_password")
    account = db.query(AccountModel).filter_by(id=token.owner_id).with_for_update().first()
    if not account or account.status != "active" or not account.email_verified_at or account.email != token.target_email:
        db.rollback()
        raise InvalidArgumentError("Action link is invalid or expired.")
    salt = secrets.token_hex(16)
    account.password_hash = salt + ":" + password_hash(payload.password, salt)
    db.query(SessionModel).filter_by(owner_id=account.id).delete()
    db.query(AccountActionTokenModel).filter_by(owner_id=account.id, purpose="reset_password", consumed_at=None).update({AccountActionTokenModel.consumed_at: now_utc()}, synchronize_session=False)
    db.commit()


@router.post(":requestDeletion", status_code=204, operation_id="requestAccountDeletion")
def request_deletion(payload: CurrentPasswordRequest, request: Request, response: Response, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    from app.models.account import AccountActionTokenModel, AccountDeletionJobModel, MailJobModel
    from app.core.config import settings
    from app.services.account_deletion import validate_ledger
    if not settings.deletion_enabled or not settings.deletion_tombstone_dir or not settings.deletion_tombstone_key:
        raise AppError(503, "Account deletion is not configured.", "UNAVAILABLE")
    try:
        validate_ledger()
    except (ValueError, OSError):
        raise AppError(503, "Account deletion is unavailable.", "UNAVAILABLE") from None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    account = db.query(AccountModel).filter_by(id=owner).one()
    check_attempt(db, request.client.host if request.client else "local", account.email)
    account = db.query(AccountModel).filter_by(id=owner, status="active").with_for_update().first()
    if not account:
        raise UnauthenticatedError()
    salt, saved = account.password_hash.split(":")
    if not hmac.compare_digest(password_hash(payload.password, salt), saved):
        raise UnauthenticatedError("Credentials are incorrect.")
    account.status = "deletion_pending"
    account.delete_requested_at = now
    account.purge_after = now + timedelta(days=7)
    db.query(SessionModel).filter_by(owner_id=owner).delete()
    db.query(AccountActionTokenModel).filter_by(owner_id=owner, consumed_at=None).update({AccountActionTokenModel.consumed_at: now}, synchronize_session=False)
    db.query(MailJobModel).filter(MailJobModel.owner_id == owner, MailJobModel.status.in_(["queued", "sending"])).update({MailJobModel.status: "cancelled", MailJobModel.encrypted_payload: None}, synchronize_session=False)
    job = db.query(AccountDeletionJobModel).filter_by(owner_id=owner).first()
    if not job:
        job = AccountDeletionJobModel(id=str(uuid.uuid4()), owner_id=owner, created_at=now)
        db.add(job)
    job.status = "queued"
    job.attempts = 0
    job.next_attempt_at = account.purge_after
    job.lease_until = None
    job.completed_at = None
    db.commit()
    response.delete_cookie("cvory_session")
    response.headers["Cache-Control"] = "no-store"


@router.post(":changePassword", response_model=AccountResource, operation_id="changeAccountPassword")
def change_password(payload: ChangePasswordRequest, request: Request, response: Response, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    account = db.query(AccountModel).filter_by(id=owner).one()
    check_attempt(db, request.client.host if request.client else "local", account.email)
    account = db.query(AccountModel).filter_by(id=owner, status="active").with_for_update().first()
    if not account:
        raise UnauthenticatedError()
    salt, saved = account.password_hash.split(":")
    if not hmac.compare_digest(password_hash(payload.password, salt), saved):
        raise UnauthenticatedError("Credentials are incorrect.")
    salt = secrets.token_hex(16)
    account.password_hash = salt + ":" + password_hash(payload.new_password, salt)
    db.query(SessionModel).filter_by(owner_id=owner).delete()
    return establish_session(db, account, response, request)


@router.post(":cancelDeletion", status_code=204, operation_id="cancelAccountDeletion")
def cancel_deletion(payload: Credentials, request: Request, db: Session = Depends(get_db)):
    from app.models.account import AccountDeletionJobModel
    verify_origin(request)
    check_attempt(db, request.client.host if request.client else "local", payload.email)
    account = db.query(AccountModel).filter_by(email=payload.email).with_for_update().first()
    salt, saved = account.password_hash.split(":") if account else ("0" * 32, "0" * 128)
    valid = hmac.compare_digest(password_hash(payload.password, salt), saved)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not valid or not account or account.status != "deletion_pending" or not account.purge_after or account.purge_after <= now:
        raise UnauthenticatedError("Credentials are incorrect or the request has expired.")
    job = db.query(AccountDeletionJobModel).filter_by(owner_id=account.id).with_for_update().first()
    if not job or job.status != "queued":
        raise UnauthenticatedError("Credentials are incorrect or the request has expired.")
    account.status = "active"
    account.delete_requested_at = None
    account.purge_after = None
    job.status = "cancelled"
    db.commit()
