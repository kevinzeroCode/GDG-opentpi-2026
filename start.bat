@echo off
chcp 65001 >nul
title QuantDashboard AI - Launcher

echo ========================================
echo   QuantDashboard AI - One Click Start
echo ========================================
echo.

:: 0. 清除殘留的 Vite 程序（5173 / 5174 / 5175）
echo [0/4] Cleaning up old Vite processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174 " ^| findstr "LISTENING"') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175 " ^| findstr "LISTENING"') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
echo [OK] Ports cleared
echo.

:: 1. Start Dify Docker
echo [1/4] Starting Dify services...
docker compose -f "C:\Users\USER\Documents\GDG\dify\docker\docker-compose.yaml" up -d
if %errorlevel% neq 0 (
    echo [ERROR] Dify failed to start. Make sure Docker Desktop is running.
    pause
    exit /b 1
)
echo [OK] Dify is running on http://localhost:80
echo.

:: 2. Start DigiRunner
echo [2/4] Starting DigiRunner...
cd /d "%~dp0"
docker compose up -d digirunner
if %errorlevel% neq 0 (
    echo [ERROR] DigiRunner failed to start.
    pause
    exit /b 1
)
echo [OK] DigiRunner is running on http://localhost:31080
echo.

:: 3. Wait for DigiRunner to be ready
echo [3/4] Waiting for DigiRunner to be ready...
:wait_loop
curl -s -o nul -w "%%{http_code}" http://localhost:31080/dgrv4/login >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak >nul
    goto wait_loop
)
echo [OK] DigiRunner is ready
echo.

:: 4. Start frontend dev server
echo [4/4] Starting frontend dev server...
echo.
echo ========================================
echo   All services started!
echo   Frontend:    http://localhost:5173
echo   Dify:        http://localhost:80
echo   DigiRunner:  http://localhost:31080
echo ========================================
echo.
cd /d "%~dp0"
npm run dev
