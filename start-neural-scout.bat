@echo off
setlocal enabledelayedexpansion
title LinkedIn Neural Scout Launcher

echo ========================================================
echo         LINKEDIN NEURAL SCOUT 2026
echo         Autonomous Career Intelligence Engine
echo ========================================================
echo.

REM 1. Check & Setup Environment File (.env)
if not exist ".env" (
    echo [SETUP] File .env not found. Creating from template .env.example...
    copy .env.example .env > nul
    echo [SUCCESS] .env created!
) else (
    echo [OK] .env file detected.
)

REM 2. Check & Setup Candidate CV File (user_cv.json)
if not exist "backend\user_cv.json" (
    echo [SETUP] backend\user_cv.json not found. Creating from template user_cv.json.example...
    copy backend\user_cv.json.example backend\user_cv.json > nul
    echo [SUCCESS] backend\user_cv.json created!
) else (
    echo [OK] backend\user_cv.json profile detected.
)

echo.
REM 3. Check if Docker Desktop engine is active
docker info > nul 2>&1
if errorlevel 1 (
    echo ========================================================
    echo [NOTICE] Docker Desktop is not running!
    echo ========================================================
    echo The microservices (PostgreSQL, AI Engine, Backend, UI)
    echo run inside Docker Desktop.
    echo.
    echo Please open Docker Desktop on your computer, wait a few
    echo seconds for it to start, and run this script again.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

echo [1/2] Launching containers via Docker Compose...
docker compose up -d

if errorlevel 1 (
    echo.
    echo [ERROR] Docker Compose failed to start containers.
    echo Checking logs...
    docker compose logs --tail=20
    pause
    exit /b 1
)

echo.
echo [2/2] Waiting for services to initialize...
ping 127.0.0.1 -n 6 > nul

echo ========================================================
echo        SYSTEM ONLINE AND READY!
echo ========================================================
echo Dashboard UI:    http://localhost:5173
echo Backend API:     http://localhost:3004/api/health
echo AI Engine API:   http://localhost:8001/docs
echo Arize Phoenix:   http://localhost:6006
echo ========================================================
echo To view logs:    docker compose logs -f
echo To stop system:  docker compose down
echo ========================================================
echo.

REM Automatically open browser
start http://localhost:5173

pause
