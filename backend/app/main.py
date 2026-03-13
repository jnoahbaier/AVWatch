"""
AV Watch API - Main Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import incidents, data, health, data_sync, news
from app.core.config import settings
from app.core.database import engine, Base
from app import models as _models  # noqa: F401 — ensure all models are registered before create_all


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
    print(f"Starting {settings.APP_NAME} API...")
    yield
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
app.include_router(data_sync.router, prefix="/api", tags=["Data Sync"])
app.include_router(news.router, prefix="/api/news", tags=["News"])


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "description": "A transparent platform for autonomous vehicle accountability",
        "docs": "/docs",
    }
