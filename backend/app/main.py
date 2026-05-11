"""
AV Watch API - Main Application Entry Point
"""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import incidents, data, health, news
from app.api import bulletin
from app.api import admin
from app.core.config import settings
from app.core.database import engine, Base
from app import models as _models  # noqa: F401 — ensure all models are registered before create_all

logger = logging.getLogger(__name__)

# Scheduler instance (lives for the duration of the app process)
_scheduler = AsyncIOScheduler()


async def _run_bulletin_pipeline():
    """Scheduled task: run the bulletin board intelligence pipeline."""
    try:
        from app.services.bulletin.pipeline import BulletinPipeline

        pipeline = BulletinPipeline()
        stats = await pipeline.run()
        logger.info(f"Scheduled bulletin pipeline completed: {stats}")
    except Exception as exc:
        logger.error(f"Scheduled bulletin pipeline failed: {exc}", exc_info=True)


async def _run_user_report_clustering():
    """Scheduled task: cluster user-submitted reports into bulletin items."""
    try:
        from app.services.bulletin.user_report_clustering import (
            run_user_report_clustering,
        )

        stats = await run_user_report_clustering()
        logger.info(f"User report clustering completed: {stats}")
    except Exception as exc:
        logger.error(f"User report clustering failed: {exc}", exc_info=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Create all tables if they don't exist yet (idempotent).
    # Wrapped in try/except so the app can still start even if the DB is
    # temporarily unreachable (e.g., cold-start race on Railway).
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables ready.")
    except Exception as exc:
        print(f"WARNING: Could not create database tables on startup: {exc}")

    # Start the bulletin board scheduler (runs every hour automatically)
    if settings.GEMINI_API_KEY:
        _scheduler.add_job(
            _run_bulletin_pipeline,
            trigger="interval",
            hours=1,
            id="bulletin_pipeline",
            replace_existing=True,
        )
        _scheduler.add_job(
            _run_user_report_clustering,
            trigger="interval",
            minutes=30,
            id="user_report_clustering",
            replace_existing=True,
        )
        _scheduler.start()
        print("Bulletin pipeline scheduler started (runs every hour).")
        print("User report clustering scheduler started (runs every 30 minutes).")
    else:
        print(
            "WARNING: GEMINI_API_KEY not set — bulletin pipeline scheduler not started."
        )

    print(f"Starting {settings.APP_NAME} API...")
    yield

    # Shutdown scheduler cleanly
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
    print(f"Shutting down {settings.APP_NAME} API...")


app: FastAPI = FastAPI(
    title=settings.APP_NAME,
    description="A transparent platform for autonomous vehicle accountability",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
# IMPORTANT: In production, ensure settings.CORS_ORIGINS includes only your frontend domain(s) for security.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router, tags=["Health"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(data.router, prefix="/api/data", tags=["Data & Analytics"])
app.include_router(news.router, prefix="/api/news", tags=["News"])
app.include_router(bulletin.router, prefix="/api/bulletin", tags=["Bulletin"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "description": "A transparent platform for autonomous vehicle accountability",
        "docs": "/docs",
    }
