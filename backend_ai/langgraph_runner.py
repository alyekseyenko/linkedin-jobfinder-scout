from langgraph.graph import StateGraph, START, END
from graph_state import JobGraphState
from graph_nodes import (
    node_scout,
    node_forensics,
    node_spy,
    node_strategist,
    node_crafter,
    node_reviewer,
    evaluate_graph_flow
)

def build_neural_graph() -> StateGraph:
    """Constructs the cyclical LangGraph state machine with concurrent fan-out."""
    workflow = StateGraph(JobGraphState)
    
    # 1. Add Nodes
    workflow.add_node("ScoutNode", node_scout)
    workflow.add_node("ForensicsNode", node_forensics)
    workflow.add_node("SpyNode", node_spy)
    workflow.add_node("StrategistNode", node_strategist)
    workflow.add_node("CrafterNode", node_crafter)
    workflow.add_node("ReviewerNode", node_reviewer)
    
    # 2. Parallel Fan-Out: Run Scout (job intelligence) & Forensics (web intel) concurrently!
    workflow.add_edge(START, "ScoutNode")
    workflow.add_edge(START, "ForensicsNode")
    
    # 3. Fan-In: Both converge into SpyNode
    workflow.add_edge("ScoutNode", "SpyNode")
    workflow.add_edge("ForensicsNode", "SpyNode")
    
    # 4. Sequential pipeline: Spy -> Strategist -> Crafter -> Reviewer
    workflow.add_edge("SpyNode", "StrategistNode")
    workflow.add_edge("StrategistNode", "CrafterNode")
    workflow.add_edge("CrafterNode", "ReviewerNode")
    
    # 5. Cyclical Logic: Reviewer -> Condition -> END or Revise (Crafter)
    workflow.add_conditional_edges(
        "ReviewerNode",
        evaluate_graph_flow,
        {
            "end": END,
            "revise": "CrafterNode"
        }
    )
    
    return workflow.compile()

# Instantiate the compiled graph globally for reuse
app_graph = build_neural_graph()

from memory_service import neural_memory

def run_neural_graph(job_data: dict, candidate_profile: str, candidate_skills: list[str], groq_key: str = None, gemini_key: str = None) -> dict:
    """
    Entry point to trigger the cyclical LangGraph workflow.
    Executes Scout and Forensics concurrently for minimum latency.
    """
    
    # 🧠 Recuperar preferências da memória de longo prazo (Mem0)
    memory_context = neural_memory.get_context_for_hunt()
    if memory_context:
        candidate_profile += f"\n\n{memory_context}"
    
    # Initial state payload
    initial_state = {
        "job_data": job_data,
        "candidate_profile": candidate_profile,
        "candidate_skills": candidate_skills,
        "groq_key": groq_key,
        "gemini_key": gemini_key,
        "scout_report": "",
        "forensics_report": "",
        "spy_report": "",
        "strategy_report": "",
        "detected_language": "en",
        "candidate_name": "",
        "draft_pitch": "",
        "linkedin_connect_note": "",
        "inmail_pitch": "",
        "reviewer_feedback": "",
        "pitch_approved": False,
        "revision_count": 0
    }
    
    # Execute the graph
    print("[LANGGRAPH] Booting Parallel Neural Graph Sequence (Scout + Forensics)...")
    final_state = app_graph.invoke(initial_state)

    
    # Extract results
    print(f"[LANGGRAPH] Sequence Complete. Total Revisions Needed: {final_state.get('revision_count') - 1}")
    
    return {
        "intelligence_report": final_state.get("scout_report", ""),
        "forensics_report": final_state.get("forensics_report", ""),
        "company_intel": final_state.get("spy_report", ""),
        "strategy_analysis": final_state.get("strategy_report", ""),
        "pitch_message": final_state.get("draft_pitch", ""),
        "linkedin_connect_note": final_state.get("linkedin_connect_note", ""),
        "inmail_pitch": final_state.get("inmail_pitch", ""),
        "detected_language": final_state.get("detected_language", "en"),
        "final_summary": f"Graph Execution Finished. Approved: {final_state.get('pitch_approved')}. Revisions: {final_state.get('revision_count') - 1}"
    }

