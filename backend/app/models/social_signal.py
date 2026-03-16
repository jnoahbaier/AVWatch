"""
SocialSignal database model.

Stores raw Reddit posts that the scraper has found and processed.
This is an internal model — never referenced directly in frontend responses.
"""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SocialSignal(Base):
    """
    A raw post scraped from Reddit that may relate to an AV incident.
    Processed by Gemini to determine relevance and extract structured data.
    """

    __tablename__ = "social_signals"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    # Source info
    platform: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # reddit (twitter/tiktok reserved for future)
    subreddit: Mapped[Optional[str]] = mapped_column(
        String(100), index=True
    )  # e.g. "waymo", "sanfrancisco", "Zoox"
    external_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )  # Reddit post ID — used for deduplication so we never store the same post twice

    # Post content
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[Optional[str]] = mapped_column(String(100))
    media_urls: Mapped[List] = mapped_column(JSONB, default=list)  # image/video thumbnails

    # Engagement metrics (snapshot at scrape time)
    upvotes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    crossposts: Mapped[int] = mapped_column(Integer, default=0)
    upvote_ratio: Mapped[Optional[float]] = mapped_column(Float)

    # Timing
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # AI processing results (filled in by Gemini pipeline)
    is_relevant: Mapped[Optional[bool]] = mapped_column(Boolean, default=None)
    # None = not yet processed, True = relevant AV incident, False = not relevant
    relevance_reason: Mapped[Optional[str]] = mapped_column(Text)  # Gemini's short explanation

    # Structured extraction from Gemini
    extracted_company: Mapped[Optional[str]] = mapped_column(String(50))   # waymo, zoox, tesla...
    extracted_incident_type: Mapped[Optional[str]] = mapped_column(String(50))  # collision, near_miss...
    extracted_location: Mapped[Optional[str]] = mapped_column(Text)  # free text, e.g. "Castro District, SF"
    extracted_title: Mapped[Optional[str]] = mapped_column(String(120))  # short punchy headline ≤8 words
    extracted_summary: Mapped[Optional[str]] = mapped_column(Text)  # one sentence ≤20 words

    # Heat score (0.0–1.0) computed from engagement
    heat_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_hot: Mapped[bool] = mapped_column(Boolean, default=False)

    # Bulletin board linkage
    bulletin_item_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # FK set after clustering; intentionally soft (no FK constraint) to avoid circular deps

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<SocialSignal {self.platform}/{self.subreddit} '{self.title[:50]}'>"
