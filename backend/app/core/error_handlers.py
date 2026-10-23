import logging
import uuid
from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.exceptions import AegisNexusException

logger = logging.getLogger("aegisnexus.errors")


def format_validation_error(exc: RequestValidationError) -> list[Dict[str, Any]]:
    """Format Pydantic request validation errors into a clean, predictable structure."""
    formatted = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        formatted.append({
            "field": loc,
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "validation_error"),
        })
    return formatted


def register_error_handlers(app: FastAPI) -> None:
    """Register all global error handlers onto the FastAPI application."""

    @app.exception_handler(AegisNexusException)
    async def aegis_nexus_exception_handler(request: Request, exc: AegisNexusException) -> JSONResponse:
        logger.warning(
            "Application error [%s]: %s (path=%s)",
            exc.error_type,
            exc.message,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_type,
                "message": exc.message,
                "status_code": exc.status_code,
                "details": exc.details,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = format_validation_error(exc)
        logger.warning(
            "Validation error on %s: %d invalid fields",
            request.url.path,
            len(errors),
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "ValidationError",
                "message": "The request body or parameters failed validation.",
                "status_code": 422,
                "details": errors,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTPException",
                "message": str(exc.detail),
                "status_code": exc.status_code,
                "details": None,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        error_id = str(uuid.uuid4())
        logger.error(
            "Unhandled server error [ErrorID: %s] on %s: %s",
            error_id,
            request.url.path,
            str(exc),
            exc_info=True,
        )
        
        # In development/test, we can provide more detail; in production, keep it strictly safe
        message = (
            f"Internal server error: {str(exc)}"
            if settings.DEBUG or settings.is_test
            else "An unexpected internal server error occurred."
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "InternalServerError",
                "message": message,
                "status_code": 500,
                "error_id": error_id,
            },
        )
