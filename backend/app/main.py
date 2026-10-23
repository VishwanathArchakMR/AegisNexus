import sys
import asyncio
import logging

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.error_handlers import register_error_handlers
from app.database import Base, engine, close_db_engine

# Import all models so SQLAlchemy registers them with Base.metadata
import app.models  # noqa: F401

from app.routers import health as health_router
from app.routers import agents as agents_router
from app.routers import dashboard as dashboard_router
from app.routers import simulations as simulations_router
from app.routers import findings as findings_router
from app.routers import compliance as compliance_router
from app.routers import recovery as recovery_router
from app.simulation.seed_data import seed_database

logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: manage database initialization and shutdown cleanup."""
    logger.info(
        "Starting %s v%s (environment=%s, debug=%s)",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
        settings.DEBUG,
    )

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")

        if settings.SEED_ON_STARTUP and not settings.is_test:
            logger.info("Seeding demo database records...")
            await seed_database()
            logger.info("Demo data seeded successfully.")
    except Exception as exc:
        logger.critical("Failed to initialize database on startup: %s", str(exc), exc_info=True)
        raise

    yield

    logger.info("Shutting down %s...", settings.APP_NAME)
    await close_db_engine()
    logger.info("Application shutdown complete.")


docs_url = "/api/docs" if settings.DOCS_ENABLED else None
redoc_url = "/api/redoc" if settings.DOCS_ENABLED else None
openapi_url = "/api/openapi.json" if settings.DOCS_ENABLED else None

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Continuous adversarial security, governance, and compliance platform for AI agents.",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan,
)

# Register centralized exception and error handlers
register_error_handlers(app)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = settings.API_PREFIX

app.include_router(health_router.router, prefix=API_PREFIX)
app.include_router(agents_router.router, prefix=API_PREFIX)
app.include_router(dashboard_router.router, prefix=API_PREFIX)
app.include_router(simulations_router.router, prefix=API_PREFIX)
app.include_router(findings_router.router, prefix=API_PREFIX)
app.include_router(compliance_router.router, prefix=API_PREFIX)
app.include_router(recovery_router.router, prefix=API_PREFIX)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/api/docs" if settings.DOCS_ENABLED else "disabled",
    }
