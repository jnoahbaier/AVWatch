"""
AVWatch stress / smoke test
============================
Runs against a live deployment (default: production).

Usage:
    # Against production
    python tests/stress_test.py

    # Against local dev
    BASE_URL=http://localhost:8000 python tests/stress_test.py

What it tests:
  1. Health check  — baseline latency
  2. Read flood    — 20 concurrent users hitting GET endpoints repeatedly
  3. Rate limiting — POST /incidents respects 5/10min per IP
  4. Edge cases    — validation errors, oversized payloads, malformed JSON
  5. Summary       — p50/p95/p99 latency + error rate for each endpoint
"""

import asyncio
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from typing import Any

import httpx

BASE_URL = os.getenv("BASE_URL", "https://avwatch-production.up.railway.app").rstrip("/")

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

def ok(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")

def fail(msg: str) -> None:
    print(f"  {RED}✗{RESET} {msg}")

def warn(msg: str) -> None:
    print(f"  {YELLOW}⚠{RESET} {msg}")

def section(title: str) -> None:
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def percentile(data: list[float], p: int) -> float:
    if not data:
        return 0.0
    return statistics.quantiles(sorted(data), n=100)[p - 1]


async def timed_get(
    client: httpx.AsyncClient, url: str, results: list[dict]
) -> None:
    t0 = time.perf_counter()
    try:
        r = await client.get(url, timeout=15)
        elapsed = (time.perf_counter() - t0) * 1000
        results.append({"ms": elapsed, "status": r.status_code, "ok": r.status_code < 400})
    except Exception as e:
        elapsed = (time.perf_counter() - t0) * 1000
        results.append({"ms": elapsed, "status": 0, "ok": False, "error": str(e)})


def print_stats(label: str, results: list[dict]) -> None:
    total = len(results)
    errors = [r for r in results if not r["ok"]]
    times = [r["ms"] for r in results]
    p50 = percentile(times, 50) if len(times) >= 2 else (times[0] if times else 0)
    p95 = percentile(times, 95) if len(times) >= 20 else max(times) if times else 0
    p99 = percentile(times, 99) if len(times) >= 100 else max(times) if times else 0
    err_rate = len(errors) / total * 100 if total else 0

    status = GREEN if err_rate == 0 else (YELLOW if err_rate < 10 else RED)
    print(
        f"  {label:<35} "
        f"n={total:<4} "
        f"p50={p50:>6.0f}ms  p95={p95:>6.0f}ms  "
        f"{status}errors={err_rate:.1f}%{RESET}"
    )
    if errors:
        sample = errors[:3]
        for e in sample:
            warn(f"  → status={e['status']}  {e.get('error','')[:80]}")


# ---------------------------------------------------------------------------
# Test 1 — Health check
# ---------------------------------------------------------------------------
async def test_health(client: httpx.AsyncClient) -> bool:
    section("1 / Health check")
    passed = True
    for path in ["/health", "/health/ready"]:
        t0 = time.perf_counter()
        try:
            r = await client.get(f"{BASE_URL}{path}", timeout=10)
            ms = (time.perf_counter() - t0) * 1000
            if r.status_code == 200:
                ok(f"{path}  →  {r.status_code}  ({ms:.0f}ms)")
            else:
                fail(f"{path}  →  {r.status_code}  ({ms:.0f}ms)  body={r.text[:120]}")
                passed = False
        except Exception as e:
            fail(f"{path}  →  EXCEPTION: {e}")
            passed = False
    return passed


# ---------------------------------------------------------------------------
# Test 2 — Concurrent read flood
# ---------------------------------------------------------------------------
async def test_read_flood(client: httpx.AsyncClient) -> None:
    section("2 / Read flood  (20 concurrent users × 5 rounds each)")

    endpoints = [
        "/api/bulletin/",
        "/api/incidents/",
        "/api/news/",
        "/api/data/stats",
        "/health",
    ]

    results: dict[str, list[dict]] = {ep: [] for ep in endpoints}

    async def user_session() -> None:
        for _ in range(5):
            tasks = [
                timed_get(client, f"{BASE_URL}{ep}", results[ep])
                for ep in endpoints
            ]
            await asyncio.gather(*tasks)
            await asyncio.sleep(0.05)  # tiny pause between rounds

    users = [user_session() for _ in range(20)]
    await asyncio.gather(*users)

    print()
    for ep in endpoints:
        print_stats(ep, results[ep])


# ---------------------------------------------------------------------------
# Test 3 — Rate limiting on POST /incidents
# ---------------------------------------------------------------------------
VALID_PAYLOAD: dict[str, Any] = {
    "incident_type": "near_miss",
    "av_company": "waymo",
    "description": "[STRESS TEST — please discard]",
    "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "address": "Market St, San Francisco, CA",
    },
    "occurred_at": datetime.now(timezone.utc).isoformat(),
    "reporter_type": "pedestrian",
}


