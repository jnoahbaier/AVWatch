"""
News feed endpoints — returns AV-related headlines from RSS feeds.
"""

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.news_feed import fetch_news, NewsItem as _NewsItem

router = APIRouter()


class NewsItemResponse(BaseModel):
    title: str
    url: str
    source_name: str
    published_at: Optional[str] = None  # ISO-8601 string, nullable
    summary: Optional[str] = None
    image_url: Optional[str] = None


def _to_response(item: _NewsItem) -> NewsItemResponse:
    return NewsItemResponse(
        title=item.title,
        url=item.url,
        source_name=item.source_name,
        published_at=item.published_at.isoformat() if item.published_at else None,
        summary=item.summary,
        image_url=item.image_url,
    )


@router.get("/", response_model=list[NewsItemResponse])
async def get_news(
    limit: int = Query(default=20, ge=1, le=100, description="Max items to return"),
) -> list[NewsItemResponse]:
    """
    Return AV-related news headlines from curated RSS feeds.
    Results are cached for 30 minutes.
    """
    items = await fetch_news(limit=limit)
    return [_to_response(item) for item in items]
