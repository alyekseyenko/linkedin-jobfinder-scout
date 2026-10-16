import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import uvicorn
from concurrent.futures import ThreadPoolExecutor

# Senior 2026: Observability Layer
from tracing_service import init_tracing
init_tracing()

if os.getenv("ENABLE_NEST_ASYNCIO", "false").lower() == "true":
    try:
        import nest_asyncio
        nest_asyncio.apply()
    except ImportError:
        pass

from langgraph_runner import run_neural_graph
from ats_briefing_runner import run_ats_briefing
from memory_service import neural_memory
from graph_engine import neural_graph

# ... (skipped some lines in mind, let's target specific lines)

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

app = FastAPI(
    title="Linked AI — CrewAI Neural Intelligence Service",
    description="4-agent CrewAI system for elite job opportunity analysis",
    version="1.0.0",
)

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        corr_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())
        request.state.correlation_id = corr_id
        start_time = time.time()
        response: Response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["x-correlation-id"] = corr_id
        response.headers["x-process-time-ms"] = str(duration_ms)
        return response

app.add_middleware(CorrelationIdMiddleware)
allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:5173,http://localhost:3000,http://localhost:3004,http://127.0.0.1:5173,http://127.0.0.1:3004"
)
allowed_origins_list = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=2)

@app.on_event("startup")
async def startup_event():
    """Inicializa os armazenamentos do Grafo no arranque do servidor com fallback tolerante a falhas."""
    print("[STARTUP] Inicializando Armazenamentos Neurais...")
    try:
        await neural_graph.rag.initialize_storages()
        print("[STARTUP] Grafo pronto para ingestao ✅")
    except Exception as e:
        print(f"[STARTUP WARN] Grafo em modo offline / fallback: {e}")


class JobAnalysisRequest(BaseModel):
    job_data: dict
    candidate_profile: str
    candidate_skills: list[str]
    candidate_digest: Optional[dict] = None
    groq_key: Optional[str] = None
    gemini_key: Optional[str] = None


class AtsBriefingResponse(BaseModel):
    scout_report: str = ""
    strategy_analysis: str = ""
    detected_language: Optional[str] = "en"
    agent_trace: Optional[list] = []
    status: str = "success"


class JobAnalysisResponse(BaseModel):
    intelligence_report: str
    forensics_report: str
    strategy_analysis: str
    pitch_message: str
    company_intel: str
    linkedin_connect_note: Optional[str] = None
    inmail_pitch: Optional[str] = None
    detected_language: Optional[str] = "en"
    final_summary: Optional[str] = None
    agent_trace: Optional[list] = []
    tailored_cv: Optional[dict] = None
    status: str = "success"


class MemoryAddRequest(BaseModel):
    text: str
    metadata: Optional[dict] = None


class GraphQueryRequest(BaseModel):
    query: str
    mode: Optional[str] = "hybrid"


class GraphIngestRequest(BaseModel):
    text: str


from semantic_cache import semantic_cache
from cascading_router import cascading_router
from evals_harness import evals_harness

class EvalPitchRequest(BaseModel):
    pitch: str
    candidate_skills: list[str] = []
    job_requirements: Optional[list[str]] = []

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Neural Forensics & Intelligence",
        "architecture": "Staff/Principal 2026 Tiered Inference",
        "cache_entries": semantic_cache.get_stats()["entries_count"],
        "agents": 5,
        "engine": "FastAPI + LangGraph + CascadingRouter"
    }

@app.get("/ai/cache/stats")
async def get_cache_stats():
    """Retorna estatísticas de economia de tokens e hit-ratio do cache semântico."""
    return semantic_cache.get_stats()

@app.post("/ai/cache/clear")
async def clear_cache():
    """Limpa o cache semântico em memória."""
    semantic_cache.clear()
    return {"status": "cache cleared"}

@app.post("/ai/eval/pitch")
async def evaluate_pitch_endpoint(request: EvalPitchRequest):
    """Avaliação rigorosa (LLM-as-a-Judge) contra alucinação e métricas de persuasão."""
    return evals_harness.evaluate_pitch(
        request.pitch,
        request.candidate_skills,
        request.job_requirements or []
    )

