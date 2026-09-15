# LinkedIn Neural Scout — Improvement Plan
### Perspetiva: Principal Staff Engineer · Objetivo: GitHub CV Tier-1

---

## Estado Actual (o que já está sólido)

| ✅ Feito | Qualidade |
|---|---|
| Zero-Trust Vault AES-256-GCM + PBKDF2 | ⭐⭐⭐⭐⭐ |
| 6-Agent LangGraph Swarm (Scout→Forensics→Evidence→Crafter→Judge) | ⭐⭐⭐⭐⭐ |
| 3-Tier Cascading Inference Router (>90% token savings) | ⭐⭐⭐⭐⭐ |
| BullMQ Worker isolado (sem setInterval) | ⭐⭐⭐⭐⭐ |
| Zod API Contracts (7 schemas) | ⭐⭐⭐⭐⭐ |
| Rate Limiter montado no Express | ⭐⭐⭐⭐⭐ |
| Test Suite Node.js — 9 suites, 397 linhas | ⭐⭐⭐⭐⭐ |
| Pytest AI Engine — cascading, cache, evals | ⭐⭐⭐⭐ |
| CI Pipeline multi-matrix (Node 20/22, Python 3.11/3.12) | ⭐⭐⭐⭐ |
| CORS whitelist + PII removida | ⭐⭐⭐⭐⭐ |
| requirements.txt pinado (16 deps) | ⭐⭐⭐⭐⭐ |
| Docker Compose 6 serviços com healthchecks | ⭐⭐⭐⭐⭐ |
| docs/ (ARCHITECTURE, SECURITY, API, AGENT_DESIGN, DEMO) | ⭐⭐⭐⭐ |
| CHANGELOG.md semantic versioning | ⭐⭐⭐⭐ |
| README com Demo + Arquitectura + Tests | ⭐⭐⭐⭐ |
| .env.demo para onboarding sem API keys | ⭐⭐⭐⭐ |

**Score actual: ~82/100**

---

## O que falta — 5 Milestones por Ordem de Impacto

---

## 🏔️ M1 — GitHub Presence
**⏱ 30 min | Impacto: +8 pts | SEM ISTO NÃO EXISTE PUBLICAMENTE**

> O projecto mais bem feito do mundo vale zero se não estiver publicado com o nome certo.

### Acções

- [ ] Criar repositório `linkedin-neural-scout` em github.com/new
- [ ] `git init && git add . && git commit -m "feat: initial release v2.0.0"`
- [ ] `git remote add origin https://github.com/SEU_USER/linkedin-neural-scout.git`
- [ ] `git push -u origin main`
- [ ] `git tag v2.0.0 && git push --tags` → cria Release visível no sidebar
- [ ] Substituir `your-username` no README pelo username real
- [ ] **Topics** → adicionar no GitHub Settings:
  ```
  langgraph  crewai  autonomous-agents  playwright  fastapi
  react  typescript  pgvector  bullmq  redis  llm  rag
  docker  vector-database  job-search-automation  ai-agents
  ```
- [ ] **Description** do repo:
  ```
  🧠 6-agent LangGraph career intelligence · AES-256-GCM Zero-Trust Vault ·
  Playwright HITL · pgvector semantic memory · 3-tier cascading inference router
  ```
- [ ] **Social Preview** → Settings → 1280×640px com stack badges + screenshot UI

---

## 🏔️ M2 — Demo Mode Backend Real
**⏱ 3-4h | Impacto: +5 pts**

> `.env.demo` existe. O backend ainda não o honra.
> Sem isto ninguém consegue testar — 95% das visitas saem sem ver nada.

### Ficheiros a criar

**`backend/routes/demo_routes.js`** — intercepta rotas reais e devolve respostas pré-calculadas
```javascript
// GET /api/jobs/crm → devolve 3 vagas demo com análise completa
// POST /api/jobs/analyze → devolve resultado instantâneo (sem AI call)
// GET /api/health → { status: 'ok', demo: true }
```

**`backend/demo/sample_analyses.json`** — 3 vagas realistas pré-analisadas
```json
[
  {
    "id": "demo_001",
    "title": "Senior AI Engineer",
    "company": "Anthropic",
    "score": 94,
    "tier_reached": "tier_3_elite",
    "pitch_message": "...",
    "matched_skills": ["Python", "LangGraph", "FastAPI"]
  }
]
```

**`backend/server.js`** — adicionar antes dos routers reais:
```javascript
if (process.env.DEMO_MODE === 'true') {
  app.use('/api', require('./routes/demo_routes'));
}
```

---

## 🏔️ M3 — README Final Polish
**⏱ 1h | Impacto: +3 pts**

> O README tem conteúdo duplicado (dois diagramas de arquitectura) e a secção
> "Principal AI Engineering Architecture" repete o que o diagrama já diz.

