"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed runtime settings for the CVory FastAPI backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    backend_port: int = Field(default=3001, gt=0)
    frontend_origin: str = "http://127.0.0.1:3000"
    frontend_internal_url: str = "http://127.0.0.1:3000"

    database_url: str = "postgresql+asyncpg://cvory:cvory_dev_password@127.0.0.1:5432/cvory"
    redis_url: str = "redis://127.0.0.1:6379/0"

    jwt_access_secret: str = Field(
        default="dev-access-secret-key-at-least-32-chars",
        min_length=16,
    )
    jwt_access_expires_minutes: int = Field(default=15, gt=0)
    jwt_refresh_secret: str = Field(
        default="dev-refresh-secret-key-at-least-32-chars",
        min_length=16,
    )
    jwt_refresh_expires_days: int = Field(default=14, gt=0)

    smtp_host: str = "smtp.163.com"
    smtp_port: int = Field(default=465, gt=0)
    smtp_secure: bool = True
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "简序 CVory <no-reply@163.com>"

    s3_endpoint_url: str = "http://127.0.0.1:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "cvory-avatars"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = "http://127.0.0.1:9000/cvory-avatars"

    pdf_max_concurrency: int = Field(default=2, ge=1, le=8)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns cached application settings."""
    return Settings()
