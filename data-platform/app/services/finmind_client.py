import asyncio
import logging
from datetime import date

import httpx

from app.config import settings
from app.services.cache_service import get_redis

logger = logging.getLogger(__name__)

QUOTA_DAILY_LIMIT = 600
QUOTA_THRESHOLD = 550
QUOTA_TTL_SECONDS = 172800


class QuotaExceededError(Exception):
    pass


def _quota_key() -> str:
    return f"finmind:quota:{date.today().isoformat()}"


async def _increment_quota(redis, key: str) -> None:
    await redis.incr(key)
    await redis.expire(key, QUOTA_TTL_SECONDS)


async def get_quota_status() -> dict:
    r = await get_redis()
    raw = await r.get(_quota_key())
    used = int(raw) if raw else 0
    return {
        "used": used,
        "limit": QUOTA_DAILY_LIMIT,
        "remaining": max(0, QUOTA_DAILY_LIMIT - used),
        "date": date.today().isoformat(),
    }


async def fetch(dataset: str, ticker: str, start_date: str) -> list[dict]:
    r = await get_redis()
    key = _quota_key()

    raw = await r.get(key)
    used = int(raw) if raw else 0
    if used >= QUOTA_THRESHOLD:
        raise QuotaExceededError(
            f"FinMind daily quota reached {used}/{QUOTA_DAILY_LIMIT}; pausing calls"
        )

    params: dict = {"dataset": dataset, "data_id": ticker, "start_date": start_date}
    if settings.finmind_token:
        params["token"] = settings.finmind_token

    for attempt in range(3):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(settings.finmind_url, params=params)

        await _increment_quota(r, key)

        if resp.status_code == 429:
            wait = 2 ** (attempt + 1)
            logger.warning("FinMind 429 retry %d/3; waiting %ss", attempt + 1, wait)
            await asyncio.sleep(wait)
            continue

        resp.raise_for_status()
        payload = resp.json()
        if payload.get("status") != 200:
            raise ValueError(f"FinMind returned error: {payload.get('msg', 'unknown')}")

        return payload.get("data", [])

    raise RuntimeError(f"FinMind API returned 429 three times, dataset={dataset} ticker={ticker}")
