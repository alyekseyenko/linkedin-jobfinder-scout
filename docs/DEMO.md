# 🎮 Demo Mode — Run Without API Keys

This document explains how to run the full Neural Scout stack in **Demo Mode**, 
which uses pre-computed analysis results and requires no external API subscriptions.

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-neural-scout.git
cd linkedin-neural-scout

# Copy the demo environment file
cp .env.demo .env.local

# Launch all services in demo mode
docker compose --env-file .env.demo up
```

Open **http://localhost:5173** — the full UI, pipeline, and agent interface work
without any API key. Pre-computed analyses simulate a real session.

## What works in Demo Mode

| Feature | Demo Mode | Live Mode |
|---|---|---|
| Dashboard UI + Three.js visualisation | ✅ Full | ✅ Full |
| Job cards with analysis results | ✅ Pre-computed | ✅ Live AI |
| Pipeline Kanban board | ✅ Full | ✅ Full |
| Cascading Router logic | ✅ Simulated | ✅ Real |
| AES-256 Vault | ✅ Full | ✅ Full |
| BullMQ Worker | ✅ Full | ✅ Full |
| Playwright Auto-Fill | ❌ Requires LinkedIn session | ✅ Live |
| LangGraph 6-agent swarm | ❌ Returns pre-computed | ✅ Live |

## Switching to Live Mode

1. Get a free API key from [Groq Console](https://console.groq.com/) (≈$0.01/job)
2. Optionally get [Gemini API](https://aistudio.google.com/) (free tier available)
3. Copy `.env.example` to `.env` and fill in your keys
4. `docker compose up --build`
