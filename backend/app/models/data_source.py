"""
Data source tracking model.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DataSource(Base):
    """Track external data sources and their sync status."""

    __tablename__ = "data_sources"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    url: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Sync tracking
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sync_frequency: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # daily, weekly, monthly, quarterly
    records_count: Mapped[int] = mapped_column(default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<DataSource {self.name}>"

