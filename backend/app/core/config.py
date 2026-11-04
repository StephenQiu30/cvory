"""Configuration settings for CVory backend."""

from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment or defaults."""

    app_name: str = "CVory API"
    api_prefix: str = "/api"
    
    # Database
    database_url: str = "mysql+pymysql://root:123456@127.0.0.1:3306/cvory?charset=utf8mb4"
    
    # Data directory for avatars and private storage
    data_dir: Path = Path(__file__).resolve().parent.parent.parent / "data"
    
    frontend_internal_url: str = "http://127.0.0.1:3000"
    public_app_origin: str = ""
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_tls_mode: str = "tls"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "CVory"
    mail_encryption_key: str = ""
    mail_rate_limit_key: str = ""
    deletion_tombstone_dir: Path | None = None
    deletion_tombstone_key: str = ""
    deletion_enabled: bool = False

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:1234",
        "http://127.0.0.1:1234",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
