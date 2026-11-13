import hashlib
from collections.abc import AsyncGenerator
from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import AsyncSessionLocal
from app.models.agent import Agent


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: provides an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


security = HTTPBearer(auto_error=False)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


async def get_api_key_agent(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Agent:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    hashed_token = hash_api_key(token)

    result = await db.execute(select(Agent).where(Agent.api_key_hash == hashed_token))
    agent = result.scalars().first()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check key lifecycle status
    if getattr(agent, "api_key_status", "ACTIVE") == "REVOKED":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return agent


async def get_operator_access(
    x_operator_key: Optional[str] = Header(None, alias="X-Operator-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> bool:
    """
    Validates operator administrative access.
    In local development / test mode: defaults to allowed if no key is provided,
    allowing frictionless local development while enforcing strict checks in production.
    """
    provided_key = x_operator_key or (credentials.credentials if credentials else None)

    if settings.is_production:
        if not provided_key or provided_key != settings.OPERATOR_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operator access required for this operation",
            )
        return True

    # In development / testing: allow default dev access
    if provided_key and provided_key != settings.OPERATOR_API_KEY:
        # If user explicitly supplied an invalid operator key, reject it
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Operator Key",
        )
    return True
