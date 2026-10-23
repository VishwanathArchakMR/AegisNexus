import logging
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("aegisnexus.database")


def create_engine_instance(url: str, debug: bool = False) -> AsyncEngine:
    """Create a configured AsyncEngine instance."""
    is_sqlite = url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    
    return create_async_engine(
        url,
        echo=debug,
        connect_args=connect_args,
        future=True,
    )


engine = create_engine_instance(settings.DATABASE_URL, settings.DEBUG)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""
    pass


async def close_db_engine() -> None:
    """Safely dispose of the database engine connection pool on shutdown."""
    logger.info("Disposing database connection pool...")
    await engine.dispose()
    logger.info("Database engine connections closed.")
