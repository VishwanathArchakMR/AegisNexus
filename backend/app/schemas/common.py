from typing import Any, Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    database: str
    version: str
    service: str
    environment: str
    timestamp: str


class ErrorResponse(BaseModel):
    error: str
    message: str
    status_code: int
    details: Optional[Any] = None
    error_id: Optional[str] = None
