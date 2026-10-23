import logging
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.time import utc_now
from app.dependencies import get_db
from app.schemas.common import HealthResponse, ReadinessResponse

logger = logging.getLogger("aegisnexus.health")
router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness probe: verifies that the application process is running."""
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        service=settings.APP_NAME,
        environment=settings.ENVIRONMENT,
    )


@router.get("/readiness", response_model=ReadinessResponse)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe: verifies that critical dependencies (database) are operational."""
    try:
        # Check database connectivity
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.error("Readiness check failed - database error: %s", str(exc))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "version": settings.APP_VERSION,
                "service": settings.APP_NAME,
                "environment": settings.ENVIRONMENT,
                "timestamp": utc_now().isoformat(),
            },
        )

    return ReadinessResponse(
        status="ready",
        database=db_status,
        version=settings.APP_VERSION,
        service=settings.APP_NAME,
        environment=settings.ENVIRONMENT,
        timestamp=utc_now().isoformat(),
    )
