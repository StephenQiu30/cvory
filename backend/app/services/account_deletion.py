"""Deferred deletion with an independently persisted HMAC tombstone."""
import hashlib
import hmac
import logging
import os
import uuid
from datetime import timedelta

from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.account import (AccountModel, AccountActionTokenModel, AccountDeletionJobModel,
    MailJobModel, PublicationModel, PublicationReviewModel, PresetModel, SessionModel)
from app.models.cv import CVModel
from app.services.account_mail import now_utc


def _ledger_marker() -> bytes:
    if not settings.deletion_tombstone_key:
        raise ValueError('Deletion tombstone key is not configured')
    return hmac.new(settings.deletion_tombstone_key.encode(), b'cvory-ledger-v1', hashlib.sha256).hexdigest().encode()


def initialize_ledger():
    """Initialize only an empty, explicitly selected independent directory."""
    marker = _ledger_marker()
    directory = settings.deletion_tombstone_dir
    if not directory:
        raise ValueError('Deletion tombstone directory is not configured')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any(directory.iterdir()):
        raise ValueError('Deletion tombstone directory must be empty')
    path = directory / '.cvory-ledger-v1'
    with open(path, 'xb') as handle:
        os.chmod(path, 0o600)
        handle.write(marker)
        handle.flush()
        os.fsync(handle.fileno())
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def validate_ledger():
    directory = settings.deletion_tombstone_dir
    if not directory or not directory.is_dir() or directory.is_symlink():
        raise ValueError('Deletion ledger is unavailable')
    marker = directory / '.cvory-ledger-v1'
    if marker.is_symlink() or not marker.is_file() or not hmac.compare_digest(marker.read_bytes(), _ledger_marker()):
        raise ValueError('Deletion ledger or key does not match')


def tombstone_name(owner_id: str) -> str:
    if not settings.deletion_tombstone_key:
        raise ValueError('Deletion tombstone key is not configured')
    return hmac.new(settings.deletion_tombstone_key.encode(), owner_id.encode(), hashlib.sha256).hexdigest()


def write_tombstone(owner_id: str):
    validate_ledger()
    directory = settings.deletion_tombstone_dir
    name = tombstone_name(owner_id)
    path = directory / name
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        if path.is_symlink() or not path.is_file() or path.read_bytes() != b'cvory-deletion-v1\n':
            raise ValueError('Invalid deletion tombstone')
        return
    with os.fdopen(fd, 'wb') as handle:
        handle.write(b'cvory-deletion-v1\n')
        handle.flush()
        os.fsync(handle.fileno())
    directory_fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def remove_owned_data(db: Session, owner: str):
    cv_ids = [row[0] for row in db.query(CVModel.id).filter_by(owner_id=owner).all()]
    avatar_dir = settings.data_dir / 'avatars'
    for cv_id in cv_ids:
        uuid.UUID(cv_id)
        for path in avatar_dir.glob(cv_id + '.*'):
            path.unlink(missing_ok=True)
    for model in (PublicationModel, PublicationReviewModel, PresetModel, CVModel,
                  SessionModel, AccountActionTokenModel, MailJobModel):
        db.query(model).filter_by(owner_id=owner).delete(synchronize_session=False)
    db.query(AccountModel).filter_by(id=owner).delete(synchronize_session=False)


def reconcile_restored_accounts(db: Session):
    """Replay tombstones before exposing a restored database to traffic."""
    validate_ledger()
    directory = settings.deletion_tombstone_dir
    owners = [row[0] for row in db.query(AccountModel.id).all()]
    count = 0
    for owner in owners:
        path = directory / tombstone_name(owner)
        if path.exists() or path.is_symlink():
            if path.is_symlink() or not path.is_file() or path.read_bytes() != b'cvory-deletion-v1\n':
                raise ValueError('Invalid deletion tombstone')
            remove_owned_data(db, owner)
            db.query(AccountDeletionJobModel).filter_by(owner_id=owner).delete(synchronize_session=False)
            db.commit()
            count += 1
    return count


def process_deletion_jobs(db: Session):
    """Claim one due account, then fail closed until tombstone and data removal succeed."""
    from sqlalchemy import or_
    now = now_utc()
    validate_ledger()
    job = db.query(AccountDeletionJobModel).filter(
        AccountDeletionJobModel.next_attempt_at <= now,
        or_(AccountDeletionJobModel.status == 'queued',
            (AccountDeletionJobModel.status == 'processing') & (AccountDeletionJobModel.lease_until < now)),
    ).order_by(AccountDeletionJobModel.next_attempt_at).first()
    if not job:
        return 0
    owner = job.owner_id
    account = db.query(AccountModel).filter_by(id=owner).with_for_update().first()
    job = db.query(AccountDeletionJobModel).filter_by(owner_id=owner).with_for_update().first()
    if not account or not job or job.next_attempt_at > now or job.status not in ('queued', 'processing'):
        db.rollback()
        return 0
    if job.status == 'processing' and job.lease_until and job.lease_until >= now:
        db.rollback()
        return 0
    if account.status == 'deletion_pending' and account.purge_after and account.purge_after <= now:
        account.status = 'deleting'
    elif account.status != 'deleting':
        db.rollback()
        return 0
    job.status = 'processing'
    job.lease_until = now + timedelta(minutes=5)
    job.attempts += 1
    db.commit()
    try:
        write_tombstone(owner)
        remove_owned_data(db, owner)
        job = db.query(AccountDeletionJobModel).filter_by(owner_id=owner).one()
        job.status = 'completed'
        job.completed_at = now_utc()
        job.lease_until = None
        db.commit()
        return 1
    except Exception as exc:
        logging.getLogger(__name__).warning("Account cleanup failed (%s); retry scheduled.", type(exc).__name__)
        db.rollback()
        job = db.query(AccountDeletionJobModel).filter_by(owner_id=owner).first()
        if job:
            job.status = 'queued'
            job.lease_until = None
            job.next_attempt_at = now_utc() + timedelta(minutes=5)
            db.commit()
        return 0
