"""
BlockedIP model — stores hashed IP addresses blocked by admins.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BlockedIP(Base):
    """Hashed IP addresses that are blocked from submitting reports."""

    __tablename__ = "blocked_ips"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    # SHA-256 hash of the IP — raw IPs are never stored
    ip_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    reason: Mapped[str] = mapped_column(
        Text, nullable=False, default="Blocked by admin"
    )  # e.g. "spamming", "fake reports"

    blocked_by: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # Email of the admin who blocked this IP

    blocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<BlockedIP {self.ip_hash[:8]}... blocked by {self.blocked_by}>"
