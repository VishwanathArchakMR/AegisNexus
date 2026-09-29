import sys
import asyncio
import logging

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Application lifespan: create tables and seed demo data on startup."""
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")

    if settings.SEED_ON_STARTUP:
        await seed_database()

    yield

    await engine.dispose()
    logger.info("Database connections closed.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Continuous adversarial security, governance, and compliance platform for AI agents.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

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
        "docs": "/api/docs",
    }
