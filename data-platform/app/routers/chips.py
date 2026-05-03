import logging
from fastapi import APIRouter, HTTPException, Query
from app.services import db_service
from app.models.schemas import InstitutionalInvestorsResponse, MarginPurchaseResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chips", tags=["chips"])


@router.get("/{ticker}/institutional", response_model=InstitutionalInvestorsResponse)
async def get_institutional(
    ticker: str,
    days: int = Query(default=60, ge=1, le=365, description="最近幾天，預設 60 天"),
):
    """查詢三大法人（外資、投信、自營商）每日買賣超。
    DB 無資料時自動向 FinMind 即時補抓並快取（cache-aside）。
    """
    ticker_upper = ticker.upper()
    rows = await db_service.get_institutional_investors(ticker_upper, days)
    if not rows:
        try:
            from app.services.chips_service import fetch_and_save_institutional_on_demand
            await fetch_and_save_institutional_on_demand(ticker_upper, days)
            rows = await db_service.get_institutional_investors(ticker_upper, days)
        except Exception as exc:
            logger.warning("On-demand chip fetch failed for %s: %s", ticker_upper, exc)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"找不到 {ticker_upper} 的三大法人資料，FinMind 暫無此資料或網路異常",
        )
    data = [{**r, "net": r["buy"] - r["sell"]} for r in rows]
    return InstitutionalInvestorsResponse(ticker=ticker_upper, data=data)


@router.get("/{ticker}/margin", response_model=MarginPurchaseResponse)
async def get_margin(
    ticker: str,
    days: int = Query(default=60, ge=1, le=365, description="最近幾天，預設 60 天"),
):
    """查詢融資融券餘額與買賣資料。"""
    rows = await db_service.get_margin_purchase(ticker.upper(), days)
    if not rows:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 的融資融券資料，請先執行 ETL 同步")
    return MarginPurchaseResponse(ticker=ticker.upper(), data=rows)
