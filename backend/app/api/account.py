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
from app.schemas.account import Credentials, AccountResource, AccountUpdate
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
def register(payload: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
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
    if not hmac.compare_digest(password_hash(payload.password, salt), saved) or not account:
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
