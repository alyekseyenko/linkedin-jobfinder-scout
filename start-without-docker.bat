@echo off
setlocal enabledelayedexpansion
title LinkedIn Neural Scout Launcher (Non-Docker Mode)

echo ========================================================
echo         LINKEDIN NEURAL SCOUT (NON-DOCKER)
echo         Autonomous Career Intelligence Engine
echo ========================================================
echo.

REM Add Node.js to PATH if not already present
where node >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\nodejs" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
    )
)

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
echo [1/3] Starting AI Engine (Python - Port 8001)...
start "AI Engine (Python)" cmd /k "cd /d "%~dp0backend_ai" && set PATH=C:\Program Files\nodejs;%%PATH%% && python main.py"

echo [2/3] Starting Neural Backend (Node.js - Port 3001)...
start "Neural Backend (Node.js)" cmd /k "cd /d "%~dp0backend" && set PATH=C:\Program Files\nodejs;%%PATH%% && npm start"

echo [3/3] Starting Neural UI (React/Vite - Port 5173)...
start "Neural UI (React)" cmd /k "cd /d "%~dp0frontend" && set PATH=C:\Program Files\nodejs;%%PATH%% && npm run dev"

echo.
echo ========================================================
echo        SERVICES LAUNCHED IN SEPARATE WINDOWS!
echo ========================================================
echo Dashboard UI:    http://localhost:5173
echo AI Engine API:   http://localhost:8001/docs
echo Backend API:     http://localhost:3001/api/health
echo ========================================================
echo.

ping 127.0.0.1 -n 5 > nul
start http://localhost:5173

pause
