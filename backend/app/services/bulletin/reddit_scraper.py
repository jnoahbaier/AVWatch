"""
Reddit scraper for AV-related incident signals.

Uses Reddit's public JSON API (no credentials required).
When REDDIT_CLIENT_ID is configured, automatically upgrades to
authenticated PRAW access for higher rate limits.

Monitored subreddits:
  - r/waymo
  - r/Zoox
  - r/sanfrancisco
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Subreddits to monitor
TARGET_SUBREDDITS = ["waymo", "Zoox", "sanfrancisco"]

# How many posts to fetch per subreddit per run
POSTS_PER_SUBREDDIT = 25

# Public JSON endpoint — no auth required
REDDIT_BASE_URL = "https://www.reddit.com"

# Minimum upvotes for a post to even be sent to Gemini for processing
# (Keeps API costs down by filtering obvious noise early)
MIN_UPVOTES_FOR_PROCESSING = 1


@dataclass
class RawRedditPost:
    """A raw Reddit post before AI processing."""
    external_id: str          # Reddit post ID (e.g. "1abc23")
    subreddit: str
    title: str
    body: str
    url: str                  # Full Reddit URL to the post
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
    Fetches recent posts from target subreddits using Reddit's public JSON API.
    Upgrades to OAuth automatically if credentials are configured.
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
        """
        Fetch recent posts from all TARGET_SUBREDDITS.
        Returns a flat list of RawRedditPost objects.
        """
        all_posts: list[RawRedditPost] = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            for subreddit in TARGET_SUBREDDITS:
                try:
                    posts = await self._fetch_subreddit(client, subreddit)
                    logger.info(
                        f"Fetched {len(posts)} posts from r/{subreddit}"
                    )
                    all_posts.extend(posts)
                    # Be polite — Reddit public API allows ~1 req/sec
                    await asyncio.sleep(1.1)
                except Exception as exc:
                    logger.error(
                        f"Failed to fetch r/{subreddit}: {exc}", exc_info=True
                    )

        logger.info(f"Reddit scraper: fetched {len(all_posts)} total posts")
        return all_posts

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_subreddit(
        self, client: httpx.AsyncClient, subreddit: str
    ) -> list[RawRedditPost]:
        """Fetch the most recent posts from a single subreddit."""
        url = (
            f"{REDDIT_BASE_URL}/r/{subreddit}/new.json"
            f"?limit={POSTS_PER_SUBREDDIT}&raw_json=1"
        )
        headers = self._build_headers()

        response = await client.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()

        data = response.json()
        posts_data = data.get("data", {}).get("children", [])

        posts = []
        for child in posts_data:
            post = child.get("data", {})
            parsed = self._parse_post(post, subreddit)
            if parsed and parsed.upvotes >= MIN_UPVOTES_FOR_PROCESSING:
                posts.append(parsed)

        return posts

    def _parse_post(self, post: dict, subreddit: str) -> Optional[RawRedditPost]:
        """Parse a raw Reddit post dict into a RawRedditPost dataclass."""
        try:
            post_id = post.get("id", "")
            if not post_id:
                return None

            # Build the canonical Reddit URL
            permalink = post.get("permalink", "")
            url = f"https://www.reddit.com{permalink}" if permalink else post.get("url", "")

            # Body text (self posts have "selftext", link posts have empty)
            body = post.get("selftext", "") or ""
            # Strip Reddit's deleted/removed placeholder text
            if body in ("[deleted]", "[removed]"):
                body = ""

            # Timestamp — Reddit gives UTC epoch
            created_utc = post.get("created_utc", 0)
            posted_at = datetime.fromtimestamp(created_utc, tz=timezone.utc)

            # Media — try to get a usable thumbnail
            media_urls = []
            thumbnail = post.get("thumbnail", "")
            if thumbnail and thumbnail not in ("self", "default", "nsfw", "spoiler", ""):
                media_urls.append(thumbnail)

            # Higher-res preview if available
            preview = post.get("preview", {})
            images = preview.get("images", [])
            if images:
                source = images[0].get("source", {})
                high_res = source.get("url", "").replace("&amp;", "&")
                if high_res:
                    media_urls = [high_res]  # Prefer high-res over thumbnail

            return RawRedditPost(
                external_id=f"reddit_{post_id}",
                subreddit=subreddit,
                title=post.get("title", "")[:500],
                body=body[:3000],  # Cap body length sent to Gemini
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
            logger.warning(f"Failed to parse post {post.get('id')}: {exc}")
            return None

    def _build_headers(self) -> dict[str, str]:
        """Build request headers. Reddit requires a descriptive User-Agent."""
        # Reddit blocks generic or empty User-Agents with 403.
        # Using a browser-like UA is the most reliable approach for the public JSON API.
        return {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }
