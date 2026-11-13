class AegisNexusError(Exception):
    """Base exception for all AegisNexus SDK errors."""
    pass


class ConfigurationError(AegisNexusError):
    """Raised when the SDK configuration is invalid or missing required credentials."""
    pass


class AuthenticationError(AegisNexusError):
    """Raised when the agent fails to authenticate with the AegisNexus backend."""
    pass


class TransportError(AegisNexusError):
    """Raised when HTTP network communication fails."""
    pass


class RateLimitError(TransportError):
    """Raised when telemetry ingestion is throttled by the backend."""
    pass
