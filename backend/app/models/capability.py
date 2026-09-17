import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AgentCapability(Base):
    __tablename__ = "agent_capabilities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    capability_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # EMAIL | DATABASE | PAYMENT | FILE | API | AGENT_COMMS
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # READ | WRITE | EXECUTE | ADMIN
    permission_level: Mapped[str] = mapped_column(String(20), nullable=False)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="capabilities")
