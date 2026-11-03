"""Persistent per-address/account attempt limits for password endpoints."""
import hashlib
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import Base
from app.core.errors import AppError


class AuthAttemptModel(Base):
    __tablename__ = "auth_attempts"
    key = Column(String(64), primary_key=True)
    count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=False)


def check_attempt(db: Session, address: str, email: str) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.query(AuthAttemptModel).filter(AuthAttemptModel.expires_at < now).delete()
    key = hashlib.sha256(f"{address}:{email}".encode()).hexdigest()
    attempt = db.get(AuthAttemptModel, key)
    if not attempt:
        db.add(AuthAttemptModel(key=key, count=0, expires_at=now + timedelta(minutes=15)))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    changed = db.query(AuthAttemptModel).filter(AuthAttemptModel.key == key, AuthAttemptModel.count < 20).update({AuthAttemptModel.count: AuthAttemptModel.count + 1}, synchronize_session=False)
    db.commit()
    if changed != 1:
        raise AppError(429, "Too many attempts. Retry later.", "RESOURCE_EXHAUSTED")
