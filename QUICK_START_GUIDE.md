# 🚀 Quick Start Guide — LinkedIn Neural Scout 2026

Welcome to **LinkedIn Neural Scout**! This guide gets your local autonomous recruitment engine running in under **3 minutes**.

---

## 📋 Prerequisites

Before starting, make sure you have installed on your machine:
1. **Docker Desktop** (Free download at [docker.com](https://www.docker.com/products/docker-desktop/))
2. **Git** (optional, for cloning the repository)

---

## ⚡ Step 1: 1-Click Launch

### Windows
Double-click the automatic launcher:
👉 **`start-neural-scout.bat`**

### Linux / macOS
Make executable and run:
```bash
chmod +x ./start-neural-scout.sh
./start-neural-scout.sh
```

This automated launcher will:
1. Create `.env` from the `.env.example` template if missing.
2. Create `backend/user_cv.json` from the `user_cv.json.example` template if missing.
3. Check if Docker is running.
4. Launch all 5 microservices via Docker.
5. Automatically open the Dashboard in your default browser at **`http://localhost:5173`**.

---

## 🛠️ Step 2: Configure Free API Keys (`.env`)

Open `.env` in your text editor (VS Code, Notepad, Cursor, etc.) and add your free keys:

```env
# 1. Groq API Key (Free - runs Llama 3.3 70B & DeepSeek R1 at hyper-speed)
GROQ_API_KEY=your_groq_api_key_here

# 2. Google Gemini Key (Free - for multimodal vision & reasoning)
GEMINI_API_KEY=your_gemini_api_key_here

# 3. LinkedIn Cookie (Optional - for deep search with login)
LINKEDIN_COOKIE=your_linkedin_li_at_cookie_here
```

> 💡 **Where to get free API keys?**
> - **Groq API**: Free at [console.groq.com](https://console.groq.com/)
> - **Google Gemini API**: Free at [aistudio.google.com](https://aistudio.google.com/)

---

## 👤 Step 3: Configure Your Candidate Profile (`backend/user_cv.json`)

Edit `backend/user_cv.json` with your real work history, skills, and contact details:

```json
{
  "personal_info": {
    "name": "YOUR NAME",
    "location": "City, Country",
    "email": "your.email@example.com",
    "title": "Your Target Role (e.g. Senior Full-Stack Engineer)"
  },
  "summary": "Summary of your professional experience...",
  "experience": [
    {
      "company": "COMPANY NAME",
      "role": "Your Role",
      "period": "2021 – Present",
      "bullets": [
        "Key achievement or measurable project impact 1",
        "Key achievement or measurable project impact 2"
      ]
    }
  ],
  "hard_skills": {
    "Web_Engineering": ["React", "TypeScript", "Node.js", "Python"]
  }
}
```

---

## 🎯 Step 4: Using the Dashboard

Open **[http://localhost:5173](http://localhost:5173)** in your browser:

### 1. Automated Job Search (HUNT)
- Enter target role (e.g., `Senior React Developer` or `AI Solutions Architect`).
- Select location (e.g., `Remote` or `Hybrid`).
- Click **`HUNT`**.

### 2. Direct Import by Link / Text (Zero LinkedIn Login Required)
- Click **`Import Vaga` / `Import Job`** in the Dashboard header.
- Paste any vacancy URL (LinkedIn, Indeed, RemoteOK, Glassdoor, company career portal) or paste raw job description text.
- Click **`Analisar Vaga ao Vivo` / `Analyze Live`**.
- The 6-Agent LangGraph Swarm will decode requirements, run web forensics, query your local candidate memory, and generate a customized high-impact pitch in real time!

---

## 🔗 Service Ports

| Service | Port / URL | Description |
| :--- | :--- | :--- |
| **Neural UI** | [http://localhost:5173](http://localhost:5173) | Main Application & Job Search Command Center |
| **AI Engine API** | [http://localhost:8001/docs](http://localhost:8001/docs) | FastApi Interactive OpenAPI Documentation |
| **PostgreSQL Database** | `localhost:5432` | Local PostgreSQL + pgvector Storage |
| **Qdrant Vector DB** | [http://localhost:6333/dashboard](http://localhost:6333/dashboard) | High-Performance Vector Storage |
| **Arize Phoenix** | [http://localhost:6006](http://localhost:6006) | Real-Time Agentic Tracing & Telemetry |

---

## ❓ Useful Commands

```bash
# View live logs across all containers
docker compose logs -f

# Stop all microservices
docker compose down

# Rebuild containers from scratch
docker compose up --build -d
```
