from typing import TypedDict, List

class JobGraphState(TypedDict):
    """
    The state dictionary that carries data across the LangGraph nodes.
    """
    # Inputs
    job_data: dict
    candidate_profile: str
    candidate_skills: List[str]
    groq_key: str
    gemini_key: str
    
    # intermediate AI generations
    scout_report: str
    forensics_report: str
    spy_report: str
    strategy_report: str
    detected_language: str
    candidate_name: str
    
    # Pitch writing state
    draft_pitch: str
    linkedin_connect_note: str
    inmail_pitch: str
    reviewer_feedback: str
    pitch_approved: bool
    revision_count: int

