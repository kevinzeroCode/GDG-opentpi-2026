import asyncio
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Any
import httpx
import asyncpg
from app.services.db_service import get_pool

logger = logging.getLogger(__name__)
_last_run_lock = threading.Lock()

DEFAULT_TICKERS = ["2330", "2317", "2454", "2412", "2308"]
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"

_last_run: dict[str, Any] = {
    "status": "never",
    "started_at": None,
    "finished_at": None,
    "tickers": [],
    "total_rows": 0,
    "errors": [],
}


async def _get_last_chips_date(pool: asyncpg.Pool, ticker: str, table: str) -> str:
    row = await pool.fetchrow(
        f"SELECT MAX(date) AS last_date FROM {table} WHERE stock_id = $1",
        ticker,
    )
    if row and row["last_date"]:
        next_day = row["last_date"] + timedelta(days=1)
        return next_day.strftime("%Y-%m-%d")
    # 首次同步：回溯 1 年（日頻資料量大）
    return (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")


async def _fetch_finmind(dataset: str, ticker: str, start_date: str) -> list[dict]:
    from app.config import settings
    params: dict = {"dataset": dataset, "data_id": ticker, "start_date": start_date}
    if settings.finmind_token:
        params["token"] = settings.finmind_token
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(FINMIND_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    if data.get("status") != 200:
        raise ValueError(f"FinMind 回傳錯誤：{data.get('msg', 'unknown')}")
    return data.get("data", [])


async def _insert_institutional_rows(pool: asyncpg.Pool, rows: list[dict]) -> int:
    if not rows:
        return 0
    values = [
        (
            row["stock_id"],
            datetime.strptime(row["date"], "%Y-%m-%d").date(),
            str(row["name"]),
            int(row.get("buy", 0)),
            int(row.get("sell", 0)),
        )
        for row in rows
    ]
    await pool.executemany(
        """
        INSERT INTO stock_institutional_investors (stock_id, date, name, buy, sell)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (stock_id, date, name) DO NOTHING
        """,
        values,
    )
    return len(values)


async def _insert_margin_rows(pool: asyncpg.Pool, rows: list[dict]) -> int:
    if not rows:
        return 0
    values = [
        (
            row["stock_id"],
            datetime.strptime(row["date"], "%Y-%m-%d").date(),
            int(row.get("MarginPurchaseBuy", 0)),
            int(row.get("MarginPurchaseSell", 0)),
            int(row.get("MarginPurchaseCashRepayment", 0)),
            int(row.get("MarginPurchaseTodayBalance", 0)),
            int(row.get("ShortSaleBuy", 0)),
            int(row.get("ShortSaleSell", 0)),
            int(row.get("ShortSaleTodayBalance", 0)),
            int(row.get("OffsetLoanAndShort", 0)),
        )
        for row in rows
    ]
    await pool.executemany(
        """
        INSERT INTO stock_margin_purchase (
            stock_id, date,
            margin_purchase_buy, margin_purchase_sell,
            margin_purchase_cash_repay, margin_purchase_today_balance,
            short_sale_buy, short_sale_sell,
            short_sale_today_balance, offset_loan_and_short
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (stock_id, date) DO NOTHING
        """,
        values,
    )
    return len(values)


async def _get_tickers_to_sync(pool: asyncpg.Pool) -> list[str]:
    try:
        rows = await pool.fetch("SELECT ticker FROM watchlist")
        watchlist = [r["ticker"] for r in rows]
    except Exception:
        logger.exception("Failed to fetch watchlist tickers")
        watchlist = []
    return list(set(DEFAULT_TICKERS + watchlist))


async def run_chips_etl(manual: bool = False) -> dict:
    global _last_run

    trigger = "manual" if manual else "scheduler"
    started = datetime.now().isoformat()

    with _last_run_lock:
        _last_run = {
            "status": "running",
            "started_at": started,
            "finished_at": None,
            "trigger": trigger,
            "tickers": [],
            "total_rows": 0,
            "errors": [],
        }

    print(f"🔄 籌碼 ETL 開始 ({trigger}) — {started}")

    pool = await get_pool()
    tickers = await _get_tickers_to_sync(pool)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_rows = 0
    errors = []

    for ticker in tickers:
        # ── 三大法人 ──────────────────────────────────────────────────────────
        try:
            start_date = await _get_last_chips_date(pool, ticker, "stock_institutional_investors")
            if start_date <= today:
                rows = await _fetch_finmind("TaiwanStockInstitutionalInvestorsBuySell", ticker, start_date)
                inserted = await _insert_institutional_rows(pool, rows)
                total_rows += inserted
                print(f"  ✅ {ticker} 三大法人：新增 {inserted} 筆")
        except Exception as e:
            msg = f"{ticker} 三大法人: {e}"
            errors.append(msg)
            print(f"  ❌ {msg}")

        await asyncio.sleep(0.3)

        # ── 融資融券 ──────────────────────────────────────────────────────────
        try:
            start_date = await _get_last_chips_date(pool, ticker, "stock_margin_purchase")
            if start_date <= today:
                rows = await _fetch_finmind("TaiwanStockMarginPurchaseShortSale", ticker, start_date)
                inserted = await _insert_margin_rows(pool, rows)
                total_rows += inserted
                print(f"  ✅ {ticker} 融資融券：新增 {inserted} 筆")
        except Exception as e:
            msg = f"{ticker} 融資融券: {e}"
            errors.append(msg)
            print(f"  ❌ {msg}")

        await asyncio.sleep(0.3)

    finished = datetime.now().isoformat()
    status = "error" if errors else "success"
    with _last_run_lock:
        _last_run = {
            "status": status,
            "started_at": started,
            "finished_at": finished,
            "trigger": trigger,
            "tickers": tickers,
            "total_rows": total_rows,
            "errors": errors,
        }

    print(f"✅ 籌碼 ETL 完成 — 共新增 {total_rows} 筆，錯誤 {len(errors)} 個")
    return _last_run


async def get_last_run_status() -> dict:
    return _last_run


async def fetch_and_save_institutional_on_demand(ticker: str, days: int = 60) -> None:
    """單支股票的即時補抓：直接向 FinMind 抓取後 upsert 到 DB。
    用於 Router cache-aside：DB 無資料時呼叫此函數，之後再從 DB 讀取。
    """
    start_date = (datetime.now(timezone.utc) - timedelta(days=days + 5)).strftime("%Y-%m-%d")
    rows = await _fetch_finmind("TaiwanStockInstitutionalInvestorsBuySell", ticker, start_date)
    if rows:
        pool = await get_pool()
        await _insert_institutional_rows(pool, rows)
