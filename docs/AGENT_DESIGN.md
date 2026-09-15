# 🤖 Multi-Agent LangGraph Architecture — Engineering Design

This document covers the design decisions, agent specifications, model choices, and
engineering rationale behind the Neural Scout autonomous intelligence pipeline.

---

## Why LangGraph over pure CrewAI?

**LangGraph** provides a deterministic, typed state machine that controls exactly which
agent runs next — critical when operating a Human-in-the-Loop system where runaway
reasoning loops during a live application session would be catastrophic.

**CrewAI** is used specifically for parallel, independent subtasks (company forensics +
web intelligence) that don't depend on each other's output.

| Concern | LangGraph | CrewAI |
|---|---|---|
| Sequential pipeline control | ✅ Deterministic | ❌ Emergent |
| Typed shared state (`JobGraphState`) | ✅ Native | ❌ Manual |
| Parallel subtask execution | ⚠️ Possible but verbose | ✅ Native |
| Self-correction loops (Reflexion) | ✅ Native cycle support | ❌ Not designed for it |
| Human-in-the-Loop checkpoint | ✅ `interrupt_before=["submit"]` | ❌ N/A |

**Decision:** LangGraph orchestrates the core 5-node sequential pipeline.
CrewAI handles the parallelisable company research phase as a tool node within LangGraph.

---

## Agent Specifications

### 1. 🎯 Neural Scout (Strategic Decoder)
- **Model:** Groq `llama-3.3-70b-versatile` — fast structured JSON, <2s latency
- **Input:** Raw job description (up to 15,000 tokens)
- **Output:** `{ required_skills[], seniority_level, red_flags[], green_flags[], role_archetype }`
- **Why Groq:** Tier 1 runs on every job — Groq's inference speed keeps triage cost near zero
- **Prompt strategy:** One-shot JSON schema enforcement via `response_format={"type":"json_object"}`

### 2. 🔬 Web Forensics (Company Intelligence)
- **Model:** Gemini Flash (multimodal, 1M token context)
- **Tool:** DuckDuckGo `DDGS` — no API key, no rate limits, no telemetry
- **Output:** Company news, funding rounds, Glassdoor signals, recent leadership changes
- **Why Gemini:** Long context window handles full search result dumps without chunking
- **Fallback:** Returns structured empty object — never blocks pipeline on offline search

### 3. 🗄️ Evidence Hunter (RAG Specialist)
- **Vector store:** PostgreSQL + `pgvector` (`candidate_memory` schema)
- **Strategy:** Cosine similarity search over quantified career achievements
- **Embedding model:** `@xenova/transformers` (local, offline, GDPR-compliant)
- **Why pgvector over Qdrant:** 100% local, zero cloud dependency, runs inside Docker Compose
- **Query template:** `"[years] experience with [skill] achieving [metric]"`

### 4. ✍️ Persuasion Crafter
- **Model:** Groq `deepseek-r1-distill-llama-70b` (reasoning model for persuasion chains)
- **Output constraints:** LinkedIn connect note ≤280 chars, InMail ≤800 chars
- **Prompt strategy:** Constrained structured output + anti-cliché system prompt
- **Banned phrases:** "thrilled to apply", "In today's fast-paced world", "synergy", "passionate"

### 5. ⚖️ Recruiter Mirror / Judge (LLM-as-a-Judge)
- **Model:** Groq `llama-3.3-70b` (same model as Scout for consistency)
- **Rubric dimensions:**
  - `hallucination_score` — checks all skills claimed against verified `candidate_skills[]`
  - `cliche_penalty` — pattern match against 40-phrase banned list
  - `cta_present` — verifies a clear call-to-action exists
  - `tone_match` — formal vs. casual calibration
- **Self-correction loop:** Max 2 iterations. Grade < B triggers rewrite request to Crafter
- **Hard stop:** Grade F after 2 iterations → returns best attempt with warning flag

---

## State Machine Flow

```
                     ┌─────────────────────────────────────┐
                     │         JobGraphState                │
                     │  job_data, candidate_profile,        │
                     │  matched_skills, tier_reached,       │
                     │  pitch_message, evaluation           │
                     └──────────────┬──────────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  1. scout_node      │  Groq llama-3.3-70b
                          │  Decode JD → JSON  │  ~1.5s, ~$0.001
                          └─────────┬──────────┘
                                    │
                     ┌──────────────▼──────────────────┐
                     │  2. forensics_node (parallel)    │  Gemini Flash
                     │  Company intel via DuckDuckGo   │  ~3s, ~$0.002
                     └──────────────┬──────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  3. evidence_node   │  pgvector RAG
                          │  Retrieve proofs   │  ~50ms, $0
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  4. crafter_node    │  Groq DeepSeek R1
                          │  Draft pitch       │  ~4s, ~$0.003
                          └─────────┬──────────┘
                                    │
                     ┌──────────────▼──────────────────────┐
                     │  5. judge_node (LLM-as-a-Judge)      │
                     │  Evaluate → [PASS | REFLEXION_LOOP]  │
                     └──────┬───────────────┬──────────────┘
                            │ PASS          │ FAIL (max 2x)
                            ▼               └──► crafter_node (retry)
                     ┌─────────────┐
                     │  RESULT     │
                     │  Approved   │
                     └─────────────┘
```

---

## Cascading Router — Token Cost Engineering

The 3-tier router prevents burning expensive LLM tokens on poor-fit jobs.

```
Tier 1 — Fast Triage         (FREE — deterministic heuristics)
  ├── Skill keyword regex matching (word boundary, case-insensitive)
  ├── Seniority level detection (junior/senior/lead/staff/principal)
  ├── Title keyword bonus scoring
  └── Score < 60% → discard immediately, save 100% LLM cost

Tier 2 — Standard Match      (Groq, ~$0.003/job)
  ├── Forensic alignment analysis
  ├── Gap analysis with remediation suggestions
  └── Score 60-79% → standard pitch with detected skills

Tier 3 — Elite Match         (Full 6-agent swarm, ~$0.006/job)
  ├── Company forensics + decision-maker intelligence
  ├── Evidence-backed quantified pitch
  ├── LLM-as-Judge self-correction loop
  └── Score ≥ 80% → maximum conviction pitch
```

**Result: >90% token cost reduction** vs. naive "analyze everything" approach.

---

## Semantic Cache Design

All analysis results are cached with a composite key:
`hash(title + company + description[:500])` → TTL: session

- **Hit latency:** <5ms (in-memory dict lookup)
- **Miss path:** Full cascade (Tier 1 → 3)
- **Cache invalidation:** Manual `POST /ai/cache/clear` or server restart

The cache is intentionally **ephemeral (in-memory)** — job descriptions change frequently
and stale analysis is worse than no analysis for high-stakes applications.
