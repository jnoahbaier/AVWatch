"""
Main bulletin board intelligence pipeline.

Orchestrates the full flow:
  1. Scrape Reddit posts from target subreddits
  2. Filter out already-seen posts (by external_id)
  3. Run each new post through Gemini for relevance + extraction
  4. Save relevant signals to the social_signals table
  5. Compute heat score for each signal
  6. Deduplicate: cluster signals that describe the same incident
  7. Upsert into bulletin_items table

Designed to run on a schedule (every hour via APScheduler).
"""

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.social_signal import SocialSignal
from app.models.bulletin_item import BulletinItem
from app.services.bulletin.reddit_scraper import RedditScraper, RawRedditPost
from app.services.bulletin.gemini_pipeline import GeminiPipeline, GeminiResult

logger = logging.getLogger(__name__)

# ── Heat scoring constants ──────────────────────────────────────────────────
# A post is "hot" if its computed heat_score >= this threshold
HOT_THRESHOLD = 0.6

# Weights for computing heat score from engagement metrics
UPVOTE_WEIGHT = 1.0
COMMENT_WEIGHT = 2.0       # Comments signal active discussion
CROSSPOST_WEIGHT = 3.0     # Crossposts signal it spread beyond the original sub
RATIO_WEIGHT = 0.5         # Upvote ratio bonus (quality signal)

# Cap used for normalization — a post hitting these numbers gets score ~1.0
UPVOTE_CAP = 500
COMMENT_CAP = 200
CROSSPOST_CAP = 20

# ── Deduplication constants ─────────────────────────────────────────────────
# Two signals are considered the same incident if:
#   - Same company (or both unknown)
#   - Same incident type (or both None)
#   - Posted within this time window of each other
DEDUP_TIME_WINDOW_HOURS = 48

# ── Minimum engagement to save a signal at all ──────────────────────────────
MIN_UPVOTES_TO_STORE = 10


def compute_heat_score(upvotes: int, comments: int, crossposts: int, ratio: float) -> float:
    """
    Compute a normalized heat score (0.0–1.0) from engagement metrics.
    Uses a soft-cap approach so viral posts don't dwarf everything else.
    """
    raw = (
        math.log1p(upvotes) / math.log1p(UPVOTE_CAP) * UPVOTE_WEIGHT
        + math.log1p(comments) / math.log1p(COMMENT_CAP) * COMMENT_WEIGHT
        + math.log1p(crossposts) / math.log1p(CROSSPOST_CAP) * CROSSPOST_WEIGHT
        + ratio * RATIO_WEIGHT
    )
    max_possible = UPVOTE_WEIGHT + COMMENT_WEIGHT + CROSSPOST_WEIGHT + RATIO_WEIGHT
    return min(1.0, raw / max_possible)


