import logging
import re
import sys
from typing import Any

from app.core.config import settings

# Sensitive keyword patterns to sanitize in logs
SENSITIVE_PATTERNS = [
    (re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{10,}", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    (re.compile(r"('api_key':\s*')[^']+(\')", re.IGNORECASE), r"\1[REDACTED_KEY]\2"),
    (re.compile(r'("api_key":\s*")[^"]+(")', re.IGNORECASE), r'\1[REDACTED_KEY]\2'),
    (re.compile(r"('password':\s*')[^']+(\')", re.IGNORECASE), r"\1[REDACTED_PASSWORD]\2"),
    (re.compile(r'("password":\s*")[^"]+(")', re.IGNORECASE), r'\1[REDACTED_PASSWORD]\2'),
]


class SensitiveDataFilter(logging.Filter):
    """Filter that masks sensitive tokens, API keys, and passwords from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in SENSITIVE_PATTERNS:
                record.msg = pattern.sub(repl, record.msg)
        return True


def setup_logging() -> logging.Logger:
    """Configure structured logging for AegisNexus."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers if already present
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    formatter = logging.Formatter(
        fmt="%(asctime)s  %(levelname)-8s  %(name)s [%(filename)s:%(lineno)d] — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)
    console_handler.addFilter(SensitiveDataFilter())

    root_logger.addHandler(console_handler)

    # Set quieter levels for third-party chatty libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if not settings.DEBUG else logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING if not settings.DEBUG else logging.INFO)

    logger = logging.getLogger("aegisnexus")
    return logger
