import asyncio
import logging
import threading
from datetime import date, timedelta, datetime as dt
from datetime import datetime, timezone
from typing import Any
import httpx
import asyncpg
from app.config import settings
from app.services.db_service import get_pool, save_etl_run, get_last_etl_run

logger = logging.getLogger(__name__)
_last_run_lock = threading.Lock()

# 預設追蹤股票清單（會與 watchlist 合併）
DEFAULT_TICKERS = ["2330", "2317", "2454", "2412", "2308"]

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"

# 最後一次執行的狀態
_last_run: dict[str, Any] = {
    "status": "never",
    "started_at": None,
    "finished_at": None,
    "tickers": [],
    "total_rows": 0,
    "errors": [],
}


async def _get_last_date(pool: asyncpg.Pool, ticker: str) -> str:
    """查詢 DB 中該股票最新的日期，決定增量起始點。"""
    row = await pool.fetchrow(
        "SELECT MAX(date) AS last_date FROM stock_history WHERE stock_id = $1",
        ticker,
    )
    if row and row["last_date"]:
        # 從最新日期的隔天開始抓，避免重複
        next_day = row["last_date"] + timedelta(days=1)
        return next_day.strftime("%Y-%m-%d")
    # 第一次同步：抓近兩年
    two_years_ago = datetime.now(timezone.utc) - timedelta(days=730)
    return two_years_ago.strftime("%Y-%m-%d")


async def _fetch_finmind(ticker: str, start_date: str) -> list[dict]:
    """從 FinMind API 抓取單支股票資料。"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            FINMIND_URL,
            params={
                "dataset": "TaiwanStockPrice",
                "data_id": ticker,
                "start_date": start_date,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != 200:
        raise ValueError(f"FinMind 回傳錯誤：{data.get('msg', 'unknown')}")

    return data.get("data", [])


async def _insert_rows(pool: asyncpg.Pool, ticker: str, rows: list[dict]) -> int:
    """批次寫入 stock_history，已存在的資料跳過。"""
    if not rows:
        return 0

    values = [
        (
            row["stock_id"],
            dt.strptime(row["date"], "%Y-%m-%d").date(),  # 字串轉 date 物件
            float(row["open"]),
            float(row["max"]),
            float(row["min"]),
            float(row["close"]),
            int(row["Trading_Volume"]),
        )
        for row in rows
    ]

    await pool.executemany(
        """
        INSERT INTO stock_history (stock_id, date, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (stock_id, date) DO NOTHING
        """,
        values,
    )
    return len(values)


async def _get_tickers_to_sync(pool: asyncpg.Pool) -> list[str]:
    """合併預設清單與 watchlist 中的股票代號。"""
    try:
        rows = await pool.fetch("SELECT ticker FROM watchlist")
        watchlist = [r["ticker"] for r in rows]
    except Exception:
        logger.exception("Failed to fetch watchlist tickers")
        watchlist = []

    combined = list(set(DEFAULT_TICKERS + watchlist))
    return combined


async def run_etl(manual: bool = False) -> dict:
    """
    執行完整 ETL：對所有追蹤的股票做增量同步。
    manual=True 表示手動觸發（API 呼叫），False 表示排程自動觸發。
    """
    global _last_run

    trigger = "manual" if manual else "scheduler"
    from datetime import datetime
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

    print(f"🔄 ETL 開始 ({trigger}) — {started}")

    pool = await get_pool()
    tickers = await _get_tickers_to_sync(pool)
    total_rows = 0
    errors = []

    for ticker in tickers:
        try:
            start_date = await _get_last_date(pool, ticker)
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            if start_date > today:
                print(f"  ⏭  {ticker} 資料已是最新，跳過")
                continue

            rows = await _fetch_finmind(ticker, start_date)
            inserted = await _insert_rows(pool, ticker, rows)
            total_rows += inserted
            print(f"  ✅ {ticker}：新增 {inserted} 筆（從 {start_date}）")

            # 避免打太快被 FinMind 限流
            await asyncio.sleep(0.5)

        except Exception as e:
            msg = f"{ticker}: {e}"
            errors.append(msg)
            print(f"  ❌ {msg}")

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

    # Persist to DB (best effort — don't crash ETL if DB write fails)
    try:
        from datetime import datetime as _dt
        asyncio.get_event_loop().create_task(
            save_etl_run(
                _dt.fromisoformat(started),
                _dt.fromisoformat(finished),
                trigger,
                status,
                total_rows,
                errors,
                tickers,
            )
        )
    except Exception:
        logger.exception("Failed to persist ETL run to DB")

    print(f"✅ ETL 完成 — 共新增 {total_rows} 筆，錯誤 {len(errors)} 個")
    return _last_run


async def get_last_run_status() -> dict:
    """Return last ETL status; prefer DB, fall back to in-memory."""
    try:
        db_run = await get_last_etl_run()
        if db_run:
            return db_run
    except Exception:
        logger.exception("Failed to fetch last ETL run from DB")
    return _last_run
