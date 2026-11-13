import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the backend (where pyproject.toml / aegisnexus.db live)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(BACKEND_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "AegisNexus"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"  # development | staging | production | test
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    DOCS_ENABLED: bool = True

    # Database settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./aegisnexus.db"
    SEED_ON_STARTUP: bool = True

    # Telemetry and Health Monitoring Settings
    DEFAULT_HEARTBEAT_INTERVAL_SECONDS: int = 30
    HEARTBEAT_STALE_THRESHOLD_SECONDS: int = 60
    HEARTBEAT_OFFLINE_THRESHOLD_SECONDS: int = 90
    MAX_EVENT_BATCH_SIZE: int = 50
    MAX_PAYLOAD_SIZE_BYTES: int = 65536
    OPERATOR_API_KEY: str = "dev-operator-key-aegisnexus"

    # Security settings
    SECRET_KEY: str = "insecure-dev-secret-key-change-in-production"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def resolve_sqlite_url(cls, v: str) -> str:
        """Resolve relative SQLite paths to the absolute backend directory."""
        if ":///./" in v:
            prefix, rel_path = v.split(":///./", 1)
            abs_db_path = (BACKEND_DIR / rel_path).resolve().as_posix()
            return f"{prefix}:///{abs_db_path}"
        return v

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.is_production:
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production environment.")
            if (
                self.SECRET_KEY in ("insecure-dev-secret-key-change-in-production", "dev-secret-key-change-in-production-min-32-chars")
                or len(self.SECRET_KEY) < 32
            ):
                raise ValueError("In production, SECRET_KEY must be explicitly configured and at least 32 characters.")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT.lower() == "test"


settings = Settings()
