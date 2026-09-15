# Contributing to LinkedIn Neural Scout

First off, thank you for considering contributing to LinkedIn Neural Scout! Together, we can make AI-driven career discovery accessible, transparent, and completely free for job seekers worldwide.

---

## 🧭 Code of Conduct

- **Respect Privacy**: Never commit API keys, personal session cookies, or personal CV data.
- **Keep it Accessible**: All core features must function using free-tier LLM providers (Groq, Gemini) and local zero-cost databases (PostgreSQL + pgvector).
- **Be Helpful & Constructive**: Welcome new contributors and foster an open, collaborative environment.

---

## 🛠️ Getting Started with Development

### 1. Fork & Clone the Repository
```bash
git clone https://github.com/<your-username>/linkedin-neural-scout.git
cd linkedin-neural-scout
```

### 2. Configure Local Environment
```bash
cp .env.example .env
cp backend/user_cv.json.example backend/user_cv.json
```
Add your free API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`) to `.env`.

### 3. Run Locally with Docker
```bash
# Windows
.\start-neural-scout.bat

# Linux / macOS
chmod +x ./start-neural-scout.sh
./start-neural-scout.sh
```

---

## 📂 Architecture Overview

1. **`frontend/`**: React 19 + TypeScript + Vite + TailwindCSS. Modern UI/UX with real-time SSE streaming.
2. **`backend/`**: Node.js + Express. Orchestrates scrapers, manages candidate memory embeddings, and connects to PostgreSQL.
3. **`backend_ai/`**: Python FastAPI + LangGraph + CrewAI. 6-agent swarm for vacancy decoding, web forensics, and tailored pitch generation.
4. **`postgres/`**: PostgreSQL 16 with `pgvector` extension for local vector similarity search.

---

## 🚀 Submitting Pull Requests

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/awesome-feature
   ```
2. **Commit Your Changes**:
   ```bash
   git commit -m "feat: add support for custom resume templates"
   ```
3. **Push to Your Fork**:
   ```bash
   git push origin feature/awesome-feature
   ```
4. **Open a Pull Request** describing:
   - What problem does this PR solve?
   - How did you test it locally?
   - Any relevant screenshots or logs.

---

## 💡 Ideas for Contribution

- [ ] Additional job board parsers (Indeed, Glassdoor, RemoteOK, Wellfound)
- [ ] Export tailored pitches as styled PDF / DOCX
- [ ] Local LLM full offline support via Ollama
- [ ] Multi-language pitch generation (Spanish, French, German, Portuguese)
