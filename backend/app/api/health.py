"""
Health check endpoints.
"""

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import async_session_maker
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "avwatch-api"}


@router.get("/health/ready")
async def readiness_check():
    """Readiness check — verifies database connectivity and reports the URL in use."""
    db_status = "unknown"
    db_error = None
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)

    # Show the URL scheme/host only (not credentials) for diagnostics
    url = settings.async_database_url
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        db_url_info = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}{parsed.path}"
    except Exception:
        db_url_info = url[:40] + "..."

    return {
        "status": "ready" if db_status == "ok" else "degraded",
        "checks": {
            "database": db_status,
            "db_url": db_url_info,
            **({"db_error": db_error} if db_error else {}),
        },
    }
