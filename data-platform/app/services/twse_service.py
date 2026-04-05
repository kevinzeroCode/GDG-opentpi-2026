import logging
import httpx
from app.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_TTL = 30  # 秒


def _f(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _i(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _parse(d: dict) -> dict:
    last = _f(d.get("z"))
    open_ = _f(d.get("o"))
    prev_close = _f(d.get("y"))
    # TWSE 盤中尚無成交時 z="-"，用開盤價或昨收兜底
    effective_last = last or open_ or prev_close
    return {
        "name": d.get("n"),
        "open": open_,
        "high": _f(d.get("h")),
        "low": _f(d.get("l")),
        "last": effective_last,
        "prev_close": prev_close,
        "volume": _i(d.get("v")),
        "time": d.get("t"),
        "date": d.get("d"),
    }


async def fetch_live(ticker: str) -> dict:
    """直接呼叫 TWSE 公開 API，不經過 DigiRunner。"""
    cache_key = f"twse:live:{ticker}"
    cached = await cache_get(cache_key)
    if cached:
        cached["cached"] = True
        return cached

    async with httpx.AsyncClient(timeout=8.0) as client:
        for prefix in ("tse", "otc"):
            url = f"{settings.twse_url}?ex_ch={prefix}_{ticker}.tw&json=1&delay=0"
            try:
                resp = await client.get(url)
                if not resp.is_success:
                    continue
                data = resp.json()
                if data.get("msgArray"):
                    result = _parse(data["msgArray"][0])
                    # 若 TWSE 回傳空殼資料（無名稱且無任何價格），跳過繼續嘗試
                    if not result.get("name") and result.get("last") is None:
                        continue
                    result["cached"] = False
                    await cache_set(cache_key, result, ttl=CACHE_TTL)
                    return result
            except Exception:
                logger.warning("Failed to fetch live data for %s from %s", ticker, prefix, exc_info=True)
                continue

    raise ValueError(f"查無即時資料：{ticker}（僅盤中有效）")


async def fetch_candles(ticker: str, start_date: str) -> dict:
    """直接呼叫 FinMind 公開 API，回傳 K 線原始格式。"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            settings.finmind_url,
            params={
                "dataset": "TaiwanStockPrice",
                "data_id": ticker,
                "start_date": start_date,
            },
        )
        resp.raise_for_status()
        return resp.json()
