"""Email OTP authentication, stateless JWT rotation, and Redis blacklist routes."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_app_settings,
    get_current_user,
    get_db_session,
    get_mail_provider,
    get_redis,
)
from app.core.config import Settings
from app.core.security import (
    TokenPayload,
    create_jwt_token,
    decode_jwt_token,
    generate_otp_code,
    get_jwt_blacklist_key,
    hash_otp_code,
    normalize_email,
    redact_email,
    verify_otp_hash,
)
from app.infra.mail import MailProvider
from app.infra.redis_client import RedisProtocol
from app.models.entities import User
from app.schemas.api_schemas import (
    AuthTokensResponse,
    AuthUserResponse,
    LogoutRequest,
    LogoutResponse,
    RefreshTokenRequest,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

OTP_TTL_SECONDS = 600
OTP_COOLDOWN_SECONDS = 60
OTP_HOURLY_WINDOW_SECONDS = 3600
OTP_HOURLY_MAX_SENDS = 10
OTP_IP_HOURLY_MAX_SENDS = 20
OTP_MAX_VERIFY_ATTEMPTS = 5


async def _blacklist_jti(
    redis: RedisProtocol,
    jti: str,
    exp: int,
    fallback_seconds: int,
) -> None:
    now_ts = int(datetime.now(UTC).timestamp())
    ttl = max(exp - now_ts, 1) if exp else fallback_seconds
    await redis.set(get_jwt_blacklist_key(jti), "1", ex=ttl)


def _issue_token_pair(user: User, settings: Settings) -> AuthTokensResponse:
    access_token, _, access_ttl = create_jwt_token(
        user_id=user.id,
        email=user.email,
        token_type="access",
        secret=settings.jwt_access_secret,
        expires_delta=timedelta(minutes=settings.jwt_access_expires_minutes),
    )
    refresh_token, _, _ = create_jwt_token(
        user_id=user.id,
        email=user.email,
        token_type="refresh",
        secret=settings.jwt_refresh_secret,
        expires_delta=timedelta(days=settings.jwt_refresh_expires_days),
    )
    return AuthTokensResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in_seconds=access_ttl,
        user=AuthUserResponse(id=user.id, email=user.email),
    )


@router.post(
    "/otp/send",
    response_model=SendOtpResponse,
    summary="发送邮箱登录验证码（网易 163 邮箱 SMTP）",
)
async def send_otp(
    body: SendOtpRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_app_settings)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
    mail: Annotated[MailProvider, Depends(get_mail_provider)],
) -> SendOtpResponse:
    """Sends a 6-digit OTP code with per-email and per-IP Redis rate limits."""
    email = normalize_email(str(body.email))
    cooldown_key = f"cvory:otp:cooldown:{email}"
    hourly_key = f"cvory:otp:hourly:{email}"

    if await redis.exists(cooldown_key) == 1:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="发送过于频繁，请稍后再试",
        )

    forwarded = request.headers.get("x-forwarded-for")
    client_ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "")
    )
    if client_ip:
        ip_key = f"cvory:otp:ip:{client_ip}"
        ip_count = await redis.incr(ip_key)
        if ip_count == 1:
            await redis.expire(ip_key, OTP_HOURLY_WINDOW_SECONDS)
        if ip_count > OTP_IP_HOURLY_MAX_SENDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="当前网络请求次数已达上限，请一小时后再试",
            )

    hourly_count = await redis.incr(hourly_key)
    if hourly_count == 1:
        await redis.expire(hourly_key, OTP_HOURLY_WINDOW_SECONDS)
    if hourly_count > OTP_HOURLY_MAX_SENDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="当前邮箱请求次数已达上限，请一小时后再试",
        )

    code = generate_otp_code()
    code_hash = hash_otp_code(email, code, settings.jwt_access_secret)

    code_key = f"cvory:otp:code:{email}"
    attempts_key = f"cvory:otp:attempts:{email}"

    await redis.set(code_key, code_hash, ex=OTP_TTL_SECONDS)
    await redis.delete(attempts_key)
    await redis.set(cooldown_key, "1", ex=OTP_COOLDOWN_SECONDS)

    await mail.send_otp_code(
        to_email=email,
        code=code,
        expires_in_minutes=OTP_TTL_SECONDS // 60,
    )

    return SendOtpResponse(
        sent=True,
        expires_in_seconds=OTP_TTL_SECONDS,
        retry_after_seconds=OTP_COOLDOWN_SECONDS,
    )


@router.post(
    "/otp/verify",
    response_model=AuthTokensResponse,
    summary="校验邮箱验证码并签发无状态 JWT Access/Refresh Token",
)
async def verify_otp(
    body: VerifyOtpRequest,
    settings: Annotated[Settings, Depends(get_app_settings)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthTokensResponse:
    """Verifies a single-use OTP code and returns stateless JWT tokens."""
    email = normalize_email(str(body.email))
    code_key = f"cvory:otp:code:{email}"
    attempts_key = f"cvory:otp:attempts:{email}"

    stored_hash = await redis.get(code_key)
    if not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期或不存在，请重新获取",
        )

    candidate_hash = hash_otp_code(email, body.code, settings.jwt_access_secret)
    if not verify_otp_hash(stored_hash, candidate_hash):
        attempts = await redis.incr(attempts_key)
        if attempts == 1:
            await redis.expire(attempts_key, OTP_TTL_SECONDS)
        if attempts >= OTP_MAX_VERIFY_ATTEMPTS:
            await redis.delete(code_key, attempts_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码错误次数过多，请重新获取",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码不正确，请重新输入",
        )

    await redis.delete(code_key, attempts_key)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if user is None:
        user = User(email=email, last_login_at=now)
        db.add(user)
    else:
        user.last_login_at = now
    await db.commit()
    await db.refresh(user)

    logger.info("User authenticated: %s", redact_email(email))
    return _issue_token_pair(user, settings)


@router.post(
    "/refresh",
    response_model=AuthTokensResponse,
    summary="使用 Refresh Token 轮换新令牌对",
)
async def refresh_tokens(
    body: RefreshTokenRequest,
    settings: Annotated[Settings, Depends(get_app_settings)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthTokensResponse:
    """Rotates refresh token and revokes the previous refresh JTI in Redis."""
    try:
        payload = decode_jwt_token(
            body.refresh_token,
            secret=settings.jwt_refresh_secret,
            expected_type="refresh",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的刷新令牌",
        ) from exc

    if await redis.exists(get_jwt_blacklist_key(payload.jti)) == 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新令牌已失效，请重新验证邮箱",
        )

    user = await db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    await _blacklist_jti(
        redis,
        payload.jti,
        payload.exp,
        settings.jwt_refresh_expires_days * 86400,
    )
    return _issue_token_pair(user, settings)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="退出登录并拉黑当前 JWT",
)
async def logout(
    body: LogoutRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
) -> LogoutResponse:
    """Revokes current access token and optional refresh token in Redis."""
    await _blacklist_jti(
        redis,
        current_user.jti,
        current_user.exp,
        settings.jwt_access_expires_minutes * 60,
    )
    if body.refresh_token:
        try:
            refresh_payload = decode_jwt_token(
                body.refresh_token,
                secret=settings.jwt_refresh_secret,
                expected_type="refresh",
            )
            await _blacklist_jti(
                redis,
                refresh_payload.jti,
                refresh_payload.exp,
                settings.jwt_refresh_expires_days * 86400,
            )
        except jwt.PyJWTError:
            pass
    logger.info("User logged out: %s", redact_email(current_user.email))
    return LogoutResponse(logged_out=True)


@router.get("/me", response_model=AuthUserResponse, summary="获取当前登录用户信息")
async def get_me(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> AuthUserResponse:
    """Returns the authenticated user's profile."""
    return AuthUserResponse(id=current_user.user_id, email=current_user.email)
