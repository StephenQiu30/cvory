"""Main application entrypoint for CVory backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_error_handler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for setup and teardown."""
    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)
    # Ensure data directory exists
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="CVory Backend Service conforming to Google API Design Guide (AIP).",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/v1/openapi.json",
)

# Exception handlers adhering to Google AIP-193
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 router
app.include_router(api_router, prefix=settings.api_v1_str)


@app.get("/healthz", tags=["system"], summary="Health check")
def health_check():
    """Simple healthcheck endpoint."""
    return {"status": "ok", "app": settings.app_name}
