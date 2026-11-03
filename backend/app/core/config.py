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

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
