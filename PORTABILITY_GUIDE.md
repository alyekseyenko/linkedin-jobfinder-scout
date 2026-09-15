# 🌍 Neural Recruitment: Portability & Migration Guide

This project is designed for **High Portability**. Follow these steps to move the entire intelligence system to a new machine (Windows 10/11 recommended).

---

## 📦 1. What to Copy
Ensure you copy the **entire root folder**, including:
- `.env` (Critical: Contains your API Keys)
- `backend/mcp_engine/` (Contains the LinkedIn Scraper)
- `backend/linkedin_profile/` (Contains your logged-in LinkedIn session)
- `backend/knowledge_base.json` (Contains your learned identity)

## 🛠️ 2. New PC Prerequisites
Install the following core infrastructure:
1. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
2. **Node.js (v20+)**: [Download here](https://nodejs.org/)
3. **Python (3.10+)**: [Download here](https://www.python.org/)

## 🚀 3. Launch Sequence
On the new machine, open a terminal in the project root and run:

### Step A: Infrastructure
```powershell
docker compose up -d
```
*Wait for Qdrant (6333) and Phoenix (6006) to show "Healthy".*

### Step B: AI Engine
```powershell
cd backend_ai
pip install -r requirements.txt
python main.py
```

### Step C: Neural Backend
```powershell
cd ../backend
npm install
npm run dev
```

### Step D: UI
```powershell
cd ../frontend
npm install
npm run dev
```

---

## 🛡️ 4. Troubleshooting
- **LinkedIn Login**: If the browser opens asking for login, your `linkedin_profile` folder might have been corrupted during copy. Just log in once, and the session will be saved again.
- **Port 3001 Busy**: If Docker fails to start the backend, it's because you already have a local node server running. Use one or the other.
- **Access Denied (Docker)**: If you see "Acesso negado" or "mkdir" errors, ensure your `UV_CACHE_PATH` and `PLAYWRIGHT_CACHE_PATH` in `.env` are either empty (to use a local folder) or point to existing directories on your machine.
- **Venv Paths**: If the MCP fails with "Path not found", delete the `backend/mcp_engine/venv` folder and recreate it using `python -m venv venv` and reinstall the scraper.

**System Status**: 🟢 **Ready for Global Deployment** 🏹👁️💎🚀✨