@app.post("/crew/ats-briefing", response_model=AtsBriefingResponse)
async def ats_briefing(request: JobAnalysisRequest):
    """Scout + Strategist only — feeds /ats CV tailor without running full LangGraph."""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            lambda: run_ats_briefing(
                request.job_data,
                request.candidate_profile,
                request.candidate_skills,
                request.candidate_digest or {},
                request.groq_key,
                request.gemini_key,
            ),
        )
        return AtsBriefingResponse(**result)
    except Exception as e:
        return AtsBriefingResponse(
            scout_report="",
            strategy_analysis=f"Briefing unavailable: {str(e)[:200]}",
            agent_trace=[{"agent": "Briefing", "tool": "error", "one_line": str(e)[:200]}],
            status="degraded",
        )


@app.post("/crew/analyze", response_model=JobAnalysisResponse)
async def analyze_job(request: JobAnalysisRequest):
    """
    Tiered Inference Cascade with Semantic Caching & LangGraph.
    Prevents token burn on low-fit jobs and eliminates redundant calls.
    """
    try:
        def graph_runner(job, profile, skills):
            return run_neural_graph(
                job,
                profile,
                skills,
                request.groq_key,
                request.gemini_key,
                request.candidate_digest or {},
            )

        # Execute through cascading router with automatic caching
        result = await cascading_router.execute_cascade(
            request.job_data,
            request.candidate_profile,
            request.candidate_skills,
            runner_fn=graph_runner
        )
        return JobAnalysisResponse(**result)
    except Exception as e:
        # Resilient fallback with triage synthesis
        triage = cascading_router.fast_triage(request.job_data, request.candidate_skills, request.candidate_profile)
        skills_hint = ", ".join(triage["matched_skills"][:3]) or "automation and production systems"
        company = triage["company"]
        title = triage["title"]
        fallback_msg = (
            f"I saw the {title} opening at {company}. "
            f"My background in {skills_hint} maps to what you described. "
            f"Happy to share a short example if useful."
        )
        return JobAnalysisResponse(
            intelligence_report=f"Resilient triage only. Estimated fit: {triage['preliminary_score']}%.",
            forensics_report=f"Matched skills: {', '.join(triage['matched_skills']) or 'None flagged'}.",
            strategy_analysis="Deterministic fallback. Re-run deep scan when the AI engine is online.",
            pitch_message=fallback_msg,
            linkedin_connect_note=fallback_msg[:280],
            inmail_pitch=fallback_msg,
            detected_language="en",
            company_intel=f"Company: {company}",
            final_summary="Completed via resilient English fallback",
            agent_trace=[{
                "agent": "Fallback",
                "tool": "triage",
                "one_line": f"LangGraph unavailable; preliminary fit {triage['preliminary_score']}%."
            }],
            tailored_cv=None,
            status="success"
        )


@app.post("/memory/add")
async def add_memory(interaction: MemoryAddRequest):
    """Grava um fato ou preferência na memória."""
    try:
        neural_memory.add_interaction(interaction.text, metadata=interaction.metadata)
        return {"status": "memory updated"}
    except Exception as e:
        return {"status": "memory fallback", "note": str(e)}

@app.get("/memory/all")
async def get_all_memories():
    """Recupera todas as memórias do usuário."""
    try:
        return neural_memory.get_preferences()
    except Exception as e:
        return {"status": "offline", "memories": [], "note": str(e)}

@app.post("/graph/query")
async def query_graph(request: GraphQueryRequest):
    """Consulta o Grafo de Conhecimento."""
    try:
        result = await neural_graph.query_graph(request.query, mode=request.mode)
        return {"result": result}
    except Exception as e:
        return {"result": f"Graph query offline fallback: {str(e)}"}

@app.post("/graph/ingest")
async def ingest_to_graph(request: GraphIngestRequest):
    """Ingere novo texto no Grafo de Conhecimento."""
    try:
        await neural_graph.ingest_document(request.text)
        return {"status": "ingested"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
