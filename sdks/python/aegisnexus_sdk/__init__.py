"""
AegisNexus Python SDK
Continuous Runtime Security, Telemetry, and Governance for Autonomous AI Agents.
"""

from aegisnexus_sdk.client import AegisNexusClient
from aegisnexus_sdk.exceptions import (
    AegisNexusError,
    AuthenticationError,
    ConfigurationError,
    RateLimitError,
    TransportError,
)
from aegisnexus_sdk.models import CapabilityDefinition, TelemetryEvent

__version__ = "0.2.0"
__all__ = [
    "AegisNexusClient",
    "CapabilityDefinition",
    "TelemetryEvent",
    "AegisNexusError",
    "ConfigurationError",
    "AuthenticationError",
    "TransportError",
    "RateLimitError",
]
