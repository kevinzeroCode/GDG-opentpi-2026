from fastapi import APIRouter, HTTPException, Query
from app.services import db_service
from app.models.schemas import InstitutionalInvestorsResponse, MarginPurchaseResponse

router = APIRouter(prefix="/api/chips", tags=["chips"])


@router.get("/{ticker}/institutional", response_model=InstitutionalInvestorsResponse)
async def get_institutional(
    ticker: str,
    days: int = Query(default=60, ge=1, le=365, description="最近幾天，預設 60 天"),
):
    """查詢三大法人（外資、投信、自營商）每日買賣超。"""
    rows = await db_service.get_institutional_investors(ticker.upper(), days)
    if not rows:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 的三大法人資料，請先執行 ETL 同步")
    # 注入 net = buy - sell（不存 DB，Router 層計算）
    data = [{**r, "net": r["buy"] - r["sell"]} for r in rows]
    return InstitutionalInvestorsResponse(ticker=ticker.upper(), data=data)


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
