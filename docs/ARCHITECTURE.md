# 🏗️ Architecture Design & System Topology

The LinkedIn Neural Scout platform is built upon a distributed, fault-tolerant microservice architecture designed to execute autonomous career intelligence, deep forensic analysis, and human-in-the-loop workflows.

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (Port :5173)"]
        UI["React 19 + TypeScript + Three.js"]
        State["Framer Motion + Lucide + DnD Kit"]
    end

    subgraph Gateway["Core Backend Mesh (Node.js Express :3004)"]
        Router["REST & SSE Router"]
        Vault["Zero-Trust Session Vault (AES-256-GCM)"]
        Queue["BullMQ Worker & In-Memory Redis Engine"]
        Playwright["Playwright Stealth Engine (HITL Auto-Fill)"]
        Telemetry["SRE Correlation & OpenTelemetry Tracing"]
    end

    subgraph Data["Persistence & Vector Layer"]
        PG["PostgreSQL 16 + pgvector"]
        Mem["Candidate Memory & Market Memory"]
        Redis["Redis 7 (AOF Cache & Queue Store)"]
    end

    subgraph AI["Cognitive Layer (FastAPI :8001)"]
        Cascading["3-Tier Cascading Router (Groq / Gemini)"]
        Swarm["LangGraph Multi-Agent Swarm (Scout, Forensics, Crafter, Judge)"]
        Cache["Semantic Vector Cache (<5ms hit)"]
        Judge["LLM-as-a-Judge Hallucination Verifier"]
    end

    UI -->|"REST / EventStream (SSE)"| Router
    Router --> Vault
    Router --> Queue
    Router --> Playwright
    Router --> Telemetry

    Queue -->|"Async AI Jobs"| Cascading
    Router -->|"Sync AI Ingestion"| Cascading
    Cascading --> Swarm
    Swarm --> Cache
    Swarm --> Judge

    Router --> PG
    Queue --> PG
    PG --> Mem
    Queue --> Redis
```

---

## 🏛️ Component Responsibilities

1. **Presentation Layer (`frontend/`)**:
   - High-performance, 60 FPS React 19 interface with Three.js neural background.
   - Real-time SSE streaming for live inspection of multi-agent reasoning steps.
   - Interactive Kanban Pipeline with drag-and-drop mechanics.

2. **Core Backend Service (`backend/`)**:
   - Zero-Trust Session Vault with AES-256-GCM PBKDF2 encryption.
   - Dedicated BullMQ analysis worker isolated from Express event-loop.
   - Anti-bot evasive browser automation via Playwright with WebGL/Canvas spoofing.
   - Prometheus metrics endpoint (`/api/metrics`) and OpenTelemetry Correlation tracing.

3. **Cognitive AI Engine (`backend_ai/`)**:
   - 3-Tier Cascading Router that executes free/fast LLMs for initial triage and reserves elite models for final pitch crafting.
   - LangGraph collaborative multi-agent architecture with closed-loop validation.
   - LLM-as-a-Judge evaluator ensuring zero hallucinations against verified candidate knowledge.
