import logging
import asyncpg
from app.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.db_dsn, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_stock_history(ticker: str, days: int = 90) -> list[dict]:
    """從 stock_history 資料表查詢指定股票的歷史資料。"""
    try:
        pool = await get_pool()
        rows = await pool.fetch(
            """
            SELECT date, open, high, low, close, volume
            FROM stock_history
            WHERE stock_id = $1
              AND date >= CURRENT_DATE - $2::int
            ORDER BY date ASC
            """,
            ticker,
            days,
        )
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get stock history for %s", ticker)
        raise


async def ensure_stock_history_table() -> None:
    """確保 stock_history 資料表存在（首次啟動時建立）。"""
    pool = await get_pool()
    await pool.execute(
        """
        CREATE TABLE IF NOT EXISTS stock_history (
            stock_id TEXT NOT NULL,
            date     DATE NOT NULL,
            open     NUMERIC,
            high     NUMERIC,
            low      NUMERIC,
            close    NUMERIC,
            volume   BIGINT,
            PRIMARY KEY (stock_id, date)
        );
        """
    )


async def get_watchlist() -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch(
            "SELECT ticker, name FROM watchlist ORDER BY created_at DESC"
        )
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get watchlist")
        raise


async def add_to_watchlist(ticker: str, name: str | None = None) -> None:
    try:
        pool = await get_pool()
        await pool.execute(
            """
            INSERT INTO watchlist (ticker, name, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (ticker) DO NOTHING
            """,
            ticker,
            name,
        )
    except Exception:
        logger.exception("Failed to add %s to watchlist", ticker)
        raise


async def remove_from_watchlist(ticker: str) -> None:
    try:
        pool = await get_pool()
        await pool.execute("DELETE FROM watchlist WHERE ticker = $1", ticker)
    except Exception:
        logger.exception("Failed to remove %s from watchlist", ticker)
        raise


async def ensure_watchlist_table() -> None:
    pool = await get_pool()
    await pool.execute(
        """
        CREATE TABLE IF NOT EXISTS watchlist (
            ticker     TEXT PRIMARY KEY,
            name       TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )


# ── User auth ──────────────────────────────────────────────────────────────

async def create_users_table():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS app_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(200) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)


async def create_user(username: str, email: str, password_hash: str) -> dict:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO app_users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
                username, email, password_hash
            )
            return dict(row)
    except Exception:
        logger.exception("Failed to create user %s", username)
        raise


async def get_user_by_username(username: str) -> dict | None:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, username, email, password_hash FROM app_users WHERE username=$1",
                username
            )
            return dict(row) if row else None
    except Exception:
        logger.exception("Failed to get user by username %s", username)
        raise


async def get_user_by_id(user_id: int) -> dict | None:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, username, email FROM app_users WHERE id=$1",
                user_id
            )
            return dict(row) if row else None
    except Exception:
        logger.exception("Failed to get user by id %s", user_id)
        raise


# ── Per-user watchlist ──────────────────────────────────────────────────────

async def get_watchlist_for_user(user_id: int) -> list:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT ticker, name FROM watchlist WHERE user_id=$1 ORDER BY created_at",
                user_id
            )
            return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get watchlist for user %s", user_id)
        raise


async def add_to_watchlist_for_user(user_id: int, ticker: str, name: str | None = None):
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO watchlist (user_id, ticker, name) VALUES ($1, $2, $3) ON CONFLICT (user_id, ticker) DO NOTHING",
                user_id, ticker, name
            )
    except Exception:
        logger.exception("Failed to add %s to watchlist for user %s", ticker, user_id)
        raise


async def remove_from_watchlist_for_user(user_id: int, ticker: str):
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM watchlist WHERE user_id=$1 AND ticker=$2",
                user_id, ticker
            )
    except Exception:
        logger.exception("Failed to remove %s from watchlist for user %s", ticker, user_id)
        raise


async def ensure_user_watchlist_schema():
    """Add user_id column to watchlist if not exists, keep backward compat."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE
        """)
        # Add unique constraint per user+ticker if not exists
        await conn.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'watchlist_user_ticker_unique'
                ) THEN
                    ALTER TABLE watchlist ADD CONSTRAINT watchlist_user_ticker_unique UNIQUE (user_id, ticker);
                END IF;
            END $$;
        """)


# ── ETL run persistence ────────────────────────────────────────────────────

async def ensure_etl_runs_table():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS etl_runs (
                id SERIAL PRIMARY KEY,
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                trigger VARCHAR(20),
                status VARCHAR(20),
                total_rows INTEGER DEFAULT 0,
                errors JSONB DEFAULT '[]',
                tickers JSONB DEFAULT '[]'
            )
        """)


async def save_etl_run(started_at, finished_at, trigger: str, status: str, total_rows: int, errors: list, tickers: list):
    pool = await get_pool()
    import json
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO etl_runs (started_at, finished_at, trigger, status, total_rows, errors, tickers)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        """, started_at, finished_at, trigger, status, total_rows, json.dumps(errors), json.dumps(tickers))