async def test_rate_limiting(client: httpx.AsyncClient) -> None:
    section("3 / Rate limiting  (POST /api/incidents — expect 429 after 5 hits)")

    statuses: list[int] = []
    for i in range(8):
        try:
            r = await client.post(
                f"{BASE_URL}/api/incidents/",
                json=VALID_PAYLOAD,
                timeout=10,
            )
            statuses.append(r.status_code)
            label = f"Request {i+1}"
            if r.status_code == 201:
                ok(f"{label}  →  201 Created")
            elif r.status_code == 429:
                ok(f"{label}  →  429 Rate limited  ✓ (expected after 5)")
            else:
                warn(f"{label}  →  {r.status_code}  {r.text[:80]}")
        except Exception as e:
            fail(f"Request {i+1}  →  EXCEPTION: {e}")
        await asyncio.sleep(0.3)

    # We expect first 5 to be 201 (or possibly some already-rate-limited from prior run),
    # and at least one 429 in the last 3
    hits_429 = statuses.count(429)
    if hits_429 >= 1:
        ok(f"Rate limiter fired correctly ({hits_429} × 429)")
    else:
        warn("No 429 seen — possibly already rate-limited from a prior run, or limit not triggering")


# ---------------------------------------------------------------------------
# Test 4 — Edge cases / validation
# ---------------------------------------------------------------------------
async def test_edge_cases(client: httpx.AsyncClient) -> None:
    section("4 / Edge cases & validation")

    cases: list[tuple[str, dict[str, Any] | str, int]] = [
        (
            "Missing required field (no incident_type)",
            {k: v for k, v in VALID_PAYLOAD.items() if k != "incident_type"},
            422,
        ),
        (
            "Invalid incident_type value",
            {**VALID_PAYLOAD, "incident_type": "explosion"},
            422,
        ),
        (
            "Description over 2000 chars",
            {**VALID_PAYLOAD, "description": "x" * 2001},
            422,
        ),
        (
            "Latitude out of range",
            {**VALID_PAYLOAD, "location": {**VALID_PAYLOAD["location"], "latitude": 999}},
            422,
        ),
        (
            "Empty body (malformed JSON)",
            "not-json",
            422,
        ),
    ]

    all_passed = True
    for label, payload, expected_status in cases:
        try:
            if isinstance(payload, str):
                r = await client.post(
                    f"{BASE_URL}/api/incidents/",
                    content=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10,
                )
            else:
                r = await client.post(
                    f"{BASE_URL}/api/incidents/",
                    json=payload,
                    timeout=10,
                )

            if r.status_code == expected_status:
                ok(f"{label:<50}  →  {r.status_code} ✓")
            else:
                fail(f"{label:<50}  →  {r.status_code} (expected {expected_status})")
                all_passed = False
        except Exception as e:
            fail(f"{label}  →  EXCEPTION: {e}")
            all_passed = False

    if all_passed:
        ok("All validation edge cases behaved correctly")


# ---------------------------------------------------------------------------
# Test 5 — Bulletin + news freshness
# ---------------------------------------------------------------------------
async def test_data_freshness(client: httpx.AsyncClient) -> None:
    section("5 / Data freshness  (bulletin + news are populated)")

    try:
        r = await client.get(f"{BASE_URL}/api/bulletin/", timeout=10)
        data = r.json()
        count = len(data.get("items", []))
        if count > 0:
            ok(f"Bulletin has {count} item(s)")
        else:
            warn("Bulletin is empty — Reddit pipeline may not have run yet")
    except Exception as e:
        fail(f"Bulletin check failed: {e}")

    try:
        r = await client.get(f"{BASE_URL}/api/news/?limit=5", timeout=10)
        data = r.json()
        # News endpoint returns a list directly
        items = data if isinstance(data, list) else data.get("items", [])
        count = len(items)
        if count > 0:
            ok(f"News feed has {count} item(s)")
        else:
            warn("News feed is empty")
    except Exception as e:
        fail(f"News check failed: {e}")

    try:
        r = await client.get(f"{BASE_URL}/api/incidents/", timeout=10)
        data = r.json()
        total = data.get("total", 0)
        if total > 0:
            ok(f"Incidents table has {total} row(s)")
        else:
            warn("No incidents in DB yet — expected for fresh deploy")
    except Exception as e:
        fail(f"Incidents check failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main() -> None:
    print(f"\n{BOLD}AVWatch Stress / Smoke Test{RESET}")
    print(f"Target: {CYAN}{BASE_URL}{RESET}")
    print(f"Time:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    async with httpx.AsyncClient(
        headers={"User-Agent": "AVWatch-StressTest/1.0"},
        follow_redirects=True,
    ) as client:
        healthy = await test_health(client)
        if not healthy:
            print(f"\n{RED}Health check failed — aborting remaining tests.{RESET}")
            sys.exit(1)

        await test_read_flood(client)
        await test_rate_limiting(client)
        await test_edge_cases(client)
        await test_data_freshness(client)

    section("Done")
    print(f"\n  {GREEN}Stress test complete.{RESET}")
    print(
        f"  {YELLOW}Note:{RESET} Test submissions (incident_type=near_miss, "
        f'"[STRESS TEST]" description) should be discarded in the admin dashboard.\n'
    )


if __name__ == "__main__":
    asyncio.run(main())