### Acções

- [ ] Remover ou fundir a secção `### 🧠 System Architecture & Dual-Memory Flywheel` (linha ~220)
  com o novo diagrama de arquitectura — estão a mostrar a mesma coisa duas vezes
- [ ] Adicionar badge de **Python version** e **Node version**:
  ```markdown
  [![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://python.org)
  [![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
  [![Tests](https://img.shields.io/badge/Tests-pytest%20%2B%20node%3Atest-brightgreen.svg)](.github/workflows/ci.yml)
  ```
- [ ] Remover `CV_sample.txt` do root — ficheiro pessoal que não deve ser público
- [ ] Adicionar secção `## 📐 Technical Decisions` com 5 bullet points explicando
  escolhas de design (pgvector vs Qdrant, LangGraph vs CrewAI, BullMQ vs setInterval)

---

## 🏔️ M4 — Testes Frontend (TypeScript)
**⏱ 2-3h | Impacto: +4 pts**

> O backend tem 397 linhas de testes. O frontend tem **zero**.
> Qualquer senior que olhe para o CI vai notar isto imediatamente.

### Instalar
```bash
cd frontend && npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
```

### Ficheiros a criar

**`frontend/src/__tests__/mcp-service.test.ts`**
```typescript
// Testa o cliente HTTP — fetchCRMJobs, getLinkedInAuthStatus, analyzeJob
// Mock do axios/fetch, verifica estrutura de resposta
```

**`frontend/src/__tests__/hooks.test.ts`**
```typescript
// Testa hooks customizados se existirem
```

**`frontend/vite.config.ts`** — adicionar:
```typescript
test: {
  environment: 'jsdom',
  globals: true,
}
```

**`frontend/package.json`** — adicionar script:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Adicionar ao CI `ci.yml`
```yaml
- name: Frontend Tests
  run: npm ci && npm test
  working-directory: ./frontend
```

---

## 🏔️ M5 — Features Wow Factor
**⏱ 5-7h | Impacto: +6 pts | Diferenciador sénior**

> Estas funcionalidades fazem um engineer sénior parar e ler o código.
> Não são obrigatórias para publicar — são o que distingue "bom" de "impressionante".

### M5.1 — SSE Streaming para Análises AI ⏱ 3h

Actualmente o `/api/ai/analyze` bloqueia 10-30s sem feedback.
Implementar **Server-Sent Events** com progresso em tempo real:

```
backend/routes/ai_bridge_routes.js → GET /api/ai/analyze/stream
  event: tier_1_complete  { score: 87, passes: true }
  event: tier_2_forensics { company_intel: "..." }
  event: pitch_ready      { pitch_message: "..." }
  event: complete         { full_result: {...} }
```

Frontend → barra de progresso por etapa durante análise.

### M5.2 — Métricas Prometheus-compatíveis ⏱ 1h

```javascript
// GET /api/metrics  (text/plain — Prometheus format)
jobs_analyzed_total 142
cache_hit_ratio 0.73
ai_latency_p95_ms 4200
queue_depth 3
vault_operations_total 89
```

Qualquer empresa com Grafana/Prometheus pode monitorizar instantaneamente.

### M5.3 — PDF Export por Job Card ⏱ 2h

O frontend já tem `jspdf` instalado mas nunca é usado.
Adicionar botão "Export Report" em cada JobCard que gera PDF com:
- Match score + matched skills
- Intelligence report
- Pitch message pronta a copiar
- Company intel

---

## 📊 Roadmap Visual

```
HOJE (30 min)
└── M1: Publicar no GitHub com nome + topics + description

AMANHÃ (4-5h)
├── M2: Demo Mode backend real (demo_routes.js + sample_analyses.json)
└── M3: README polish (remover duplicação + badges + CV_sample.txt)

DIA 3 (3h)
└── M4: Testes frontend com Vitest (mínimo 6 testes)

DIA 4-5 (5-7h — opcional mas wow)
└── M5: SSE Streaming + /api/metrics + PDF Export
```

---

## 🎯 Score Esperado por Milestone

| Após | Score | Delta |
|---|---|---|
| Hoje (base) | 82/100 | — |
| + M1 (GitHub) | 90/100 | +8 |
| + M2 (Demo) | 95/100 | +5 |
| + M3 (README) | 98/100 | +3 |
| + M4 (Frontend tests) | 102/100 → **tier-1** | +4 |
| + M5 (Wow features) | **Projecto de referência** | +6 |

---

> **Nota do Principal Engineer:** M1 é o único bloqueador real.
> M2 e M3 são o que transforma um "bom projeto local" num "projeto que as pessoas visitam e têm estrelas".
> M4 e M5 são o que faz um hiring manager dizer "este candidato pensa como sénior".