async def get_last_etl_run() -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM etl_runs ORDER BY id DESC LIMIT 1"
        )
        if not row:
            return None
        d = dict(row)
        import json
        d["errors"] = json.loads(d["errors"]) if d["errors"] else []
        d["tickers"] = json.loads(d["tickers"]) if d["tickers"] else []
        return d


# ── Financial tables ────────────────────────────────────────────────────────

async def ensure_financial_statements_table() -> None:
    pool = await get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS stock_financial_statements (
            stock_id TEXT    NOT NULL,
            date     DATE    NOT NULL,
            type     TEXT    NOT NULL,
            value    NUMERIC,
            PRIMARY KEY (stock_id, date, type)
        );
        CREATE INDEX IF NOT EXISTS idx_fin_stmt_stock_date
            ON stock_financial_statements (stock_id, date DESC);
    """)


async def ensure_month_revenue_table() -> None:
    pool = await get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS stock_month_revenue (
            stock_id      TEXT    NOT NULL,
            date          DATE    NOT NULL,
            revenue       BIGINT,
            revenue_month INTEGER,
            revenue_year  INTEGER,
            PRIMARY KEY (stock_id, date)
        );
        CREATE INDEX IF NOT EXISTS idx_month_rev_stock_date
            ON stock_month_revenue (stock_id, date DESC);
    """)


async def get_financial_statements(ticker: str, limit: int = 12) -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch("""
            SELECT date, type, value
            FROM stock_financial_statements
            WHERE stock_id = $1
            ORDER BY date DESC
            LIMIT $2
        """, ticker, limit)
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get financial statements for %s", ticker)
        raise


async def get_month_revenue(ticker: str, months: int = 24) -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch("""
            SELECT date, revenue, revenue_month, revenue_year
            FROM stock_month_revenue
            WHERE stock_id = $1
            ORDER BY date DESC
            LIMIT $2
        """, ticker, months)
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get month revenue for %s", ticker)
        raise


# ── Chips tables ─────────────────────────────────────────────────────────────

async def ensure_institutional_investors_table() -> None:
    pool = await get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS stock_institutional_investors (
            stock_id TEXT   NOT NULL,
            date     DATE   NOT NULL,
            name     TEXT   NOT NULL,
            buy      BIGINT DEFAULT 0,
            sell     BIGINT DEFAULT 0,
            PRIMARY KEY (stock_id, date, name)
        );
        CREATE INDEX IF NOT EXISTS idx_inst_inv_stock_date
            ON stock_institutional_investors (stock_id, date DESC);
    """)


async def ensure_margin_purchase_table() -> None:
    pool = await get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS stock_margin_purchase (
            stock_id                      TEXT   NOT NULL,
            date                          DATE   NOT NULL,
            margin_purchase_buy           BIGINT DEFAULT 0,
            margin_purchase_sell          BIGINT DEFAULT 0,
            margin_purchase_cash_repay    BIGINT DEFAULT 0,
            margin_purchase_today_balance BIGINT DEFAULT 0,
            short_sale_buy                BIGINT DEFAULT 0,
            short_sale_sell               BIGINT DEFAULT 0,
            short_sale_today_balance      BIGINT DEFAULT 0,
            offset_loan_and_short         BIGINT DEFAULT 0,
            PRIMARY KEY (stock_id, date)
        );
        CREATE INDEX IF NOT EXISTS idx_margin_stock_date
            ON stock_margin_purchase (stock_id, date DESC);
    """)


async def get_institutional_investors(ticker: str, days: int = 60) -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch("""
            SELECT date, name, buy, sell
            FROM stock_institutional_investors
            WHERE stock_id = $1
              AND date >= CURRENT_DATE - $2::int
            ORDER BY date DESC, name
        """, ticker, days)
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get institutional investors for %s", ticker)
        raise


async def get_margin_purchase(ticker: str, days: int = 60) -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch("""
            SELECT date,
                   margin_purchase_buy, margin_purchase_sell,
                   margin_purchase_cash_repay, margin_purchase_today_balance,
                   short_sale_buy, short_sale_sell,
                   short_sale_today_balance, offset_loan_and_short
            FROM stock_margin_purchase
            WHERE stock_id = $1
              AND date >= CURRENT_DATE - $2::int
            ORDER BY date DESC
        """, ticker, days)
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to get margin purchase for %s", ticker)
        raise
