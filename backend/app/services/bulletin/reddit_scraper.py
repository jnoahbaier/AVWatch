"""
Reddit scraper for AV-related incident signals.

Strategy (in priority order):
  1. OAuth2 app-only flow  — if REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET are set
  2. RSS feed fallback     — no credentials needed, always works

RSS feeds are public Atom XML endpoints Reddit still exposes without auth.
They give us title, body excerpt, URL, and timestamp — enough for Gemini.

Monitored subreddits:
  - r/waymo            — Waymo-specific incidents and community reports
  - r/SelfDrivingCars  — Broad AV community: incidents, vandalism, near-misses
  - r/robotaxi         — Robotaxi incidents across all companies
  - r/sanfrancisco     — SF local reports including AV vandalism / obstruction
  - r/bayarea          — Bay Area AV incidents
  - r/teslamotors      — Tesla FSD incidents and near-misses
"""

import asyncio
import base64
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Optional
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TARGET_SUBREDDITS = [
    "waymo",
    "SelfDrivingCars",
    "robotaxi",
    "sanfrancisco",
    "bayarea",
    "teslamotors",
]

POSTS_PER_SUBREDDIT = 25
MIN_UPVOTES_FOR_PROCESSING = 1  # RSS has no upvote data; all posts pass this

_USER_AGENT = settings.REDDIT_USER_AGENT  # e.g. "avwatch:v1.0 (by /u/yourname)"
_PUBLIC_BASE = "https://www.reddit.com"
_OAUTH_BASE = "https://oauth.reddit.com"
_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"

# Atom namespace used in Reddit RSS feeds
_ATOM_NS = "http://www.w3.org/2005/Atom"


@dataclass
class RawRedditPost:
    """A raw Reddit post before AI processing."""
    external_id: str
    subreddit: str
    title: str
    body: str
    url: str
    author: str
    upvotes: int
    comments: int
    crossposts: int
    upvote_ratio: float
    posted_at: datetime
    media_urls: list[str] = field(default_factory=list)
    thumbnail_url: Optional[str] = None


