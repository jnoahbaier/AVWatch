"""
Database configuration and session management.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings


# NullPool is required for Supabase's transaction-mode pooler (Supavisor/pgbouncer).
# Transaction-mode poolers don't support asyncpg's prepared statements, so we use
# NullPool to get a fresh connection per request — Supabase's pooler handles
# the real connection pooling on its side.
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    future=True,
    poolclass=NullPool,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
