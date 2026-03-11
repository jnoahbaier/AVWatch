"""
AV News Feed Service — fetches and caches headlines from public RSS feeds.
"""

import asyncio
import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class NewsItem:
    title: str
    url: str
    source_name: str
    published_at: Optional[datetime] = None
    summary: Optional[str] = None
    image_url: Optional[str] = None


# ---------------------------------------------------------------------------
# RSS feed sources
# ---------------------------------------------------------------------------

RSS_FEEDS: list[dict] = [
    {
        "name": "The Robot Report",
        "url": "https://www.therobotreport.com/news/autonomous-vehicles/feed/",
    },
    {
        "name": "IEEE Spectrum",
        "url": "https://spectrum.ieee.org/feeds/topic/transportation.rss",
    },
    {
        "name": "Electrek (Waymo)",
        "url": "https://electrek.co/tag/waymo/feed/",
    },
    {
        "name": "TechCrunch (Transportation)",
        "url": "https://techcrunch.com/category/transportation/feed/",
    },
    {
        "name": "The Verge (Self-Driving)",
        "url": "https://www.theverge.com/rss/index.xml",
    },
    {
        "name": "Ars Technica (Cars)",
        "url": "https://feeds.arstechnica.com/arstechnica/cars",
    },
]

# Keywords to filter items so we only show AV-relevant articles
AV_KEYWORDS = {
    "waymo", "cruise", "robotaxi", "autonomous vehicle", "self-driving",
    "av ", "adas", "tesla autopilot", "tesla fsd", "zoox", "nuro",
    "aurora", "motional", "pony.ai", "weride", "driverless",
    "autonomous driving", "lidar", "robo-taxi",
}

# ---------------------------------------------------------------------------
# Simple in-memory cache
# ---------------------------------------------------------------------------

_cache: dict[str, list[NewsItem]] = {}
_cache_time: dict[str, float] = {}
_CACHE_TTL_SECONDS = 1800  # 30 minutes
_cache_lock = asyncio.Lock()


def _is_av_relevant(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in AV_KEYWORDS)


def _parse_rss_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return parsedate_to_datetime(date_str).replace(tzinfo=timezone.utc)
    except Exception:
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            return None


def _extract_image(item_el: ET.Element, ns: dict) -> Optional[str]:
    """Try to extract a thumbnail/image URL from various RSS extension tags."""
    # media:thumbnail or media:content
    for tag in ("media:thumbnail", "media:content"):
        el = item_el.find(tag, ns)
        if el is not None:
            url = el.get("url")
            if url:
                return url
    # enclosure
    enc = item_el.find("enclosure")
    if enc is not None and enc.get("type", "").startswith("image"):
        return enc.get("url")
    return None


def _parse_feed(xml_text: str, source_name: str) -> list[NewsItem]:
    """Parse an RSS or Atom feed and return relevant NewsItem list."""
    items: list[NewsItem] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.warning("Failed to parse XML for %s: %s", source_name, exc)
        return items

    ns = {
        "media": "http://search.yahoo.com/mrss/",
        "atom": "http://www.w3.org/2005/Atom",
        "dc": "http://purl.org/dc/elements/1.1/",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }

    # RSS 2.0 / RSS 1.0
    entries = root.findall(".//item")
    is_atom = False

    # Atom
    if not entries:
        entries = root.findall(".//atom:entry", ns) or root.findall(
            ".//{http://www.w3.org/2005/Atom}entry"
        )
        is_atom = bool(entries)

    for entry in entries:
        def _text(tag: str) -> Optional[str]:
            el = entry.find(tag)
            return el.text.strip() if el is not None and el.text else None

        title = _text("title")
        if not title:
            title = _text("{http://www.w3.org/2005/Atom}title")
        if not title:
            continue

        if is_atom:
            link_el = entry.find("{http://www.w3.org/2005/Atom}link")
            url = (link_el.get("href") if link_el is not None else None) or ""
            pub_raw = _text("{http://www.w3.org/2005/Atom}published") or _text(
                "{http://www.w3.org/2005/Atom}updated"
            )
            summary = _text("{http://www.w3.org/2005/Atom}summary")
        else:
            url = _text("link") or ""
            pub_raw = _text("pubDate") or _text("dc:date")
            summary_el = entry.find("description")
            summary = summary_el.text if summary_el is not None else None

        # Strip HTML tags from summary
        if summary:
            try:
                summary_root = ET.fromstring(f"<root>{summary}</root>")
                summary = "".join(summary_root.itertext()).strip()
            except ET.ParseError:
                pass
            summary = summary[:200] if len(summary) > 200 else summary

        if not _is_av_relevant(title + " " + (summary or "")):
            continue

        image_url = _extract_image(entry, ns)

        items.append(
            NewsItem(
                title=title,
                url=url,
                source_name=source_name,
                published_at=_parse_rss_date(pub_raw),
                summary=summary or None,
                image_url=image_url,
            )
        )

    return items


async def _fetch_feed(client: httpx.AsyncClient, feed: dict) -> list[NewsItem]:
    name = feed["name"]
    url = feed["url"]
    try:
        resp = await client.get(url, timeout=10.0, follow_redirects=True)
        resp.raise_for_status()
        return _parse_feed(resp.text, name)
    except Exception as exc:
        logger.warning("Failed to fetch feed '%s' (%s): %s", name, url, exc)
        return []


async def fetch_news(limit: int = 30) -> list[NewsItem]:
    """
    Return AV news items, fetching fresh data or serving from cache.
    Items are sorted newest-first. Un-dated items appear at the end.
    """
    cache_key = "news"
    now = asyncio.get_event_loop().time()

    async with _cache_lock:
        if (
            cache_key in _cache
            and (now - _cache_time.get(cache_key, 0)) < _CACHE_TTL_SECONDS
        ):
            cached = _cache[cache_key]
            return cached[:limit]

    # Fetch all feeds concurrently
    async with httpx.AsyncClient(
        headers={"User-Agent": "AVWatch/1.0 (https://avwatch.app)"}
    ) as client:
        results = await asyncio.gather(
            *[_fetch_feed(client, feed) for feed in RSS_FEEDS]
        )

    all_items: list[NewsItem] = []
    for batch in results:
        all_items.extend(batch)

    # Sort: dated items first (newest → oldest), then undated
    dated = [i for i in all_items if i.published_at is not None]
    undated = [i for i in all_items if i.published_at is None]
    dated.sort(key=lambda x: x.published_at, reverse=True)  # type: ignore[arg-type]
    all_items = dated + undated

    async with _cache_lock:
        _cache[cache_key] = all_items
        _cache_time[cache_key] = now

    logger.info("Fetched %d AV news items from %d feeds", len(all_items), len(RSS_FEEDS))
    return all_items[:limit]
