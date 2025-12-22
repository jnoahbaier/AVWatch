"""
Incident database model.
"""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from geoalchemy2 import Geography
from sqlalchemy import String, Text, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Incident(Base):
    """Incident report model."""

    __tablename__ = "incidents"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    # Core fields
    incident_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # collision, near_miss, sudden_behavior, blockage, other

    av_company: Mapped[Optional[str]] = mapped_column(
        String(50), index=True
    )  # waymo, cruise, zoox, tesla, unknown

    description: Mapped[Optional[str]] = mapped_column(Text)

    # Location (PostGIS Geography for accurate distance calculations)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), default="San Francisco", index=True)

    # Time
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Reporter (optional for anonymity)
    reporter_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reporter_type: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # pedestrian, cyclist, driver, rider, other

    # Verification
    status: Mapped[str] = mapped_column(
        String(20), default="unverified", index=True
    )  # unverified, corroborated, verified, rejected
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2))

    # Media
    media_urls: Mapped[List] = mapped_column(JSONB, default=list)

    # Source tracking
    source: Mapped[str] = mapped_column(
        String(50), default="user_report", index=True
    )  # user_report, nhtsa, cpuc, dmv
    external_id: Mapped[Optional[str]] = mapped_column(
        String(100), unique=True
    )  # For deduplication with public data

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    reporter = relationship("User", back_populates="incidents")

    def __repr__(self) -> str:
        return f"<Incident {self.id}: {self.incident_type} by {self.av_company}>"

