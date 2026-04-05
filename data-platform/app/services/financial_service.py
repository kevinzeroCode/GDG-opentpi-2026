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


async def _get_last_stmt_date(pool: asyncpg.Pool, ticker: str) -> str:
    row = await pool.fetchrow(
        "SELECT MAX(date) AS last_date FROM stock_financial_statements WHERE stock_id = $1",
        ticker,
    )
    if row and row["last_date"]:
        next_day = row["last_date"] + timedelta(days=1)
        return next_day.strftime("%Y-%m-%d")
    # 首次同步：回溯 3 年（季報頻率低）
    return (datetime.now(timezone.utc) - timedelta(days=365 * 3)).strftime("%Y-%m-%d")


async def _get_last_revenue_date(pool: asyncpg.Pool, ticker: str) -> str:
    row = await pool.fetchrow(
        "SELECT MAX(date) AS last_date FROM stock_month_revenue WHERE stock_id = $1",
        ticker,
    )
    if row and row["last_date"]:
        next_day = row["last_date"] + timedelta(days=1)
        return next_day.strftime("%Y-%m-%d")
    # 首次同步：回溯 2 年
    return (datetime.now(timezone.utc) - timedelta(days=365 * 2)).strftime("%Y-%m-%d")


async def _fetch_finmind(dataset: str, ticker: str, start_date: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            FINMIND_URL,
            params={"dataset": dataset, "data_id": ticker, "start_date": start_date},
        )
        resp.raise_for_status()
        data = resp.json()
    if data.get("status") != 200:
        raise ValueError(f"FinMind 回傳錯誤：{data.get('msg', 'unknown')}")
    return data.get("data", [])


async def _insert_stmt_rows(pool: asyncpg.Pool, rows: list[dict]) -> int:
    if not rows:
        return 0
    values = [
        (
            row["stock_id"],
            datetime.strptime(row["date"], "%Y-%m-%d").date(),
            str(row["type"]),
            float(row["value"]) if row.get("value") is not None else None,
        )
        for row in rows
    ]
    await pool.executemany(
        """
        INSERT INTO stock_financial_statements (stock_id, date, type, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (stock_id, date, type) DO NOTHING
        """,
        values,
    )
    return len(values)


async def _insert_revenue_rows(pool: asyncpg.Pool, rows: list[dict]) -> int:
    if not rows:
        return 0
    values = [
        (
            row["stock_id"],
            datetime.strptime(row["date"], "%Y-%m-%d").date(),
            int(row["revenue"]) if row.get("revenue") is not None else 0,
            int(row.get("revenue_month", 0)),
            int(row.get("revenue_year", 0)),
        )
        for row in rows
    ]
    await pool.executemany(
        """
        INSERT INTO stock_month_revenue (stock_id, date, revenue, revenue_month, revenue_year)
        VALUES ($1, $2, $3, $4, $5)
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


async def run_financial_etl(manual: bool = False) -> dict:
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

    print(f"🔄 財務 ETL 開始 ({trigger}) — {started}")

    pool = await get_pool()
    tickers = await _get_tickers_to_sync(pool)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_rows = 0
    errors = []

    for ticker in tickers:
        # ── 季報 ──────────────────────────────────────────────────────────────
        try:
            start_date = await _get_last_stmt_date(pool, ticker)
            if start_date <= today:
                rows = await _fetch_finmind("TaiwanStockFinancialStatements", ticker, start_date)
                inserted = await _insert_stmt_rows(pool, rows)
                total_rows += inserted
                print(f"  ✅ {ticker} 財務報表：新增 {inserted} 筆")
        except Exception as e:
            msg = f"{ticker} 財務報表: {e}"
            errors.append(msg)
            print(f"  ❌ {msg}")

        await asyncio.sleep(0.3)

        # ── 月營收 ───────────────────────────────────────────────────────────
        try:
            start_date = await _get_last_revenue_date(pool, ticker)
            if start_date <= today:
                rows = await _fetch_finmind("TaiwanStockMonthRevenue", ticker, start_date)
                inserted = await _insert_revenue_rows(pool, rows)
                total_rows += inserted
                print(f"  ✅ {ticker} 月營收：新增 {inserted} 筆")
        except Exception as e:
            msg = f"{ticker} 月營收: {e}"
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

    print(f"✅ 財務 ETL 完成 — 共新增 {total_rows} 筆，錯誤 {len(errors)} 個")
    return _last_run


async def get_last_run_status() -> dict:
    return _last_run
