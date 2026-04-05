import json
import redis.asyncio as aioredis
from app.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> dict | None:
    r = await get_redis()
    value = await r.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, data: dict, ttl: int = 30) -> None:
    r = await get_redis()
    await r.set(key, json.dumps(data), ex=ttl)


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
