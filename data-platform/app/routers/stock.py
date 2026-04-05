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
