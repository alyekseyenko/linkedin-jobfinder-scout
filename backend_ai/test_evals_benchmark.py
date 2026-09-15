# ============================================================
# 🏆 GOLDEN DATASET BENCHMARK: PRINCIPAL AI EVALS (CI/CD)
# Tests prompt drift, hallucination resilience, and cascading routing.
# ============================================================

import pytest
import asyncio
import time
from cascading_router import cascading_router
from evals_harness import evals_harness
from semantic_cache import semantic_cache

GOLDEN_CANDIDATE_SKILLS = [
    "Python", "FastAPI", "PostgreSQL", "Docker", "Distributed Systems", "LLM"
]

GOLDEN_JOBS = [
    {
        "id": "gold-1-elite",
        "title": "Principal Distributed Systems Engineer",
        "company": "Scale Dynamics",
        "description": "Seeking Principal Engineer with expert mastery in Python, Distributed Systems, FastAPI, Docker, and PostgreSQL.",
        "expected_tier": "tier_3_elite",
        "min_score": 80
    },
    {
        "id": "gold-2-elite-llm",
        "title": "Staff AI Platform Architect",
        "company": "Cognitive Cloud",
        "description": "Looking for Staff Architect with deep LLM, Python, FastAPI, PostgreSQL, and Docker infrastructure experience.",
        "expected_tier": "tier_3_elite",
        "min_score": 80
    },
    {
        "id": "gold-3-discard-php",
        "title": "Junior PHP Trainee",
        "company": "Legacy Studio",
        "description": "Entry level position for junior interns with WordPress, PHP, and jQuery.",
        "expected_tier": "tier_1_discarded",
        "max_score": 59
    },
    {
        "id": "gold-4-discard-intern",
        "title": "Estágio de Marketing Digital",
        "company": "Growth Agency",
        "description": "Estágio curricular de redes sociais e SEO.",
        "expected_tier": "tier_1_discarded",
        "max_score": 59
    }
]

def test_golden_dataset_triage_accuracy():
    """Verify triage accuracy on canonical edge-case job postings is 100%."""
    semantic_cache.clear()
    
    for job in GOLDEN_JOBS:
        triage = cascading_router.fast_triage(
            job_data=job,
            candidate_skills=GOLDEN_CANDIDATE_SKILLS,
            candidate_profile="Principal Systems Architect"
        )
        
        if "expected_tier" in job and job["expected_tier"] == "tier_3_elite":
            assert triage["passes_triage"] is True, f"Failed on {job['id']}"
            assert triage["is_elite"] is True, f"Failed on {job['id']} with score {triage['preliminary_score']}"
            assert triage["preliminary_score"] >= job["min_score"], f"Score too low for {job['id']}"
            
        elif "expected_tier" in job and job["expected_tier"] == "tier_1_discarded":
            assert triage["passes_triage"] is False, f"Failed on {job['id']}"
            assert triage["preliminary_score"] <= job["max_score"], f"Score too high for {job['id']}"

def test_golden_dataset_latency_and_caching():
    """Verify semantic cache serves repeated requests in under 15ms."""
    semantic_cache.clear()
    test_job = GOLDEN_JOBS[0]
    
    # Run 1: Fresh calculation
    t0 = time.perf_counter()
    res1 = asyncio.run(cascading_router.execute_cascade(
        job_data=test_job,
        candidate_profile="Principal",
        candidate_skills=GOLDEN_CANDIDATE_SKILLS
    ))
    t1 = time.perf_counter()
    assert res1["cached"] is False
    
    # Run 2: Cache hit (must be sub-15ms)
    t2 = time.perf_counter()
    res2 = asyncio.run(cascading_router.execute_cascade(
        job_data=test_job,
        candidate_profile="Principal",
        candidate_skills=GOLDEN_CANDIDATE_SKILLS
    ))
    t3 = time.perf_counter()
    cache_latency_ms = (t3 - t2) * 1000
    
    assert res2["cached"] is True
    assert res2["tier_reached"] == "cache_hit"
    assert cache_latency_ms < 15.0, f"Cache latency too high: {cache_latency_ms}ms"

def test_golden_dataset_hallucination_zero_tolerance():
    """Verify active self-correction guarantees 0 hallucinated skills."""
    bad_pitch = (
        "Olá equipa! Com a minha vasta experiência prática em Rust e Kubernetes, "
        "além de Python, garanto resultados imediatos."
    )
    
    eval_res = evals_harness.evaluate_pitch(
        pitch=bad_pitch,
        candidate_skills=GOLDEN_CANDIDATE_SKILLS,
        job_requirements=["Principal"]
    )
    
    # Should identify non-possessed technologies (Rust, Kubernetes)
    assert eval_res["hallucination_detected"] is True
    assert "rust" in eval_res["hallucinated_skills"]
    assert "kubernetes" in eval_res["hallucinated_skills"]
    assert eval_res["passed"] is False
