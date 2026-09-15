#!/usr/bin/env bash
# ============================================================
# 🧠 LINKEDIN NEURAL SCOUT — Unix / Linux / macOS Launcher
# ============================================================

set -e

echo "========================================================"
echo "         LINKEDIN NEURAL SCOUT 2026"
echo "         Autonomous Career Intelligence Engine"
echo "========================================================"
echo ""

# 1. Check & Setup Environment File (.env)
if [ ! -f ".env" ]; then
    echo "[SETUP] File .env not found. Creating from template .env.example..."
    cp .env.example .env
    echo "[SUCCESS] .env created!"
else
    echo "[OK] .env file detected."
fi

# 2. Check & Setup Candidate CV File (user_cv.json)
if [ ! -f "backend/user_cv.json" ]; then
    echo "[SETUP] backend/user_cv.json not found. Creating from template user_cv.json.example..."
    cp backend/user_cv.json.example backend/user_cv.json
    echo "[SUCCESS] backend/user_cv.json created!"
else
    echo "[OK] backend/user_cv.json profile detected."
fi

echo ""

# 3. Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "========================================================"
    echo "[NOTICE] Docker daemon is not running!"
    echo "========================================================"
    echo "The microservices (PostgreSQL, AI Engine, Backend, UI)"
    echo "run inside Docker containers."
    echo ""
    echo "Please start Docker Desktop / daemon and run this script again."
    echo "========================================================"
    exit 1
fi

echo "[1/2] Launching containers via Docker Compose..."
docker compose up -d

echo ""
echo "[2/2] Waiting for services to initialize..."
sleep 5

echo "========================================================"
echo "       SYSTEM ONLINE AND READY!"
echo "========================================================"
echo "Dashboard UI:    http://localhost:5173"
echo "AI Engine API:   http://localhost:8001/docs"
echo "Qdrant Storage:  http://localhost:6333/dashboard"
echo "Arize Phoenix:   http://localhost:6006"
echo "========================================================"
echo "To view logs:    docker compose logs -f"
echo "To stop system:  docker compose down"
echo "========================================================"
echo ""

# Try opening the browser across platforms
if which xdg-open > /dev/null; then
    xdg-open http://localhost:5173 > /dev/null 2>&1 &
elif which open > /dev/null; then
    open http://localhost:5173 > /dev/null 2>&1 &
fi
