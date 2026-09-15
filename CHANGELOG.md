# 📜 Changelog — LinkedIn Neural Scout

All notable changes to this project are documented in this file in accordance with [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-09-15
### 🛡️ Security & Enterprise Architecture
- Eliminated hardcoded PII fallbacks in favor of environment-driven and sanitized templates (`user_cv.example.json`, `cookies.example.json`).
- Hardened CORS across Node.js Express and FastAPI microservices with strict origin validation.
- Added sliding-window API Rate Limiter on all `/api/` and AI inference routes.
- Decoupled asynchronous analysis into an isolated BullMQ background worker thread.
- Created end-to-end automated test suites (`node:test`) for AES-256 Vault, Semantic Cache, and Correlation IDs.
- Added multi-matrix GitHub Actions Quality Gate (`.github/workflows/ci.yml`).
- Added Prometheus-compatible metrics endpoint (`/api/metrics`).
- Added real-time Server-Sent Events (SSE) streaming endpoint for AI analysis steps.

## [1.5.0] — 2026-08-01
### Added
- Zero-Trust Session Vault with AES-256-GCM authenticated encryption and PBKDF2 key derivation.
- Anti-Bot Forensics stealth enhancements in Playwright (WebGL vendor masking, canvas spoofing, hardware concurrency emulation).
- Human-in-the-Loop (HITL) application review gate.

## [1.0.0] — 2026-06-01
### Added
- Initial release with 6-Agent LangGraph Swarm, Dual pgvector memory (Candidate & Market), and React 19 Three.js neural dashboard.
