from datetime import date
from typing import Optional
from pydantic import BaseModel


# --- Stock ---

class StockBar(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int


class StockHistoryResponse(BaseModel):
    ticker: str
    bars: list[StockBar]


class StockLiveResponse(BaseModel):
    ticker: str
    name: Optional[str] = None
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    last: Optional[float] = None
    prev_close: Optional[float] = None
    volume: Optional[int] = None
    time: Optional[str] = None
    date: Optional[str] = None
    cached: bool = False


# --- AI Analysis ---

class AnalyzeRequest(BaseModel):
    query: str
    conversation_id: str | None = None


class AnalyzeResponse(BaseModel):
    ticker: Optional[str] = None
    ticker_code: Optional[str] = None
    raw_text: Optional[str] = None
    commentary: Optional[str] = None
    conversation_id: Optional[str] = None


# --- Watchlist ---

class WatchlistItem(BaseModel):
    ticker: str
    name: Optional[str] = None


class WatchlistResponse(BaseModel):
    items: list[WatchlistItem]


# ── Financial ────────────────────────────────────────────────────────────────

class FinancialStatementItem(BaseModel):
    date: date
    type: str
    value: Optional[float] = None


class FinancialStatementsResponse(BaseModel):
    ticker: str
    data: list[FinancialStatementItem]


class MonthRevenueItem(BaseModel):
    date: date
    revenue: int
    revenue_month: int
    revenue_year: int


class MonthRevenueResponse(BaseModel):
    ticker: str
    data: list[MonthRevenueItem]


# ── Chips ─────────────────────────────────────────────────────────────────────

class InstitutionalInvestorItem(BaseModel):
    date: date
    name: str
    buy: int
    sell: int
    net: int  # 注入值：buy - sell，不存 DB


class InstitutionalInvestorsResponse(BaseModel):
    ticker: str
    data: list[InstitutionalInvestorItem]


class MarginPurchaseItem(BaseModel):
    date: date
    margin_purchase_buy: int
    margin_purchase_sell: int
    margin_purchase_cash_repay: int
    margin_purchase_today_balance: int
    short_sale_buy: int
    short_sale_sell: int
    short_sale_today_balance: int
    offset_loan_and_short: int


class MarginPurchaseResponse(BaseModel):
    ticker: str
    data: list[MarginPurchaseItem]
