# ============================================================
# 🧠 TEST SUITE: FASTAPI AI SERVICE & CORRELATION TRACING
# Automated Unit & Contract Validation Tests
# ============================================================

import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app, JobAnalysisRequest, MemoryAddRequest

client = TestClient(app)

def test_health_endpoint():
    """Verify health probe returns status ok with architecture details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert data["agents"] == 5

def test_correlation_id_auto_generation():
    """Verify correlation ID middleware auto-generates UUID when header absent."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "x-correlation-id" in response.headers
    assert len(response.headers["x-correlation-id"]) > 10
    assert "x-process-time-ms" in response.headers

def test_correlation_id_propagation():
    """Verify correlation ID middleware preserves distributed trace header."""
    custom_trace_id = "trace-staff-principal-uuid-999"
    response = client.get("/health", headers={"x-correlation-id": custom_trace_id})
    assert response.status_code == 200
    assert response.headers["x-correlation-id"] == custom_trace_id

def test_crew_analyze_validation_rejects_empty():
    """Verify Pydantic rejects invalid/empty payload for /crew/analyze with 422."""
    response = client.post("/crew/analyze", json={})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data

def test_crew_analyze_validation_rejects_missing_skills():
    """Verify Pydantic rejects job request missing required candidate_skills."""
    payload = {
        "job_data": {"title": "Staff Engineer"},
        "candidate_profile": "10 years experience"
        # missing candidate_skills
    }
    response = client.post("/crew/analyze", json=payload)
    assert response.status_code == 422

def test_memory_add_validation():
    """Verify memory add endpoint rejects payload missing 'text' field with 422."""
    response = client.post("/memory/add", json={"bad_field": 123})
    assert response.status_code == 422

def test_graph_ingest_validation():
    """Verify graph ingest rejects payload without text with 422."""
    response = client.post("/graph/ingest", json={"invalid": True})
    assert response.status_code == 422

def test_pydantic_schema_integrity():
    """Verify Pydantic models instantiate properly with valid inputs."""
    req = MemoryAddRequest(text="Expert in TypeScript and Distributed Systems", metadata={"source": "test"})
    assert req.text.startswith("Expert")
    assert req.metadata["source"] == "test"

    job_req = JobAnalysisRequest(
        job_data={"title": "Principal Architect"},
        candidate_profile="Bio",
        candidate_skills=["Python", "FastAPI", "PostgreSQL"]
    )
    assert job_req.candidate_skills == ["Python", "FastAPI", "PostgreSQL"]

def test_semantic_cache_lifecycle():
    """Verify semantic cache stores, retrieves, and accurately reports hits/misses."""
    from semantic_cache import semantic_cache
    semantic_cache.clear()

    title = "Staff Software Engineer"
    company = "Anthropic"
    desc = "We need an engineer experienced in Python, Kubernetes, and Distributed Systems."
    data = {"pitch": "Hello Anthropic", "score": 95}

    # Initial get -> Miss
    assert semantic_cache.get(title, company, desc) is None
    assert semantic_cache.misses == 1

    # Store
    semantic_cache.set(title, company, desc, data)

    # Secondary get -> Hit
    cached = semantic_cache.get(title, company, desc)
    assert cached is not None
    assert cached["pitch"] == "Hello Anthropic"
    assert semantic_cache.hits == 1

    stats = semantic_cache.get_stats()
    assert stats["hits"] == 1
    assert stats["entries_count"] == 1
    assert stats["estimated_tokens_saved"] > 0

def test_cascading_router_fast_triage():
    """Verify Tier 1 triage discards low-fit jobs and flags elite positions."""
    from cascading_router import cascading_router

    # Low fit job: Junior Frontend Angular (Candidate is Senior Python Backend)
    low_fit = {
        "title": "Junior Angular Developer",
        "company": "Legacy Corp",
        "description": "Looking for entry level with Angular and PHP."
    }
    candidate_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
    triage_low = cascading_router.fast_triage(low_fit, candidate_skills, "Backend Senior")
    assert triage_low["passes_triage"] is False
    assert triage_low["preliminary_score"] < 60

    # Elite fit job: Staff Backend Engineer (Python, PostgreSQL, Docker)
    elite_fit = {
        "title": "Staff Backend Engineer",
        "company": "Scale AI",
        "description": "Seeking Staff Engineer with deep expertise in Python, PostgreSQL, and Docker."
    }
    triage_elite = cascading_router.fast_triage(elite_fit, candidate_skills, "Staff Engineer")
    assert triage_elite["passes_triage"] is True
    assert triage_elite["is_elite"] is True
    assert "python" in triage_elite["matched_skills"]

