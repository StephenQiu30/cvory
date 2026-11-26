"""FastAPI dependency providers for database, Redis, external services, and JWT auth."""

from collections.abc import AsyncIterator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import TokenPayload, decode_jwt_token, get_jwt_blacklist_key
from app.infra.database import DatabaseManager
from app.infra.mail import MailProvider
from app.infra.pdf_renderer import PdfRenderer
from app.infra.redis_client import RedisProtocol
from app.infra.storage import AvatarStorageProvider

bearer_scheme = HTTPBearer(auto_error=False)


def get_app_settings(request: Request) -> Settings:
    """Returns application settings stored on app.state."""
    return request.app.state.settings


def get_db_manager(request: Request) -> DatabaseManager:
    """Returns the DatabaseManager stored on app.state."""
    return request.app.state.db


async def get_db_session(
    db: Annotated[DatabaseManager, Depends(get_db_manager)],
) -> AsyncIterator[AsyncSession]:
    """Yields an async SQLAlchemy session."""
    async for session in db.session():
        yield session


def get_redis(request: Request) -> RedisProtocol:
    """Returns the async Redis client stored on app.state."""
    return request.app.state.redis


def get_mail_provider(request: Request) -> MailProvider:
    """Returns the SMTP mail provider stored on app.state."""
    return request.app.state.mail


def get_avatar_storage(request: Request) -> AvatarStorageProvider:
    """Returns the S3 avatar storage provider stored on app.state."""
    return request.app.state.storage


def get_pdf_renderer(request: Request) -> PdfRenderer:
    """Returns the Playwright PDF renderer stored on app.state."""
    return request.app.state.pdf_renderer


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
) -> TokenPayload:
    """Validates Bearer JWT access token and checks Redis revocation blacklist."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少访问令牌",
        )

    try:
        payload = decode_jwt_token(
            credentials.credentials,
            secret=settings.jwt_access_secret,
            expected_type="access",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="访问令牌无效或已过期",
        ) from exc

    if await redis.exists(get_jwt_blacklist_key(payload.jti)) == 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="访问令牌已失效，请重新登录",
        )

    return payload
