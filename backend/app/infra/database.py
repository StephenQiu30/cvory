"""Async SQLAlchemy 2.0 engine and schema initializer (zero Alembic migrations)."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings
from app.models.entities import Base


class DatabaseManager:
    """Manages SQLAlchemy async engine, sessions, and direct schema creation."""

    def __init__(self, settings: Settings) -> None:
        self.engine: AsyncEngine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
        )
        self.session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
        )

    async def init_schema(self) -> None:
        """Creates tables directly from the single current ORM metadata."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def session(self) -> AsyncIterator[AsyncSession]:
        """Yields an async database session."""
        async with self.session_factory() as db_session:
            yield db_session

    async def close(self) -> None:
        """Disposes the SQLAlchemy connection pool."""
        await self.engine.dispose()
