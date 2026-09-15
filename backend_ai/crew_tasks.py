from crewai import Task


def build_tasks(scout, strategist, crafter, spy, operator, job_data: dict):
    job_title = job_data.get("title", "Unknown Role")
    job_company = job_data.get("company", "Unknown Company")
    job_description = job_data.get("description", "No description provided.")
    job_location = job_data.get("location", "Unknown")

    job_context = f"""
    JOB TITLE: {job_title}
    COMPANY: {job_company}
    LOCATION: {job_location}
    
    FULL JOB DESCRIPTION:
    {job_description[:3000]}
    """

    # TASK 1 — Intelligence Scout
    task_scout = Task(
        description=(
            f"Perform a deep intelligence analysis of this job posting:\n\n{job_context}\n\n"
            "CRITICAL: If the COMPANY is listed as 'Unknown Company', your FIRST priority is to identify "
            "the actual company name from the FULL JOB DESCRIPTION provided. Look for company descriptions, "
            "links, or specific branding language.\n\n"
            "Your analysis must include:\n"
            "1. **Identified Company** — Confirm the real company name.\n"
            "2. **Real Requirements vs. Listed Requirements** — What are they actually hiring for?\n"
            "3. **Seniority Level Signals** — What level is this really? (Junior disguised as Senior?)\n"
            "4. **Culture Signals** — What does the language reveal about the company culture?\n"
            "5. **Red Flags** — Any warning signs candidates should know about?\n"
            "6. **Opportunity Score** (1-10) — How strong is this opportunity?\n"
            "Be concise, structured, and honest."
        ),
        expected_output=(
            "A structured intelligence report with 5 clearly labeled sections. "
            "Plain text, no markdown headers, just clear prose per section. Max 400 words."
        ),
        agent=scout,
    )

    # TASK 2 — Gap & Strength Analysis
    task_strategist = Task(
        description=(
            f"Based on the scout's analysis of this role ({job_title} at {job_company}), "
            "perform a strategic profile alignment analysis.\n\n"
            f"JOB CONTEXT:\n{job_context}\n\n"
            "Your output must include:\n"
            "1. **DOMINANT STRENGTHS** — Top 5 skills/experiences that make this candidate "
            "stand out for THIS specific role. Be specific to the job.\n"
            "2. **CRITICAL GAPS** — Maximum 3 genuine gaps, with a mitigation strategy for each.\n"
            "3. **UNIQUE ANGLE** — One compelling narrative this candidate should use that "
            "no other candidate can replicate.\n"
            "4. **INTERVIEW STORYLINE** — The career story arc this candidate should tell.\n"
            "5. **WIN PROBABILITY** — Realistic assessment of their chances (%) and why."
        ),
        expected_output=(
            "A strategic alignment document with 5 sections. "
            "Concrete, specific, no generic advice. Each strength tied to a specific job requirement. "
            "Max 450 words. "
            "IMPORTANT: At the end of your response, provide a JSON block enclosed in ```json ... ``` "
            "with two keys: 'matched_skills' (list of top 10 matching skills) and 'skills_gaps' (list of top 5 gaps)."
        ),
        agent=strategist,
        context=[task_scout],
    )

    # TASK 3 — Pitch Writing
    task_crafter = Task(
        description=(
            f"Using the scout's intelligence (especially the 'Identified Company' field) and the strategist's profile analysis, "
            f"write an elite pitch message for the role of '{job_title}' at the identified company.\n\n"
            "RULES:\n"
            "- Maximum 280 words. Every word must earn its place.\n"
            "- Open with a hook that is specific to THIS company, not a template.\n"
            "- Mention 2-3 specific achievements or projects that directly map to this role.\n"
            "- End with a confident, non-desperate call to action.\n"
            "- Tone: confident, direct, slightly informal but professional.\n"
            "- NO phrases like 'I am excited to apply', 'I believe I am a great fit', "
            "or any other corporate filler.\n"
            "- Write in English."
        ),
        expected_output=(
            "A ready-to-use pitch message in plain text. "
            "Structured in 3 paragraphs: Hook, Value Proof, Call to Action. "
            "Max 280 words."
        ),
        agent=crafter,
        context=[task_scout, task_strategist],
    )

    # TASK 4 — Company Intelligence
    task_spy = Task(
        description=(
            f"Provide actionable company intelligence for the candidate applying to "
            f"'{job_title}' at '{job_company}' in {job_location}.\n\n"
            "Your intelligence brief must cover:\n"
            "1. **Company Snapshot** — What does this company actually do and how do they make money?\n"
            "2. **Culture Intel** — What is it REALLY like to work there? (be realistic)\n"
            "3. **Interview Advantage Tips** — 3 specific things that impress their interviewers.\n"
            "4. **Power Questions** — 3 smart questions the candidate should ask THEM.\n"
            "5. **Strategic Timing** — Best approach strategy (email, LinkedIn, referral, etc.)\n"
        ),
        expected_output=(
            "A compact company intelligence brief with 5 sections. "
            "Practical, specific, actionable. No filler. Max 400 words."
        ),
        agent=spy,
    )

    # TASK 5 — Autonomous Form Operational Strategy
    task_operator = Task(
        description=(
            f"Synthesize the strategic findings from the Strategist and Crafter to prepare "
            f"the candidate's automated application execution plan for '{job_title}' at '{job_company}'.\n\n"
            "Produce an operational JSON summary under ```json ... ``` with:\n"
            "1. 'expected_screening_answers': Key-value map of typical screening questions and ideal candidate answers\n"
            "2. 'tailored_headline': One-line headline for the application\n"
            "3. 'ready_for_full_auto': Boolean indicating if the application can be submitted autonomously\n"
        ),
        expected_output=(
            "An operational autofill briefing with recommended form values, finishing with a ```json ... ``` block."
        ),
        agent=operator,
        context=[task_strategist, task_crafter],
    )

    return task_scout, task_strategist, task_crafter, task_spy, task_operator
