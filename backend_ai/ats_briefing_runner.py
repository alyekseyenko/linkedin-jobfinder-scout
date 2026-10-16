"""Lightweight Scout + Strategist sequence for /ats CV tailoring (no Crafter/Reviewer/Tailor)."""
from graph_nodes import node_scout, node_strategist


def run_ats_briefing(
    job_data: dict,
    candidate_profile: str,
    candidate_skills: list,
    candidate_digest: dict | None = None,
    groq_key: str | None = None,
    gemini_key: str | None = None,
) -> dict:
    initial_state = {
        "job_data": job_data,
        "candidate_profile": candidate_profile,
        "candidate_skills": candidate_skills or [],
        "candidate_digest": candidate_digest or {},
        "agent_trace": [],
        "groq_key": groq_key,
        "gemini_key": gemini_key,
        "scout_report": "",
        "strategy_report": "",
        "revision_count": 0,
        "pitch_approved": False,
    }
    after_scout = {**initial_state, **node_scout(initial_state)}
    after_strategist = {**after_scout, **node_strategist(after_scout)}
    return {
        "scout_report": after_strategist.get("scout_report", ""),
        "strategy_analysis": after_strategist.get("strategy_report", ""),
        "detected_language": after_strategist.get("detected_language", "en"),
        "agent_trace": after_strategist.get("agent_trace") or [],
        "status": "success",
    }
