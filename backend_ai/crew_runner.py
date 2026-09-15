from crewai import Crew, Process
from crew_agents import build_agents
from crew_tasks import build_tasks


def run_crew(job_data: dict, candidate_profile: str, candidate_skills: list[str]) -> dict:
    """
    Orchestrate the 5-agent crew to produce a complete job intelligence package.
    Returns a structured dict with all agent outputs.
    """
    scout, strategist, crafter, spy, operator = build_agents(candidate_profile, candidate_skills)
    task_scout, task_strategist, task_crafter, task_spy, task_operator = build_tasks(
        scout, strategist, crafter, spy, operator, job_data
    )

    crew = Crew(
        agents=[scout, strategist, crafter, spy, operator],
        tasks=[task_scout, task_strategist, task_crafter, task_spy, task_operator],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()

    # Extract individual task outputs
    task_outputs = crew.tasks
    
    def safe_output(task):
        try:
            return task.output.raw if task.output else ""
        except Exception:
            return ""

    strategist_raw = safe_output(task_strategist)
    
    # Attempt to extract JSON skills if present
    extracted_matched = []
    extracted_gaps = []
    if "```json" in strategist_raw:
        try:
            import json
            import re
            json_str = re.search(r'```json\n?(.*?)\n?```', strategist_raw, re.DOTALL).group(1)
            skills_data = json.loads(json_str)
            extracted_matched = skills_data.get("matched_skills", [])
            extracted_gaps = skills_data.get("skills_gaps", [])
            # Clean up the raw text by removing the JSON block for the UI report
            strategist_raw = strategist_raw.split("```json")[0].strip()
        except Exception as e:
            print(f"[AI PARSE ERROR] Failed to extract skills: {e}")

    return {
        "intelligence_report": safe_output(task_scout),
        "forensics_report": strategist_raw,
        "strategy_analysis": strategist_raw,
        "pitch_message": safe_output(task_crafter),
        "company_intel": safe_output(task_spy),
        "operator_plan": safe_output(task_operator),
        "final_summary": str(result),
        "matched_skills": extracted_matched,
        "skills_gaps": extracted_gaps
    }
