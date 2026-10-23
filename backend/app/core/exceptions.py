from typing import Any, Optional


class AegisNexusException(Exception):
    """Base exception for all domain and application errors in AegisNexus."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_type: str = "InternalServerError",
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_type = error_type
        self.details = details


class ResourceNotFoundException(AegisNexusException):
    """Raised when an entity or resource is not found."""

    def __init__(self, resource_type: str, identifier: str):
        super().__init__(
            message=f"{resource_type} '{identifier}' was not found.",
            status_code=404,
            error_type="ResourceNotFound",
            details={"resource_type": resource_type, "identifier": identifier},
        )


class EntityValidationError(AegisNexusException):
    """Raised when domain validation rules are violated."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=422,
            error_type="ValidationError",
            details=details,
        )


class ConflictError(AegisNexusException):
    """Raised when an action conflicts with existing state."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=409,
            error_type="ConflictError",
            details=details,
        )


class UnauthorizedError(AegisNexusException):
    """Raised when authentication credentials are missing or invalid."""

    def __init__(self, message: str = "Invalid or missing credentials."):
        super().__init__(
            message=message,
            status_code=401,
            error_type="Unauthorized",
        )


class ForbiddenError(AegisNexusException):
    """Raised when access to an action or resource is forbidden."""

    def __init__(self, message: str = "Action not permitted."):
        super().__init__(
            message=message,
            status_code=403,
            error_type="Forbidden",
        )


class ServiceError(AegisNexusException):
    """Raised when an internal service or engine failure occurs."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=500,
            error_type="ServiceError",
            details=details,
        )
