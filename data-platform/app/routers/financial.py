from fastapi import APIRouter, HTTPException, Query
from app.services import db_service
from app.models.schemas import FinancialStatementsResponse, MonthRevenueResponse

router = APIRouter(prefix="/api/financial", tags=["financial"])


@router.get("/{ticker}/statements", response_model=FinancialStatementsResponse)
async def get_statements(
    ticker: str,
    limit: int = Query(default=12, ge=1, le=40, description="最近幾季，預設 12 季"),
):
    """查詢股票財務報表（EPS、ROE、毛利率等季報資料）。"""
    rows = await db_service.get_financial_statements(ticker.upper(), limit)
    if not rows:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 的財務報表資料，請先執行 ETL 同步")
    return FinancialStatementsResponse(ticker=ticker.upper(), data=rows)


@router.get("/{ticker}/revenue", response_model=MonthRevenueResponse)
async def get_revenue(
    ticker: str,
    months: int = Query(default=24, ge=1, le=60, description="最近幾個月，預設 24 個月"),
):
    """查詢股票月營收。"""
    rows = await db_service.get_month_revenue(ticker.upper(), months)
    if not rows:
        raise HTTPException(status_code=404, detail=f"找不到 {ticker} 的月營收資料，請先執行 ETL 同步")
    return MonthRevenueResponse(ticker=ticker.upper(), data=rows)
