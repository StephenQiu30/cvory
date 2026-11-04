"""Database-backed, HttpOnly account sessions with write-origin protection."""
import hashlib
from datetime import datetime, timezone
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.errors import UnauthenticatedError, PermissionDeniedError
from app.core.config import settings
from app.models.account import SessionModel, AccountModel


def session_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_origin(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origin = request.headers.get("origin")
    # SameSite cookies alone are insufficient for same-site cross-origin requests.
    if origin and origin.rstrip("/") not in settings.cors_origins:
        raise PermissionDeniedError("Untrusted request origin.")
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise PermissionDeniedError("Cross-site write rejected.")


def get_current_owner(request: Request, db: Session = Depends(get_db)) -> str:
    verify_origin(request)
    token = request.cookies.get("cvory_session", "")
    session = db.get(SessionModel, session_hash(token)) if token else None
    if not session or session.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise UnauthenticatedError()
    account = db.get(AccountModel, session.owner_id)
    if not account or account.status != "active":
        raise UnauthenticatedError()
    return session.owner_id
