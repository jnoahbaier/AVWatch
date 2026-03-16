"""
BulletinItem database model.

A curated, deduplicated AV incident that has been processed and is ready
to display on the public bulletin board. Each item may be backed by one
or more SocialSignals (Reddit posts) and/or user-submitted Incidents.

This is the only bulletin-related model exposed via the public API.
"""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BulletinItem(Base):
    """
    A verified, deduplicated AV incident surfaced on the bulletin board.
    Created and updated automatically by the background intelligence pipeline.
    """

    __tablename__ = "bulletin_items"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    # AI-generated display content
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # Short, punchy title — e.g. "Waymo blocks intersection in SoMa for 20 minutes"

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # 2-3 sentence plain-English summary of what happened

    # Structured incident data
    av_company: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    incident_type: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    location_text: Mapped[Optional[str]] = mapped_column(Text)
    # Human-readable location, e.g. "Mission District, San Francisco"

    tags: Mapped[List] = mapped_column(JSONB, default=list)
    # e.g. ["waymo", "blockage", "san francisco", "intersection"]

    # Timing (best estimate from source posts)
    occurred_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), index=True
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Source tracking — JSON arrays of IDs linking back to raw signals
    signal_ids: Mapped[List] = mapped_column(JSONB, default=list)
    # List of SocialSignal UUIDs that back this item

    user_report_ids: Mapped[List] = mapped_column(JSONB, default=list)
    # List of Incident UUIDs from user reports that match this incident

    signal_count: Mapped[int] = mapped_column(Integer, default=1)
    # Total number of corroborating signals (posts + user reports)

    # Primary source link (the most-upvoted or first Reddit post)
    source_url: Mapped[Optional[str]] = mapped_column(Text)
    source_platform: Mapped[Optional[str]] = mapped_column(String(20))  # reddit
    source_subreddit: Mapped[Optional[str]] = mapped_column(String(100))

    # Media
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    # Thumbnail from the Reddit post (if available)

    # Heat scoring
    heat_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    # 0.0–1.0 normalized score based on total engagement across all signals

    is_hot: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # True if heat_score >= 0.6 — shown with 🔥 on the bulletin board

    # Raw engagement totals (sum across all linked signals)
    total_upvotes: Mapped[int] = mapped_column(Integer, default=0)
    total_comments: Mapped[int] = mapped_column(Integer, default=0)
    total_crossposts: Mapped[int] = mapped_column(Integer, default=0)

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20), default="active", index=True
    )  # active, archived

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        hot_label = " 🔥" if self.is_hot else ""
        return f"<BulletinItem{hot_label} '{self.title[:60]}'>"
