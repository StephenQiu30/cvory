"""FastAPI application factory and lifecycle hooks."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, export, health, resumes, share, uploads
from app.core.config import Settings, get_settings
from app.infra.database import DatabaseManager
from app.infra.mail import MailProvider, SmtpMailService
from app.infra.pdf_renderer import PdfRenderer, PlaywrightPdfRenderer
from app.infra.redis_client import RedisProtocol, create_redis_client
from app.infra.storage import AvatarStorageProvider, S3AvatarStorage


def create_app(
    *,
    settings: Settings | None = None,
    db_manager: DatabaseManager | None = None,
    redis_client: RedisProtocol | None = None,
    mail_provider: MailProvider | None = None,
    avatar_storage: AvatarStorageProvider | None = None,
    pdf_renderer: PdfRenderer | None = None,
) -> FastAPI:
    """Builds the CVory FastAPI app with optional dependency overrides for tests."""
    resolved_settings = settings or get_settings()
    resolved_db = db_manager or DatabaseManager(resolved_settings)
    resolved_redis: RedisProtocol = redis_client or create_redis_client(resolved_settings.redis_url)
    resolved_mail: MailProvider = mail_provider or SmtpMailService(resolved_settings)
    resolved_storage: AvatarStorageProvider = avatar_storage or S3AvatarStorage(resolved_settings)
    resolved_pdf: PdfRenderer = pdf_renderer or PlaywrightPdfRenderer(resolved_settings)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.settings = resolved_settings
        application.state.db = resolved_db
        application.state.redis = resolved_redis
        application.state.mail = resolved_mail
        application.state.storage = resolved_storage
        application.state.pdf_renderer = resolved_pdf

        await resolved_db.init_schema()
        try:
            yield
        finally:
            await resolved_pdf.close()
            await resolved_redis.aclose()
            await resolved_db.close()

    application = FastAPI(
        title="CVory API",
        description="简序（CVory）Python FastAPI 后端契约，供前端 @umijs/openapi 自动生成客户端",
        version="0.2.0",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[resolved_settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health.router, prefix="/api")
    application.include_router(auth.router, prefix="/api")
    application.include_router(resumes.router, prefix="/api")
    application.include_router(share.router, prefix="/api")
    application.include_router(uploads.router, prefix="/api")
    application.include_router(export.router, prefix="/api")

    return application


app = create_app()
