"""
Gemini 2.5 Flash AI pipeline for AV incident relevance filtering and extraction.

For each Reddit post, Gemini is asked two things:
  1. Is this post about a real AV incident relevant to AV Watch?
  2. If yes, extract structured data: company, incident type, location, summary.

This runs entirely in the backend. No mention of this in any frontend response.
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import settings
from app.services.bulletin.reddit_scraper import RawRedditPost

logger = logging.getLogger(__name__)

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

# AV companies we track
KNOWN_COMPANIES = [
    "waymo",
    "zoox",
    "cruise",
    "tesla",
    "nuro",
    "aurora",
    "motional",
    "unknown",
]

# Incident types matching our schema (keep in sync with frontend utils.ts and DB enum)
KNOWN_INCIDENT_TYPES = [
    "collision",  # AV involved in a crash
    "sudden_behavior",  # Erratic, unexpected AV movement or near-miss
    "blockage",  # AV blocked traffic or emergency vehicles
    "vandalism",  # AV was vandalized or physically obstructed by a human
    "other",  # Specific AV incident that doesn't fit above categories (e.g. police stop, passenger stranding)
]

# The classification prompt sent to Gemini for each post
RELEVANCE_PROMPT = """You are a strict incident analyst for AV Watch, a platform that tracks
real-world autonomous vehicle (AV) on-road events — both problematic AND noteworthy behavior.

