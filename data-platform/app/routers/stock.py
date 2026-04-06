import re
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import StockHistoryResponse, StockBar, StockLiveResponse
from app.services import db_service, twse_service

router = APIRouter(prefix="/api/stock", tags=["stock"])

_TICKER_RE = re.compile(r'^[A-Z0-9]{1,10}$')


@router.get("/{ticker}/history", response_model=StockHistoryResponse)
async def get_history(ticker: str, days: int = Query(default=90, ge=1, le=365)):
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=422, detail=f"無效的股票代號格式：{ticker}")
    rows = await db_service.get_stock_history(ticker, days)
    if not rows:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 的歷史資料")
    bars = [StockBar(**r) for r in rows]
    return StockHistoryResponse(ticker=ticker, bars=bars)


@router.get("/{ticker}/live", response_model=StockLiveResponse)
async def get_live(ticker: str):
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=422, detail=f"無效的股票代號格式：{ticker}")
    try:
        data = await twse_service.fetch_live(ticker)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return StockLiveResponse(ticker=ticker, **data)


@router.get("/{ticker}/candles")
async def get_candles(ticker: str, start_date: str = Query(default="2020-01-01")):
    """Cache-aside K 線：先查 DB，沒有再去 FinMind 並回存。"""
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=422, detail=f"無效的股票代號格式：{ticker}")

    # 1. 先查 DB
    try:
        rows = await db_service.get_candles_from_db(ticker, start_date)
    except Exception:
        rows = []

    if rows:
        data = [
            {
                "date": str(r["date"]),
                "open": float(r["open"]) if r["open"] is not None else None,
                "max": float(r["high"]) if r["high"] is not None else None,
                "min": float(r["low"]) if r["low"] is not None else None,
                "close": float(r["close"]) if r["close"] is not None else None,
                "Trading_Volume": r["volume"],
            }
            for r in rows
        ]
        return {"status": 200, "data": data}

    # 2. DB 沒資料，去 FinMind 抓
    try:
        result = await twse_service.fetch_candles(ticker, start_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"K 線資料取得失敗：{e}")

    # 3. 存入 DB（失敗不影響回應）
    if result.get("data"):
        try:
            await db_service.save_candles_to_db(ticker, result["data"])
        except Exception:
            pass

    return result


@router.get("/{ticker}/live-or-last")
async def get_live_or_last(ticker: str):
    """即時資料；若今日休市（成交量 < 100）則回傳 DB 最後交易日。"""
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=422, detail=f"無效的股票代號格式：{ticker}")
    try:
        data = await twse_service.fetch_live(ticker)
        vol = data.get("volume") or 0
        # 只有當日真實有成交（open 有值）才算即時；否則 TWSE 回傳昨日量但今日無開盤
        if vol >= 100 and data.get("open") is not None:
            return StockLiveResponse(ticker=ticker, **data)
    except Exception:
        pass

    # Fallback：取 DB 最後一個交易日
    pool = await db_service.get_pool()
    row = await pool.fetchrow(
        "SELECT date, open, high, low, close, volume FROM stock_history WHERE stock_id=$1 ORDER BY date DESC LIMIT 1",
        ticker,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 資料")
    r = dict(row)
    return {
        "ticker": ticker,
        "name": ticker,
        "open": float(r["open"]) if r["open"] else None,
        "high": float(r["high"]) if r["high"] else None,
        "low": float(r["low"]) if r["low"] else None,
        "last": float(r["close"]) if r["close"] else None,
        "prev_close": float(r["close"]) if r["close"] else None,
        "volume": r["volume"],
        "time": "13:30:00",
        "date": str(r["date"]).replace("-", ""),
        "cached": False,
        "source": "db",
    }