class BulletinPipeline:
    """
    End-to-end pipeline: Reddit → Gemini → DB → Bulletin board.
    Call `run()` to execute a full cycle.
    """

    def __init__(self):
        self.scraper = RedditScraper()
        self.gemini = GeminiPipeline()

    async def run(self) -> dict:
        """
        Execute one full pipeline cycle.
        Returns a summary dict with counts for logging/monitoring.
        """
        logger.info("BulletinPipeline: starting run")
        stats = {
            "posts_fetched": 0,
            "posts_new": 0,
            "posts_relevant": 0,
            "bulletin_items_created": 0,
            "bulletin_items_updated": 0,
        }

        # 1. Scrape Reddit
        posts = await self.scraper.fetch_all_subreddits()
        stats["posts_fetched"] = len(posts)

        if not posts:
            logger.info("BulletinPipeline: no posts fetched, done")
            return stats

        async with async_session_maker() as db:
            # 2. Filter already-seen posts
            new_posts = await self._filter_new_posts(db, posts)
            stats["posts_new"] = len(new_posts)
            logger.info(f"BulletinPipeline: {len(new_posts)} new posts to process")

            # 3. Process each new post through Gemini + save to DB
            relevant_signals: list[SocialSignal] = []
            for post in new_posts:
                signal = await self._process_post(db, post)
                if signal and signal.is_relevant:
                    relevant_signals.append(signal)

            await db.flush()  # Ensure IDs are assigned before clustering
            stats["posts_relevant"] = len(relevant_signals)

            # 4. Cluster relevant signals into bulletin items
            for signal in relevant_signals:
                created = await self._cluster_signal(db, signal)
                if created:
                    stats["bulletin_items_created"] += 1
                else:
                    stats["bulletin_items_updated"] += 1

            await db.commit()

        logger.info(f"BulletinPipeline: run complete — {stats}")
        return stats

    # ── Internal helpers ────────────────────────────────────────────────────

    async def _filter_new_posts(
        self, db: AsyncSession, posts: list[RawRedditPost]
    ) -> list[RawRedditPost]:
        """Return only posts whose external_id is not already in social_signals."""
        external_ids = [p.external_id for p in posts]
        result = await db.execute(
            select(SocialSignal.external_id).where(
                SocialSignal.external_id.in_(external_ids)
            )
        )
        seen_ids = {row[0] for row in result.fetchall()}
        return [p for p in posts if p.external_id not in seen_ids]

    async def _process_post(
        self, db: AsyncSession, post: RawRedditPost
    ) -> Optional[SocialSignal]:
        """
        Run a post through Gemini, compute heat score, and save to social_signals.
        Returns the saved SocialSignal, or None if post didn't meet minimum threshold.
        """
        # Skip very low-engagement posts before calling Gemini (saves API cost)
        if post.upvotes < MIN_UPVOTES_TO_STORE:
            return None

        # Compute heat score
        heat = compute_heat_score(
            post.upvotes, post.comments, post.crossposts, post.upvote_ratio
        )
        is_hot = post.upvotes >= 50

        # Call Gemini
        gemini_result: Optional[GeminiResult] = await self.gemini.process_post(post)

        # If Gemini is not configured, save the signal as unprocessed
        is_relevant = None
        if gemini_result is not None:
            is_relevant = gemini_result.is_relevant

        # Build the SocialSignal record
        signal = SocialSignal(
            platform="reddit",
            subreddit=post.subreddit,
            external_id=post.external_id,
            title=post.title,
            body=post.body,
            url=post.url,
            author=post.author,
            upvotes=post.upvotes,
            comments=post.comments,
            crossposts=post.crossposts,
            upvote_ratio=post.upvote_ratio,
            posted_at=post.posted_at,
            media_urls=post.media_urls,
            heat_score=heat,
            is_hot=is_hot,
            is_relevant=is_relevant,
            relevance_reason=gemini_result.relevance_reason if gemini_result else None,
            extracted_company=gemini_result.extracted_company if gemini_result else None,
            extracted_incident_type=gemini_result.extracted_incident_type if gemini_result else None,
            extracted_location=gemini_result.extracted_location if gemini_result else None,
            extracted_title=gemini_result.extracted_title if gemini_result else None,
            extracted_summary=gemini_result.extracted_summary if gemini_result else None,
        )

        db.add(signal)
        logger.debug(
            f"Saved signal {post.external_id} — relevant={is_relevant}, hot={is_hot}"
        )
        return signal

    async def _cluster_signal(
        self, db: AsyncSession, signal: SocialSignal
    ) -> bool:
        """
        Try to find an existing BulletinItem this signal belongs to.
        If found, update it. If not, create a new one.
        Returns True if a NEW bulletin item was created, False if updated.
        """
        if not signal.is_relevant:
            return False

        existing = await self._find_matching_bulletin_item(db, signal)

        if existing:
            # Merge signal into existing item
            existing.signal_count += 1
            ids = list(existing.signal_ids or [])
            if str(signal.id) not in ids:
                ids.append(str(signal.id))
            existing.signal_ids = ids

            # Only upgrade the source URL if the new signal has significantly more
            # upvotes than the current best (2x). This keeps the first/most-relevant
            # post as the canonical link rather than drifting to unrelated posts.
            avg_upvotes_per_signal = existing.total_upvotes // max(existing.signal_count, 1)
            if signal.upvotes > avg_upvotes_per_signal * 2:
                existing.source_url = signal.url
                existing.source_subreddit = signal.subreddit

            existing.total_upvotes += signal.upvotes
            existing.total_comments += signal.comments
            existing.total_crossposts += signal.crossposts
            existing.last_updated_at = datetime.now(timezone.utc)

            # Recompute heat score as aggregate
            new_heat = compute_heat_score(
                existing.total_upvotes,
                existing.total_comments,
                existing.total_crossposts,
                0.7,  # Assume good ratio for aggregated items
            )
            existing.heat_score = new_heat
            existing.is_hot = existing.total_upvotes >= 50

            # Keep the best image if we have one
            if not existing.image_url and signal.media_urls:
                existing.image_url = signal.media_urls[0]

            signal.bulletin_item_id = existing.id
            logger.debug(f"Merged signal into existing bulletin item {existing.id}")
            return False

        else:
            # Create a new bulletin item from this signal
            title = self._generate_title(signal)
            summary = signal.extracted_summary or signal.title

            tags = self._build_tags(signal)

            item = BulletinItem(
                title=title,
                summary=summary,
                av_company=signal.extracted_company,
                incident_type=signal.extracted_incident_type,
                location_text=signal.extracted_location,
                tags=tags,
                occurred_at=signal.posted_at,
                signal_ids=[str(signal.id)],
                signal_count=1,
                source_url=signal.url,
                source_platform="reddit",
                source_subreddit=signal.subreddit,
                image_url=signal.media_urls[0] if signal.media_urls else None,
                heat_score=signal.heat_score,
                is_hot=signal.is_hot,
                total_upvotes=signal.upvotes,
                total_comments=signal.comments,
                total_crossposts=signal.crossposts,
                status="active",
            )
            db.add(item)
            await db.flush()  # Get the ID assigned

            signal.bulletin_item_id = item.id
            logger.info(f"Created new bulletin item: '{title[:60]}'")
            return True

    async def _find_matching_bulletin_item(
        self, db: AsyncSession, signal: SocialSignal
    ) -> Optional[BulletinItem]:
        """
        Find an existing active BulletinItem that likely describes the same incident.

        Matching criteria (all must be true):
          - Same AV company
          - Same incident type — but NOT "other" (too vague to cluster safely)
          - Item's occurred_at is within DEDUP_TIME_WINDOW_HOURS of this signal's posted_at
          - Item status is active
        """
        if not signal.posted_at:
            return None

        # "other" is too vague — different incidents all land here, so never cluster them
        if not signal.extracted_incident_type or signal.extracted_incident_type == "other":
            return None

        # Also don't cluster if company is unknown — too risky
        if not signal.extracted_company or signal.extracted_company == "unknown":
            return None

        time_lower = signal.posted_at - timedelta(hours=DEDUP_TIME_WINDOW_HOURS)
        time_upper = signal.posted_at + timedelta(hours=DEDUP_TIME_WINDOW_HOURS)

        stmt = select(BulletinItem).where(
            and_(
                BulletinItem.status == "active",
                BulletinItem.source_platform == "reddit",  # never merge into community cards
                BulletinItem.av_company == signal.extracted_company,
                BulletinItem.incident_type == signal.extracted_incident_type,
                BulletinItem.occurred_at >= time_lower,
                BulletinItem.occurred_at <= time_upper,
            )
        ).order_by(BulletinItem.signal_count.desc()).limit(1)

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    def _generate_title(self, signal: SocialSignal) -> str:
        """
        Generate a short display title for a new bulletin item.
        Priority: Gemini extracted_title → Reddit post title (truncated).
        """
        # Best case: Gemini gave us a dedicated short headline
        if signal.extracted_title and len(signal.extracted_title.strip()) > 5:
            return signal.extracted_title.strip()[:80]

        # Fall back to Reddit title, hard-capped at 60 chars
        title = signal.title.strip()
        if len(title) > 60:
            title = title[:57] + "..."
        return title

    def _build_tags(self, signal: SocialSignal) -> list[str]:
        """Build tag list from extracted signal data."""
        tags = []
        if signal.extracted_company:
            tags.append(signal.extracted_company)
        if signal.extracted_incident_type:
            tags.append(signal.extracted_incident_type.replace("_", " "))
        if signal.subreddit:
            tags.append(f"r/{signal.subreddit}")
        if signal.extracted_location:
            # Add city-level tag if location is short enough
            loc = signal.extracted_location
            if len(loc) < 50:
                tags.append(loc.lower())
        return tags