class RedditScraper:
    """
    Fetches recent posts from target subreddits.

    Uses OAuth if credentials are configured, otherwise falls back to RSS.
    """

    def __init__(self):
        self._use_auth = bool(
            settings.REDDIT_CLIENT_ID and settings.REDDIT_CLIENT_SECRET
        )
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def fetch_all_subreddits(self) -> list[RawRedditPost]:
        all_posts: list[RawRedditPost] = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            if self._use_auth:
                await self._refresh_token_if_needed(client)

            for subreddit in TARGET_SUBREDDITS:
                try:
                    if self._use_auth:
                        posts = await self._fetch_via_oauth(client, subreddit)
                    else:
                        posts = await self._fetch_via_rss(client, subreddit)
                    logger.info(f"Fetched {len(posts)} posts from r/{subreddit}")
                    all_posts.extend(posts)
                    await asyncio.sleep(2.0)  # Be polite
                except Exception as exc:
                    logger.error(f"Failed to fetch r/{subreddit}: {exc}", exc_info=True)

        logger.info(f"Reddit scraper: fetched {len(all_posts)} total posts")
        return all_posts

    # ------------------------------------------------------------------
    # OAuth flow
    # ------------------------------------------------------------------

    async def _refresh_token_if_needed(self, client: httpx.AsyncClient) -> None:
        now = datetime.now(tz=timezone.utc)
        if self._access_token and self._token_expires_at and now < self._token_expires_at:
            return

        credentials = f"{settings.REDDIT_CLIENT_ID}:{settings.REDDIT_CLIENT_SECRET}"
        encoded = base64.b64encode(credentials.encode()).decode()

        response = await client.post(
            _TOKEN_URL,
            headers={
                "Authorization": f"Basic {encoded}",
                "User-Agent": _USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        response.raise_for_status()
        token_data = response.json()

        self._access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        self._token_expires_at = now + timedelta(seconds=expires_in - 60)
        logger.info("Reddit OAuth token refreshed")

    async def _fetch_via_oauth(
        self, client: httpx.AsyncClient, subreddit: str
    ) -> list[RawRedditPost]:
        url = f"{_OAUTH_BASE}/r/{subreddit}/new?limit={POSTS_PER_SUBREDDIT}&raw_json=1"
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {self._access_token}",
                "User-Agent": _USER_AGENT,
            },
            follow_redirects=True,
        )
        response.raise_for_status()
        posts_data = response.json().get("data", {}).get("children", [])
        return [
            p for p in (
                self._parse_json_post(child.get("data", {}), subreddit)
                for child in posts_data
            )
            if p and p.upvotes >= MIN_UPVOTES_FOR_PROCESSING
        ]

    # ------------------------------------------------------------------
    # RSS fallback
    # ------------------------------------------------------------------

    async def _fetch_via_rss(
        self, client: httpx.AsyncClient, subreddit: str
    ) -> list[RawRedditPost]:
        url = f"{_PUBLIC_BASE}/r/{subreddit}/new.rss?limit={POSTS_PER_SUBREDDIT}"
        response = await client.get(
            url,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        )
        response.raise_for_status()
        return self._parse_rss(response.text, subreddit)

    def _parse_rss(self, xml_text: str, subreddit: str) -> list[RawRedditPost]:
        """Parse Reddit Atom RSS feed into RawRedditPost list."""
        posts = []
        try:
            root = ET.fromstring(xml_text)
            ns = {"atom": _ATOM_NS}
            entries = root.findall("atom:entry", ns)

            for entry in entries:
                try:
                    # ID looks like: "t3_postid" — extract the short post id
                    raw_id = entry.findtext("atom:id", default="", namespaces=ns)
                    post_id = raw_id.split("_")[-1] if "_" in raw_id else raw_id

                    title = entry.findtext("atom:title", default="", namespaces=ns).strip()

                    # Link href
                    link_el = entry.find("atom:link", ns)
                    url = link_el.get("href", "") if link_el is not None else ""

                    # Body is in <content> or <summary>
                    body = (
                        entry.findtext("atom:content", default="", namespaces=ns)
                        or entry.findtext("atom:summary", default="", namespaces=ns)
                        or ""
                    ).strip()
                    # Strip HTML tags simply
                    import re
                    body = re.sub(r"<[^>]+>", " ", body).strip()
                    body = re.sub(r"\s+", " ", body)[:3000]

                    # Author
                    author_el = entry.find("atom:author/atom:name", ns)
                    author = author_el.text.strip() if author_el is not None and author_el.text else "[deleted]"

                    # Timestamp
                    updated = entry.findtext("atom:updated", default="", namespaces=ns)
                    try:
                        posted_at = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                    except Exception:
                        posted_at = datetime.now(tz=timezone.utc)

                    if not post_id or not title:
                        continue

                    posts.append(RawRedditPost(
                        external_id=f"reddit_{post_id}",
                        subreddit=subreddit,
                        title=title[:500],
                        body=body,
                        url=url,
                        author=author,
                        upvotes=0,      # Not available in RSS
                        comments=0,     # Not available in RSS
                        crossposts=0,
                        upvote_ratio=0.5,
                        posted_at=posted_at,
                        media_urls=[],
                        thumbnail_url=None,
                    ))
                except Exception as exc:
                    logger.warning(f"Failed to parse RSS entry: {exc}")
        except ET.ParseError as exc:
            logger.error(f"RSS XML parse error for r/{subreddit}: {exc}")
        return posts

    # ------------------------------------------------------------------
    # JSON post parser (OAuth path)
    # ------------------------------------------------------------------

    def _parse_json_post(self, post: dict, subreddit: str) -> Optional[RawRedditPost]:
        try:
            post_id = post.get("id", "")
            if not post_id:
                return None

            permalink = post.get("permalink", "")
            url = f"https://www.reddit.com{permalink}" if permalink else post.get("url", "")

            body = post.get("selftext", "") or ""
            if body in ("[deleted]", "[removed]"):
                body = ""

            posted_at = datetime.fromtimestamp(
                post.get("created_utc", 0), tz=timezone.utc
            )

            media_urls = []
            thumbnail = post.get("thumbnail", "")
            if thumbnail and thumbnail not in ("self", "default", "nsfw", "spoiler", ""):
                media_urls.append(thumbnail)
            preview_images = post.get("preview", {}).get("images", [])
            if preview_images:
                high_res = preview_images[0].get("source", {}).get("url", "").replace("&amp;", "&")
                if high_res:
                    media_urls = [high_res]

            return RawRedditPost(
                external_id=f"reddit_{post_id}",
                subreddit=subreddit,
                title=post.get("title", "")[:500],
                body=body[:3000],
                url=url,
                author=post.get("author", "[deleted]"),
                upvotes=max(0, post.get("ups", 0)),
                comments=max(0, post.get("num_comments", 0)),
                crossposts=max(0, post.get("num_crossposts", 0)),
                upvote_ratio=post.get("upvote_ratio", 0.5),
                posted_at=posted_at,
                media_urls=media_urls,
                thumbnail_url=media_urls[0] if media_urls else None,
            )
        except Exception as exc:
            logger.warning(f"Failed to parse JSON post {post.get('id')}: {exc}")
            return None
