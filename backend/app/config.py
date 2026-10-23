"""
Configuration entrypoint. Re-exports settings from app.core.config.
"""
from app.core.config import Settings, settings

__all__ = ["Settings", "settings"]
