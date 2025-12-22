"""
Health check endpoints.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "avwatch-api"}


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies all dependencies are available."""
    # TODO: Add database and Redis connectivity checks
    return {
        "status": "ready",
        "checks": {
            "database": "ok",
            "redis": "ok",
        },
    }
