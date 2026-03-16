"""
Database configuration and session management.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# Session-mode pooler (port 5432 on pooler host) supports prepared statements.
# connect_timeout prevents long hangs on Railway cold-start if DB is unreachable.
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    future=True,
    connect_args={"timeout": 10},
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
