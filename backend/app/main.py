"""
AV Watch API - Main Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import incidents, data, health
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"🚗 Starting {settings.APP_NAME} API...")
    yield
    # Shutdown
    print(f"👋 Shutting down {settings.APP_NAME} API...")


app = FastAPI(
    title=settings.APP_NAME,
    description="A transparent platform for autonomous vehicle accountability",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
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


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "description": "A transparent platform for autonomous vehicle accountability",
        "docs": "/docs",
    }

