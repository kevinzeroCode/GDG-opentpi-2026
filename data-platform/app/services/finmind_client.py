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
DIGIRUNNER_FINMIND_PATH = "/finmind/api/v4/data"


class QuotaExceededError(Exception):
    pass


def _quota_key() -> str:
    return f"finmind:quota:{date.today().isoformat()}"


def _digirunner_finmind_url() -> str:
    return f"{settings.digirunner_service_url.rstrip('/')}{DIGIRUNNER_FINMIND_PATH}"


async def _increment_quota(redis, key: str) -> None:
    await redis.incr(key)
    await redis.expire(key, QUOTA_TTL_SECONDS)


async def _request_finmind(redis, key: str, url: str, params: dict) -> list[dict]:
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, params=params)

        await _increment_quota(redis, key)

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

    raise RuntimeError(f"FinMind API returned 429 three times, dataset={params['dataset']} ticker={params['data_id']}")


async def get_quota_status() -> dict:
    r = await get_redis()
    raw = await r.get(_quota_key())
    used = int(raw) if raw else 0
    source = "digirunner" if used >= QUOTA_THRESHOLD else "finmind"
    return {
        "used": used,
        "limit": QUOTA_DAILY_LIMIT,
        "remaining": max(0, QUOTA_DAILY_LIMIT - used),
        "date": date.today().isoformat(),
        "source": source,
    }


async def fetch(dataset: str, ticker: str, start_date: str) -> list[dict]:
    r = await get_redis()
    key = _quota_key()

    raw = await r.get(key)
    used = int(raw) if raw else 0

    params: dict = {"dataset": dataset, "data_id": ticker, "start_date": start_date}
    if settings.finmind_token:
        params["token"] = settings.finmind_token

    if used >= QUOTA_THRESHOLD:
        logger.warning(
            "FinMind daily quota reached %s/%s; switching to DigiRunner fallback",
            used,
            QUOTA_DAILY_LIMIT,
        )
        return await _request_finmind(r, key, _digirunner_finmind_url(), params)

    return await _request_finmind(r, key, settings.finmind_url, params)
