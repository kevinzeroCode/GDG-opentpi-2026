import asyncio
import os
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from app.services.etl_service import run_etl, get_last_run_status, _last_run
from app.services.financial_service import (
    run_financial_etl,
    get_last_run_status as get_financial_status,
    _last_run as _financial_last_run,
)
from app.services.chips_service import (
    run_chips_etl,
    get_last_run_status as get_chips_status,
    _last_run as _chips_last_run,
)

router = APIRouter(prefix="/api/etl", tags=["etl"])


@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    """手動觸發股價 ETL 同步（背景執行，立即回傳）。"""
    if _last_run.get("status") == "running":
        return {"message": "ETL 已在執行中，請稍後再試", "status": _last_run}
    background_tasks.add_task(run_etl, manual=True)
    return {"message": "ETL 已啟動，背景執行中", "check_status": "/api/etl/status"}


@router.get("/status")
async def get_status():
    """查詢最後一次股價 ETL 執行結果。"""
    return await get_last_run_status()


@router.get("/tickers")
async def get_tracked_tickers():
    """查詢下次 ETL 會同步的所有股票（預設 + watchlist + 曾查詢過的）。"""
    from app.services.db_service import get_pool
    from app.services.etl_service import _get_tickers_to_sync
    pool = await get_pool()
    tickers = await _get_tickers_to_sync(pool)
    return {"count": len(tickers), "tickers": sorted(tickers)}


@router.post("/sync/financial")
async def trigger_financial_sync(background_tasks: BackgroundTasks):
    """手動觸發財務 ETL（月營收 + 季報，背景執行）。"""
    if _financial_last_run.get("status") == "running":
        return {"message": "財務 ETL 已在執行中，請稍後再試", "status": _financial_last_run}
    background_tasks.add_task(run_financial_etl, manual=True)
    return {"message": "財務 ETL 已啟動，背景執行中", "check_status": "/api/etl/status/financial"}


@router.get("/status/financial")
async def get_financial_etl_status():
    """查詢最後一次財務 ETL 執行結果。"""
    return await get_financial_status()


@router.post("/sync/chips")
async def trigger_chips_sync(background_tasks: BackgroundTasks):
    """手動觸發籌碼 ETL（三大法人 + 融資融券，背景執行）。"""
    if _chips_last_run.get("status") == "running":
        return {"message": "籌碼 ETL 已在執行中，請稍後再試", "status": _chips_last_run}
    background_tasks.add_task(run_chips_etl, manual=True)
    return {"message": "籌碼 ETL 已啟動，背景執行中", "check_status": "/api/etl/status/chips"}


@router.get("/status/chips")
async def get_chips_etl_status():
    """查詢最後一次籌碼 ETL 執行結果。"""
    return await get_chips_status()


# ── Cloud Scheduler HTTP Trigger Endpoints ─────────────────────────────────
# 供未來 GCP Cloud Scheduler 定時打來觸發，使用 SCHEDULER_SECRET token 驗證
# 設定方式：在 .env 加入 SCHEDULER_SECRET=<隨機字串>
# Cloud Scheduler 在 Header 加入：X-Scheduler-Token: <同一個字串>

def _verify_scheduler_token(token: str | None) -> None:
    secret = os.environ.get("SCHEDULER_SECRET", "")
    if not secret or token != secret:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/tasks/stock", include_in_schema=False)
async def cloud_trigger_stock(
    background_tasks: BackgroundTasks,
    x_scheduler_token: str | None = Header(default=None),
):
    """Cloud Scheduler 觸發：股價 ETL（每日 18:05）。"""
    _verify_scheduler_token(x_scheduler_token)
    if _last_run.get("status") == "running":
        return {"message": "already running"}
    background_tasks.add_task(run_etl, manual=False)
    return {"message": "stock ETL triggered"}


@router.post("/tasks/chips", include_in_schema=False)
async def cloud_trigger_chips(
    background_tasks: BackgroundTasks,
    x_scheduler_token: str | None = Header(default=None),
):
    """Cloud Scheduler 觸發：籌碼 ETL（每日 18:30）。"""
    _verify_scheduler_token(x_scheduler_token)
    if _chips_last_run.get("status") == "running":
        return {"message": "already running"}
    background_tasks.add_task(run_chips_etl, manual=False)
    return {"message": "chips ETL triggered"}


@router.post("/tasks/financial", include_in_schema=False)
async def cloud_trigger_financial(
    background_tasks: BackgroundTasks,
    x_scheduler_token: str | None = Header(default=None),
):
    """Cloud Scheduler 觸發：財務 ETL（每月 1 日 09:00）。"""
    _verify_scheduler_token(x_scheduler_token)
    if _financial_last_run.get("status") == "running":
        return {"message": "already running"}
    background_tasks.add_task(run_financial_etl, manual=False)
    return {"message": "financial ETL triggered"}
