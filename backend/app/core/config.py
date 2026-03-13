"""
Application configuration using Pydantic Settings.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Application
    APP_NAME: str = "AV Watch"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production" # IMPORTANT: Change this to a strong, unique secret in production!

    # Database
    # Railway provides DATABASE_URL as "postgresql://...", but asyncpg requires
    # the "postgresql+asyncpg://" scheme. We fix it up via a validator below.
    DATABASE_URL: str = (
        "postgresql+asyncpg://avwatch:avwatch_dev_password@localhost:5432/avwatch"
    )

    @property
    def async_database_url(self) -> str:
        """Return DATABASE_URL with asyncpg driver, normalising Railway's format."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AWS S3 / MinIO
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = "avwatch-media"
    AWS_S3_ENDPOINT_URL: str | None = None
    AWS_S3_REGION: str = "us-east-1"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # External APIs
    MAPBOX_ACCESS_TOKEN: str = ""

    # Sentry
    SENTRY_DSN: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