Your job is to read a Reddit post and decide:
1. Is this post reporting a REAL, SPECIFIC, ON-ROAD AV EVENT that happened to a vehicle on a
   public road?

   A post IS relevant if it describes a specific on-road event, including:
   - COLLISION / CRASH: an AV was involved in a collision or near-miss
   - SUDDEN / ERRATIC BEHAVIOR: unexpected braking, swerving, freezing, or dangerous maneuvers
   - BLOCKAGE: AV blocked traffic, an intersection, emergency vehicles, or a driveway
   - VANDALISM / OBSTRUCTION: a human vandalizing, attacking, or physically obstructing an AV
   - BEING PULLED OVER / CITED: an AV stopped by police or authorities
   - STRANDING PASSENGERS: AV left passengers stranded mid-trip or in an unsafe location
   - FLEET-WIDE FAILURE: multiple AVs simultaneously failing or behaving abnormally
   - NOTABLE ON-ROAD BEHAVIOR: any other specific thing an AV did on a public road, even if
     the outcome was positive (e.g. "AV slowed for a deer", "Waymo correctly yielded for a
     cyclist", "robotaxi handled a strange road situation well")

   AUTOMATIC REJECTION — a post is NEVER relevant if it is ANY of the following. These must
   ALWAYS be marked is_relevant=false, no exceptions:
   - ANY announcement that a company is launching, expanding, or starting service in a new city
     or region (e.g. "Waymo launches in Nashville", "Cruise expanding to Austin", "Zoox begins
     service in Miami") — these are corporate press releases, NOT on-road incidents
   - Business news of any kind: funding rounds, partnerships, earnings, acquisitions, IPOs
   - Product or feature announcements, software updates, or hardware reveals
   - A scenic, entertaining, or pleasant ride experience with no specific behavioral event
   - Opinion pieces, predictions, polls, or hypothetical discussions about AVs
   - General news articles about the AV industry without a specific on-road event
   - Clearly fictional, satirical, or joke posts

   KEY DISTINCTION: Ask yourself — "Did something specific happen to an AV on a road?"
   If yes → likely relevant. If the post is about what a company announced or plans to do →
   ALWAYS not relevant, send it to the News section instead.

   When in doubt, lean toward NOT relevant.

2. If it IS relevant, extract structured data.

Reddit post to analyze:
---
Subreddit: r/{subreddit}
Title: {title}
Body: {body}
Upvotes: {upvotes} | Comments: {comments}
---

Respond with ONLY valid JSON in exactly this format:
{{
  "is_relevant": true or false,
  "relevance_reason": "one sentence explaining your decision",
  "extracted_company": "waymo|zoox|cruise|tesla|nuro|aurora|motional|unknown|null",
  "extracted_incident_type": "collision|near_miss|sudden_behavior|blockage|vandalism|other|null",
  "extracted_location": "specific location if mentioned, or null",
  "extracted_title": "if relevant: a punchy neutral headline under 8 words (e.g. 'Waymo yields for cyclist at busy intersection'). if not relevant: null",
  "extracted_summary": "if relevant: ONE sentence, max 20 words, describing exactly what happened. if not relevant: null"
}}

Do not include any text outside the JSON object."""


@dataclass
class GeminiResult:
    """The result of processing one Reddit post through Gemini."""

    is_relevant: bool
    relevance_reason: str
    extracted_company: Optional[str]
    extracted_incident_type: Optional[str]
    extracted_location: Optional[str]
    extracted_title: Optional[str]
    extracted_summary: Optional[str]


class GeminiPipeline:
    """
    Calls Gemini 2.5 Flash to classify and extract data from Reddit posts.
    Uses the REST API directly (no SDK dependency needed).
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if not self.api_key:
            logger.warning(
                "GEMINI_API_KEY not set — bulletin board AI pipeline is disabled"
            )

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def process_post(self, post: RawRedditPost) -> Optional[GeminiResult]:
        """
        Run a single Reddit post through Gemini.
        Returns a GeminiResult, or None if the API call fails.
        """
        if not self.is_configured():
            logger.warning("Gemini not configured, skipping AI processing")
            return None

        prompt = RELEVANCE_PROMPT.format(
            subreddit=post.subreddit,
            title=post.title,
            body=post.body or "(no body text)",
            upvotes=post.upvotes,
            comments=post.comments,
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    GEMINI_API_URL,
                    params={"key": self.api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.1,  # Low temp = deterministic, factual
                            "maxOutputTokens": 2048,  # Gemini 2.5 uses thinking tokens before output
                        },
                    },
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                data = response.json()

            # Extract the text content from Gemini's response
            raw_text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            return self._parse_response(raw_text, post)

        except httpx.HTTPStatusError as exc:
            logger.error(
                f"Gemini API HTTP error for post {post.external_id}: "
                f"{exc.response.status_code} — {exc.response.text[:200]}"
            )
            return None
        except Exception as exc:
            logger.error(
                f"Gemini processing failed for post {post.external_id}: {exc}",
                exc_info=True,
            )
            return None

    def _parse_response(
        self, raw_text: str, post: RawRedditPost
    ) -> Optional[GeminiResult]:
        """Parse the JSON response from Gemini into a GeminiResult."""
        try:
            text = raw_text.strip()

            # Strip markdown code fences (```json ... ```)
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(
                    line for line in lines if not line.startswith("```")
                ).strip()

            # Gemini 2.5 sometimes prefixes with prose like "Here is the JSON:"
            # Find the first { and use everything from there
            brace_idx = text.find("{")
            if brace_idx > 0:
                text = text[brace_idx:]

            # Also handle trailing prose after the closing brace
            brace_end = text.rfind("}")
            if brace_end != -1:
                text = text[: brace_end + 1]

            if not text:
                logger.warning(f"Empty Gemini response for post {post.external_id}")
                return None

            parsed = json.loads(text)

            # Sanitize company and incident type against known values
            company = parsed.get("extracted_company")
            if company and company.lower() not in KNOWN_COMPANIES:
                company = "unknown"
            elif company:
                company = company.lower()

            incident_type = parsed.get("extracted_incident_type")
            if incident_type and incident_type.lower() not in KNOWN_INCIDENT_TYPES:
                incident_type = "other"
            elif incident_type:
                incident_type = incident_type.lower()

            return GeminiResult(
                is_relevant=bool(parsed.get("is_relevant", False)),
                relevance_reason=str(parsed.get("relevance_reason", ""))[:500],
                extracted_company=company if company != "null" else None,
                extracted_incident_type=incident_type
                if incident_type != "null"
                else None,
                extracted_location=parsed.get("extracted_location") or None,
                extracted_title=parsed.get("extracted_title") or None,
                extracted_summary=parsed.get("extracted_summary") or None,
            )

        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.warning(
                f"Could not parse Gemini response for post {post.external_id}: "
                f"{exc} | Raw: {raw_text[:200]}"
            )
            return None
