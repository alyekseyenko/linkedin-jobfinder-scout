import os
from crewai import Agent, LLM

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Shared LLM via Groq (ultra-fast reasoning backbone)
llm = LLM(
    model="groq/llama-3.3-70b-versatile",
    api_key=GROQ_API_KEY,
    temperature=0.7,
    max_tokens=2048,
)

llm_fast = LLM(
    model="groq/llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    temperature=0.5,
    max_tokens=1024,
)


def build_agents(candidate_profile: str, candidate_skills: list[str]):
    """Build the 4-agent crew dynamically injecting the candidate profile."""

    profile_context = f"""
    CANDIDATE PROFILE:
    {candidate_profile}
    
    CANDIDATE SKILLS: {', '.join(candidate_skills)}
    """

    # AGENT 1 — Job Intelligence Scout
    scout = Agent(
        role="Senior Job Market Intelligence Analyst",
        goal=(
            "Deeply analyse a job posting and extract the hidden requirements, "
            "corporate culture signals, real seniority expectations, and salary "
            "positioning clues that most candidates miss."
        ),
        backstory=(
            "You are an ex-McKinsey talent acquisition specialist turned AI analyst. "
            "You can read between the lines of any job description and decode what "
            "the company actually wants vs. what they officially say they want. "
            "You have a perfect eye for red flags, growth opportunities, and "
            "the sub-text hidden in every bullet point."
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    # AGENT 2 — Strategic Profile Matchmaker
    strategist = Agent(
        role="Elite Career Strategy Architect",
        goal=(
            "Perform an honest but favourable gap analysis between the candidate "
            "profile and the job requirements. Identify which strengths to "
            "spotlight, which gaps to minimise, and what unique angle makes "
            "this candidate the most compelling choice for THIS specific role."
        ),
        backstory=(
            "You are a world-class career coach who has helped hundreds of "
            "professionals land roles they were only 60% qualified for on paper. "
            "You know that hiring is emotional, not logical, and you craft "
            "narratives that make recruiters feel they NEED this candidate. "
            f"\n\n{profile_context}"
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    # AGENT 3 — Persuasion & Pitch Crafter
    crafter = Agent(
        role="Elite Persuasion Specialist & Pitch Writer",
        goal=(
            "Write a devastatingly effective, highly personalised pitch / "
            "cover message for this specific job opportunity. The pitch must "
            "be concise, confident, memorable, and tailored to the company's "
            "culture and the role's unique requirements. Maximum 300 words."
        ),
        backstory=(
            "You are a viral copywriter and ex-Google recruiter. You know that "
            "generic cover letters are immediately binned. You write pitches "
            "that feel like they were written by someone who already works at "
            "the company, speaks their language, and radiates confidence. "
            f"\n\n{profile_context}"
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    # AGENT 4 — Company Intelligence Analyst
    spy = Agent(
        role="Corporate Intelligence & Competitive Research Analyst",
        goal=(
            "Provide actionable intelligence about the hiring company: "
            "their culture, recent news, challenges they are likely solving, "
            "what impresses their interviewers, and what the candidate should "
            "research before any interview. Give concrete, actionable advice."
        ),
        backstory=(
            "You are a combination of a Bloomberg analyst and an ex-recruiter "
            "from a top executive search firm. You find patterns in company "
            "behaviour, culture signals, and interview feedback to give "
            "candidates a decisive intelligence advantage before any interaction."
        ),
        llm=llm_fast,
        verbose=False,
        allow_delegation=False,
    )

    # AGENT 5 — Autonomous Application Operator (Executor)
    operator = Agent(
        role="Lead Autonomous Application Operator & Form Navigator",
        goal=(
            "Synthesize the candidate's authentic canonical profile, strategically resolve "
            "all application screening questions, and orchestrate the step-by-step "
            "browser autofill process with zero hallucination and maximum alignment."
        ),
        backstory=(
            "You are a senior automation engineer and browser navigation operator. "
            "You translate complex job requirements and ATS questionnaire forms "
            "into precise, tailored answers drawn directly from the candidate's canonical experience, "
            "ensuring seamless navigation through any multi-step application pipeline."
            f"\n\n{profile_context}"
        ),
        llm=llm,
        verbose=False,
        allow_delegation=False,
    )

    return scout, strategist, crafter, spy, operator
