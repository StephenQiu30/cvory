"""Security and owner authentication."""

from typing import Optional
from fastapi import Header, Request
from app.core.config import settings
from app.core.errors import UnauthenticatedError


def get_current_owner(
    request: Request,
    x_owner_token: Optional[str] = Header(None, alias="X-Owner-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """Verify owner credentials.

    Args:
        request: The incoming HTTP request.
        x_owner_token: Token from X-Owner-Token header.
        authorization: Bearer token from Authorization header.

    Returns:
        The authenticated owner identifier string.

    Raises:
        UnauthenticatedError: If verification fails.
    """
    token: Optional[str] = None
    if x_owner_token:
        token = x_owner_token
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    # In dev_mode, allow requests with no token or default token
    if settings.dev_mode:
        if token is None or token == settings.owner_token:
            return "owner"
        # If token was supplied but is wrong
        raise UnauthenticatedError("Invalid authentication token.")

    # In production mode, require valid owner token
    if not token or token != settings.owner_token:
        raise UnauthenticatedError("Valid owner authentication token is required.")

    return "owner"
