"""Security helpers for stateless JWT tokens, OTP hashing, and PII redaction."""

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt


@dataclass(frozen=True)
class TokenPayload:
    """Verified JWT token claims."""

    user_id: str
    email: str
    jti: str
    token_type: Literal["access", "refresh"]
    exp: int


def normalize_email(email: str) -> str:
    """Normalizes an email address to lowercase without surrounding whitespace."""
    return email.strip().lower()


def redact_email(email: str) -> str:
    """Redacts email local part so logs never expose raw PII."""
    at_idx = email.find("@")
    if at_idx <= 1:
        return "***"
    return f"{email[0]}***@{email[at_idx + 1 :]}"


def generate_otp_code() -> str:
    """Generates a cryptographically secure 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900_000) + 100_000:06d}"


def hash_otp_code(email: str, code: str, pepper: str) -> str:
    """Computes a salted SHA-256 digest for an OTP code."""
    payload = f"{normalize_email(email)}:{code.strip()}:{pepper}".encode()
    return hashlib.sha256(payload).hexdigest()


def verify_otp_hash(stored_hash: str, candidate_hash: str) -> bool:
    """Constant-time comparison for OTP digests."""
    return hmac.compare_digest(stored_hash, candidate_hash)


def get_jwt_blacklist_key(jti: str) -> str:
    """Returns the Redis key used for revoked JWT IDs."""
    return f"cvory:jwt:blacklist:{jti}"


def create_jwt_token(
    *,
    user_id: str,
    email: str,
    token_type: Literal["access", "refresh"],
    secret: str,
    expires_delta: timedelta,
) -> tuple[str, str, int]:
    """Signs a stateless JWT and returns (token, jti, expires_in_seconds)."""
    jti = str(uuid.uuid4())
    now = datetime.now(UTC)
    expires_at = now + expires_delta
    payload = {
        "sub": user_id,
        "email": email,
        "jti": jti,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    encoded = jwt.encode(payload, secret, algorithm="HS256")
    return encoded, jti, int(expires_delta.total_seconds())


def decode_jwt_token(
    token: str,
    *,
    secret: str,
    expected_type: Literal["access", "refresh"],
) -> TokenPayload:
    """Verifies a JWT signature and token type, raising jwt.PyJWTError on failure."""
    raw = jwt.decode(token, secret, algorithms=["HS256"])
    token_type = raw.get("type")
    sub = raw.get("sub")
    email = raw.get("email")
    jti = raw.get("jti")
    exp = raw.get("exp")

    if (
        token_type != expected_type
        or not isinstance(sub, str)
        or not isinstance(email, str)
        or not isinstance(jti, str)
        or not isinstance(exp, int)
    ):
        raise jwt.InvalidTokenError("Malformed token payload")

    return TokenPayload(
        user_id=sub,
        email=email,
        jti=jti,
        token_type=expected_type,
        exp=exp,
    )