def test_evals_harness_hallucination_penalty():
    """Verify EvalsHarness penalizes pitches containing hallucinated tech stack."""
    from evals_harness import evals_harness

    candidate_skills = ["Python", "PostgreSQL", "Docker"]

    # Pitch claiming Kubernetes and Rust (which candidate does NOT have)
    bad_pitch = (
        "Olá! Com a minha vasta experiência em Rust e Kubernetes, além de Python, "
        "gostaria de agendar uma conversa para explorar sinergias na vossa equipa."
    )
    res = evals_harness.evaluate_pitch(bad_pitch, candidate_skills, ["Backend"])
    assert res["hallucination_detected"] is True
    assert "rust" in res["hallucinated_skills"]
    assert "kubernetes" in res["hallucinated_skills"]
    assert res["passed"] is False

    # Valid pitch with real skills and clear CTA
    good_pitch = (
        "Olá! Notei a oportunidade na vossa empresa. Com experiência sólida em Python, "
        "PostgreSQL e Docker, desenvolvi sistemas de alta escala com resultados mensuráveis. "
        "Faria sentido uma conversa rápida de 10 minutos para explorar sinergias?"
    )
    res_good = evals_harness.evaluate_pitch(good_pitch, candidate_skills, ["Backend"])
    assert res_good["hallucination_detected"] is False
    assert res_good["has_cta"] is True
    assert res_good["passed"] is True
    assert res_good["grade"] in ["A", "B"]

def test_ai_cache_stats_and_eval_endpoints():
    """Verify FastAPI exposes semantic cache stats and on-demand pitch evaluation."""
    res_stats = client.get("/ai/cache/stats")
    assert res_stats.status_code == 200
    assert "hit_ratio_pct" in res_stats.json()

    eval_payload = {
        "pitch": "Olá, tenho interesse na vaga. Faria sentido uma call?",
        "candidate_skills": ["Python"]
    }
    res_eval = client.post("/ai/eval/pitch", json=eval_payload)
    assert res_eval.status_code == 200
    assert "grade" in res_eval.json()

def test_cascading_router_active_self_correction():
    """Verify that execute_cascade auto-refines hallucinated skills and appends missing CTA."""
    from cascading_router import cascading_router
    from semantic_cache import semantic_cache
    semantic_cache.clear()

    job_data = {
        "title": "Principal Architect",
        "company": "Vectara",
        "description": "We need a Principal Architect specializing in Python and PostgreSQL."
    }
    candidate_skills = ["Python", "PostgreSQL"]

    # 1. Custom runner that generates a BAD pitch containing hallucinated Kubernetes and missing CTA
    def bad_runner(job, profile, skills):
        return {
            "intelligence_report": "High fit",
            "forensics_report": "Great match",
            "strategy_analysis": "Direct outreach",
            # Hallucinated skill 'Kubernetes' (not in candidate_skills) & NO CTA
            "pitch_message": "Olá Vectara! Como especialista em Python, PostgreSQL e Kubernetes, sou ideal para a vaga.",
            "company_intel": "Vectara info",
            "final_summary": "Priority fit",
            "match_score": 90
        }

    result = asyncio.run(cascading_router.execute_cascade(
        job_data=job_data,
        candidate_profile="Expert",
        candidate_skills=candidate_skills,
        runner_fn=bad_runner
    ))

    # Output pitch MUST have hallucinated Kubernetes removed and missing CTA appended!
    pitch = result["pitch_message"]
    assert "Kubernetes" not in pitch
    assert "Faria sentido agendarmos uma breve conversa" in pitch or "conversa" in pitch
    assert result["pitch_evaluation"]["hallucination_detected"] is False


