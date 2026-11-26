"""Liveness and infrastructure readiness endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_redis
from app.core.contract import CVORY_CONTRACT_VERSION
from app.infra.redis_client import RedisProtocol
from app.schemas.api_schemas import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse, summary="Service liveness check")
async def get_health() -> HealthResponse:
    """Returns static liveness status and active contract version."""
    return HealthResponse(status="ok", contract_version=CVORY_CONTRACT_VERSION)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Service readiness check (PostgreSQL + Redis)",
)
async def get_readiness(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    redis: Annotated[RedisProtocol, Depends(get_redis)],
) -> ReadinessResponse | JSONResponse:
    """Probes host PostgreSQL and Redis reachability."""
    try:
        await db.execute(text("SELECT 1"))
        pg_up = True
    except Exception:
        pg_up = False

    try:
        redis_up = bool(await redis.ping())
    except Exception:
        redis_up = False

    body = ReadinessResponse(
        status="ready" if (pg_up and redis_up) else "degraded",
        postgres="up" if pg_up else "down",
        redis="up" if redis_up else "down",
    )
    if not (pg_up and redis_up):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=body.model_dump(),
        )
    return body
