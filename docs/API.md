# 📡 Core API Specification

## 1. Authentication & System Health
- `GET /api/health/live` — Returns Kubernetes liveness status and system uptime.
- `GET /api/health/ready` — Verifies PostgreSQL/pgvector connectivity and microservice readiness.
- `GET /api/metrics` — Prometheus-compatible metrics stream (jobs processed, cache hits, latencies).

## 2. Jobs & Intelligence
- `GET /api/crm/jobs` — Retrieves stored opportunities with match scores and forensic packs.
- `POST /api/jobs/import` — Scrapes or parses an opportunity via direct URL or raw text description.
- `POST /api/jobs/:id/analyze` — Queues background asynchronous deep forensic analysis (HTTP 202).
- `GET /api/jobs/:id/analyze/status` — Polls the progress and completion status of the background analysis.
- `GET /api/ai/analyze/stream` — Real-time Server-Sent Events (SSE) telemetry stream for active AI reasoning.

## 3. Cognitive Engine (FastAPI :8001)
- `POST /analyze` — Direct invocation of the 3-Tier Cascading Multi-Agent LangGraph Swarm.
- `GET /cache/stats` — Metrics on semantic vector cache hit ratios and latency reductions.
