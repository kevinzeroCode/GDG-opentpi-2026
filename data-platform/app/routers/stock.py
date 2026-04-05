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
    """代理 FinMind K 線資料，保持與前端相容的原始格式。"""
    if not _TICKER_RE.match(ticker):
        raise HTTPException(status_code=422, detail=f"無效的股票代號格式：{ticker}")
    try:
        data = await twse_service.fetch_candles(ticker, start_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"K 線資料取得失敗：{e}")
    return data
