@echo off
echo [數據中台] 啟動 Redis + FastAPI...

REM 若想用 Docker 啟動（含 Redis）
REM docker compose up --build

REM 本機直接啟動（需先手動啟動 Redis，或跳過 cache）
cd /d %~dp0
pip install -r requirements.txt -q
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
