import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.routers import stock, ai, watchlist, etl, auth, financial, chips
from app.services.db_service import (
    get_pool, close_pool,
    ensure_stock_history_table, ensure_watchlist_table,
    create_users_table, ensure_user_watchlist_schema,
    ensure_etl_runs_table,
    ensure_financial_statements_table, ensure_month_revenue_table,
    ensure_institutional_investors_table, ensure_margin_purchase_table,
)
from app.services.cache_service import close_redis
from app.services.etl_service import run_etl
from app.services.financial_service import run_financial_etl
from app.services.chips_service import run_chips_etl

scheduler = AsyncIOScheduler(timezone="Asia/Taipei")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動：連 DB
    try:
        await get_pool()
        await ensure_stock_history_table()
        await ensure_watchlist_table()
        await create_users_table()
        await ensure_user_watchlist_schema()
        await ensure_etl_runs_table()
        await ensure_financial_statements_table()
        await ensure_month_revenue_table()
        await ensure_institutional_investors_table()
        await ensure_margin_purchase_table()
        print("✅ 數據中台啟動成功（DB 已連線）")
    except Exception as e:
        print(f"⚠️  DB 連線失敗，部分功能不可用：{e}")

    # 排程：股價 — 每日 18:05
    scheduler.add_job(
        run_etl,
        CronTrigger(hour=18, minute=5, timezone="Asia/Taipei"),
        id="daily_etl",
        replace_existing=True,
    )
    # 排程：籌碼（三大法人 + 融資融券）— 每日 18:30
    scheduler.add_job(
        run_chips_etl,
        CronTrigger(hour=18, minute=30, timezone="Asia/Taipei"),
        id="daily_chips_etl",
        replace_existing=True,
    )
    # 排程：財務（月營收 + 季報）— 每月 1 日 09:00
    scheduler.add_job(
        run_financial_etl,
        CronTrigger(day=1, hour=9, minute=0, timezone="Asia/Taipei"),
        id="monthly_financial_etl",
        replace_existing=True,
    )
    scheduler.start()
    print("🕕 ETL 排程已啟動（股價 18:05 / 籌碼 18:30 / 財務每月 1 日）")

    yield

    # 關閉
    scheduler.shutdown(wait=False)
    await close_pool()
    await close_redis()
    print("🛑 數據中台已關閉")


app = FastAPI(
    title="QuantDashboard 數據中台",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router)
app.include_router(ai.router)
app.include_router(watchlist.router)
app.include_router(etl.router)
app.include_router(auth.router)
app.include_router(financial.router)
app.include_router(chips.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "QuantDashboard 數據中台"}
