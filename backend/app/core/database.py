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
    # Pool tuning for Railway (single instance, moderate traffic)
    pool_size=10,        # keep 10 persistent connections warm
    max_overflow=20,     # allow up to 20 extra connections under spike
    pool_timeout=30,     # wait up to 30s for a connection before erroring
    pool_recycle=1800,   # recycle connections every 30 min to avoid stale sockets
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
