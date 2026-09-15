import os
import json
import logging
import time
from dotenv import load_dotenv

# Load root .env
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(root_env):
    load_dotenv(root_env)
load_dotenv()

from groq import Groq
import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")
try:
    from google import genai
except ImportError:
    import google.generativeai as genai
import requests
from duckduckgo_search import DDGS
from graph_state import JobGraphState
from graph_engine import neural_graph
from semantic_graph_service import semantic_engine
import asyncio

# 1. API Keys & Configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DEFAULT_GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
DEFAULT_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

# 2. Client Initializations
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def call_ollama(system_prompt: str, user_prompt: str, model: str = None, json_mode: bool = False) -> str:
    """Helper to communicate with an Ollama instance (local or via Docker host)."""
    ollama_hosts = []
    env_host = os.environ.get("OLLAMA_HOST", "").strip()
    if env_host:
        ollama_hosts.append(env_host)
    
    # Candidate endpoints for local development & Docker container-to-host bridge
    for candidate in ["http://host.docker.internal:11434", "http://localhost:11434", "http://127.0.0.1:11434"]:
        if candidate not in ollama_hosts:
            ollama_hosts.append(candidate)

    ollama_model = model or os.environ.get("OLLAMA_MODEL", "llama3.1:latest").strip()
    
    last_err = None
    for host in ollama_hosts:
        # Try OpenAI-compatible endpoint first
        try:
            endpoint = f"{host}/v1/chat/completions"
            payload = {
                "model": ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.3,
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            
            response = requests.post(endpoint, json=payload, timeout=180)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            last_err = e
            # Fall back to native /api/chat endpoint on same host
            try:
                endpoint_api = f"{host}/api/chat"
                payload_api = {
                    "model": ollama_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "stream": False,
                    "options": {
                        "temperature": 0.3
                    }
                }
                if json_mode:
                    payload_api["format"] = "json"
                
                response = requests.post(endpoint_api, json=payload_api, timeout=180)
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"]
            except Exception as e2:
                last_err = e2
                continue

    raise Exception(f"All Ollama endpoints failed ({ollama_hosts}): {last_err}")



def call_model(system_prompt: str, user_prompt: str, model: str = None, json_mode: bool = False, groq_key: str = None, gemini_key: str = None) -> str:
    """
    NEURAL FALLBACK LOGIC:
    - Primary: Groq (Fast Inference)
    - Fallback: Google (Gemini Flash Latest)
    - Local Fallback / Alternative: Ollama (Offline)
    """
    # Use provided keys or fall back to environment/hardcoded
    active_groq_key = groq_key or GROQ_API_KEY
    active_gemini_key = gemini_key or GEMINI_API_KEY
    active_model = model or DEFAULT_GROQ_MODEL
    
    use_ollama = os.environ.get("USE_OLLAMA", "false").lower() == "true"
    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3.1:latest").strip()

    # If user explicitly configured Ollama as primary
    if use_ollama:
        try:
            print(f"[NEURAL OLLAMA] Calling local Ollama model {ollama_model} as primary...")
            return call_ollama(system_prompt, user_prompt, ollama_model, json_mode)
        except Exception as ollama_err:
            print(f"[NEURAL OLLAMA] Primary Ollama failed: {ollama_err}. Falling back to API keys...")

    # TENTATIVA 1: Groq
    if active_groq_key:
        try:
            current_groq = Groq(api_key=active_groq_key)
            response = current_groq.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=active_model,
                response_format={"type": "json_object"} if json_mode else None
            )
            return response.choices[0].message.content
        except Exception as groq_err:
            print(f"[NEURAL FALLBACK] Groq error ({str(groq_err)[:100]}). Falling back to Google Gemini...")

    # TENTATIVA 2: Gemini
    if active_gemini_key:
        try:
            gemini_prompt = f"ROLE: {system_prompt}\n\nTASK: {user_prompt}"
            if json_mode:
                gemini_prompt += "\n\nCRITICAL: Respond ONLY with a valid JSON object."

            if hasattr(genai, 'Client'):
                from google.genai import types
                client = genai.Client(api_key=active_gemini_key)
                config = types.GenerateContentConfig(
                    response_mime_type="application/json"
                ) if json_mode else None
                resp = client.models.generate_content(
                    model=DEFAULT_GEMINI_MODEL,
                    contents=gemini_prompt,
                    config=config
                )
                return resp.text
            else:
                genai.configure(api_key=active_gemini_key)
                temp_model = genai.GenerativeModel(DEFAULT_GEMINI_MODEL)
                resp = temp_model.generate_content(
                    gemini_prompt,
                    generation_config={"response_mime_type": "application/json"} if json_mode else None
                )
                return resp.text
        except Exception as gem_e:
            print(f"[NEURAL FALLBACK] Gemini failed. Error: {str(gem_e)}. Falling back to local Ollama...")

    # TENTATIVA 3: Ollama as a standard fallback
    try:
        print(f"[NEURAL FALLBACK] Attempting local Ollama model {ollama_model}...")
        return call_ollama(system_prompt, user_prompt, ollama_model, json_mode)
    except Exception as final_e:
        print(f"[NEURAL CRITICAL] All providers failed. Ollama error: {final_e}")
        return f"CRITICAL: All providers (Groq, Gemini, Ollama) failed. Error: {final_e}"
    
    return "ERROR: No valid API keys for Groq or Gemini provided."


from memory_service import neural_memory

def detect_job_language(text: str) -> str:
    text_lower = text.lower()
    pt_markers = ["experiência", "requisitos", "responsabilidades", "conhecimento", "remoto", "vaga", "empresa", "trabalho", "procuramos", "candidato", "licenciatura", "você", "estamos", "competências", "português", "híbrido"]
    es_markers = ["experiencia", "requisitos", "responsabilidades", "conocimientos", "remoto", "puesto", "empresa", "trabajo", "buscamos", "candidato", "usted"]
    
    pt_count = sum(1 for m in pt_markers if m in text_lower)
    es_count = sum(1 for m in es_markers if m in text_lower)
    
    if pt_count >= 2:
        return "pt"
    if es_count >= 2 and pt_count == 0:
        return "es"
    return "en"

def extract_candidate_name(profile_str: str) -> str:
    if not profile_str:
        return "Candidato"
    try:
        data = json.loads(profile_str)
        if isinstance(data, dict):
            name = data.get("personal_info", {}).get("name") or data.get("name")
            if name: return name
    except:
        pass
    for line in profile_str.splitlines():
        line_clean = line.strip()
        if line_clean.lower().startswith("name:") or line_clean.lower().startswith("nome:"):
            return line_clean.split(":", 1)[1].strip()
    return "Candidato"

def node_scout(state: JobGraphState) -> JobGraphState:
    """Analyzes the job posting deeply with language awareness and memory recall."""
    job = state["job_data"]
    title = job.get('title', 'Specialized Role')
    company = job.get('company', 'Target Company')
    description = job.get('description', '')
    
    # 1. Automatic Language Detection
    lang = detect_job_language(f"{title} {description}")
    
    # 2. Extract Candidate Name
    candidate_name = extract_candidate_name(state.get("candidate_profile", ""))
    
    # 3. Memory Recall (Past rejections / preferences)
    past_prefs = ""
    try:
        past_prefs = neural_memory.get_context_for_hunt()
    except Exception as e:
        print(f"[SCOUT MEMORY NOTICE] {e}")
        
    lang_directive = (
        "IMPORTANTE: Como o anúncio está em Português, responda com a análise em PORTUGUÊS (mantendo jargões técnicos universais em inglês)."
        if lang == "pt" else
        "IMPORTANT: As the job description is in English, respond in English."
    )
    
    system = f"You are an ex-McKinsey talent acquisition specialist turned AI analyst. You can read between the lines of any job description and decode what the company actually wants vs. what they officially say they want. You have a perfect eye for red flags, growth opportunities, and sub-text. {lang_directive}"
    
    memory_section = f"\nCANDIDATE HISTORICAL PREFERENCES & REJECTION SIGNALS:\n{past_prefs}\n" if past_prefs else ""
    
    user = f"""
    Perform a deep intelligence analysis of this job posting:
    TITLE: {title}
    COMPANY: {company}
    DESCRIPTION: {description[:3000]}
    {memory_section}
    
    Your analysis must include:
    1. **Real Requirements vs. Listed Requirements**
    2. **Seniority Level Signals**
    3. **Culture Signals**
    4. **Red Flags**
    5. **Opportunity Score (1-10)**
    
    Be concise, structured, and honest. Max 400 words.
    """
    report = call_model(system, user, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))
    return {
        "scout_report": report,
        "detected_language": lang,
        "candidate_name": candidate_name
    }

def node_forensics(state: JobGraphState) -> JobGraphState:
    """Gathers real-time global intelligence via web search and official LinkedIn data."""
    job = state["job_data"]
    description = job.get('description', '')
    company = job.get('company', 'Unknown Company')
    title = job.get('title', 'Position')
    
    # 1. AI-First Company Extraction (Self-Healing)
    if not company or "Unknown" in company:
        print("[FORENSICS] Metadata leak detected. Attempting AI recovery of company name...")
        extraction_system = "You are a specialized parser. Extract ONLY the company name from the job description text. If you cannot find it, return 'LinkedIn Partner'."
        extraction_user = f"JOB DESCRIPTION:\n{description[:2000]}"
        company = call_model(extraction_system, extraction_user, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key")).strip()
        print(f"[FORENSICS] AI Recovery successful: {company}")

    # 2. Fetch Official LinkedIn Data via Node Backend
    print(f"[FORENSICS] Fetching official corporate profile for {company}...")
    official_data = "No official corporate data available."
    try:
        company_slug = company.lower().replace(" ", "-").split("-")[0]
        backend_internal = os.environ.get("BACKEND_INTERNAL_URL") or ("http://neural-backend:3001" if os.path.exists('/.dockerenv') else "http://localhost:3001")
        response = requests.get(f"{backend_internal}/api/companies/{company_slug}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict):
                official_data = f"""
                OFFICIAL CORPORATE IDENTITY (LinkedIn):
                - Industry: {data.get('industry', 'N/A')}
                - Size: {data.get('size', 'N/A')} employees
                - Headquarters: {data.get('headquarters', 'N/A')}
                - Website: {data.get('website', 'N/A')}
                - About: {data.get('about', 'N/A')[:500] if data.get('about') else 'N/A'}...
                """
    except Exception as e:
        print(f"[FORENSICS WARNING] Official profile lookup failed: {str(e)}")


    # 3. Global Web Search for "Truth on the ground"
    print(f"[FORENSICS] Scanning global web data for {company}...")
    search_queries = [
        f"{company} global headquarters and international office locations countries",
        f"{company} {title} salary range glassdoor levels.fyi benchmarks",
        f"{company} recent financial news and scale of operations 2024-2026"
    ]
    
    combined_search_data = ""
    try:
        with DDGS() as ddgs:
            for query in search_queries:
                time.sleep(0.2) # Fast rate limit avoidance
                results = list(ddgs.text(query, max_results=2))
                for r in results:
                    combined_search_data += f"\n- {r['title']}: {r['body']}"
    except Exception as e:
        print(f"[FORENSICS ERROR] Web search failure: {str(e)}")
        combined_search_data = f"Web search limited or unavailable. Reason: {str(e)}"


    system = "You are a Global Strategic Intelligence Agent. Your job is to reconcile official corporate data with raw web intelligence to provide a '360° Forensic Report'."
    user = f"""
    Based on the official corporate profile and the raw web search results, provide a Global Forensics Brief for {company}:
    
    {official_data}
    
    RAW WEB DATA:
    {combined_search_data[:3000]}
    
    JOB CONTEXT:
    - Role: {title}
    - Description Excerpt: {description[:1000]}
    
    Provide:
    1. **Corporate Identity vs Reality**: How well do they match?
    2. **Confirmed HQ & Countries**: Where do they actually operate?
    3. **Estimated Salary DNA**: Global range for a {title}. (If search data is missing, provide a logical estimate based on the company's industry and scale from the job description).
    4. **Operational Scale**: Financials/News.
    5. **Verified Headquarters**: Specific city/country.
    
    Be objective. If web search data is missing, provide deep reasoning based on the 'Official Identity' and 'Job Context'.
    """
    report = call_model(system, user, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))
    return {"forensics_report": report}

def node_spy(state: JobGraphState) -> JobGraphState:
    """THE SOCIAL STALKER: Gathers company intelligence and analyzes the human factor."""
    job = state["job_data"]
    forensics = state.get("forensics_report", "")
    
    # NEW: Detect Hiring Manager/Social context
    hiring_manager = job.get('hiring_manager', 'Not identified')
    manager_role = job.get('hiring_manager_role', '')
    
    social_context = ""
    if hiring_manager != 'Not identified':
        social_context = f"The identified Hiring Manager is {hiring_manager} ({manager_role})."
    
    system = """
    You are THE SOCIAL STALKER & Bloomberg Analyst. You find patterns in company behavior and human signals.
    Your mission is to find the 'Emotional Hook' that will make the decision-maker trust the candidate.
    """
    user = f"""
    Provide actionable intelligence for the candidate applying to '{job.get('title')}' at '{job.get('company')}'.
    
    {social_context}
    
    FORENSIC INTEL (Live Web & Financials):
    {forensics[:1500]}
    
    Your intelligence brief must cover:
    1. **Company Snapshot & Current Momentum** (News/Financials)
    2. **Culture Intel** (The 'unwritten rules' of this firm)
    3. **Social Connection Strategy**: How to approach {hiring_manager} or the hiring team based on their role.
    4. **Interview Power Questions**: Questions that prove the candidate is already thinking like an insider.
    5. **Strategic Timing**: When and how to follow up.
    
    Be bold, specific, and psychological. Max 400 words.
    """
    report = call_model(system, user, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))
    return {"spy_report": report}

def node_strategist(state: JobGraphState) -> JobGraphState:
    """Aligns the candidate profile with the scout report using Deep RAG Evidence."""
    job = state["job_data"]
    scout_report = state["scout_report"]
    profile = state["candidate_profile"]
    skills = state["candidate_skills"]
    
    # NEW: Elite Proof Hunt via LightRAG
    print(f"[STRATEGIST] Hunting for deep technical evidence in the Knowledge Graph...")
    job_keywords = f"{job.get('title')} {' '.join(skills[:3])}"
    
    try:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        evidence = loop.run_until_complete(neural_graph.query_graph(
            f"Quais sao as provas reais, métricas e projetos do candidato relacionados com {job_keywords}? Foque em ROI e resultados técnicos.",
            mode="hybrid"
        ))
    except Exception as e:
        print(f"[STRATEGIST WARNING] Evidence hunt failed: {e}")
        evidence = "No deep evidence found. Use provided profile summary."

    # Semantica Graph Alignment (Zero-Hallucination Intersection)
    candidate_skills_set = semantic_engine.build_candidate_subgraph("candidate_master", skills, profile)
    job_skills_set = semantic_engine.build_job_subgraph(f"job_{job.get('id', '1')}", job.get('title', ''), job.get('description', ''))
    graph_align = semantic_engine.compute_deterministic_alignment(candidate_skills_set, job_skills_set)
    print(f"[SEMANTICA ENGINE] Match: {graph_align['match_score']}% | Matched: {graph_align['matched_skills']} | Missing: {graph_align['missing_skills']}")


    system = "You are an Elite Career Strategy Architect & Evidence Hunter. You perform an honest but favourable gap analysis. You know that hiring is emotional, and you craft narratives that make recruiters feel they NEED this candidate because of their PROVEN track record."
    user = f"""
    Based on the scout's analysis, Deep RAG evidence, and Semantica Graph Reasoning, perform a strategic profile alignment.
    
    SEMANTICA GRAPH PROVENANCE:
    - Verified Match Score: {graph_align['match_score']}%
    - Matched Skills (Deterministic): {', '.join(graph_align['matched_skills']) if graph_align['matched_skills'] else 'General engineering skills'}
    - Missing Skills (Deterministic): {', '.join(graph_align['missing_skills']) if graph_align['missing_skills'] else 'None detected'}
    - Provenance Trail: {graph_align['provenance']}
    
    CANDIDATE PROFILE: {profile}
    
    DEEP RAG EVIDENCE (From Knowledge Graph):
    {evidence}
    
    SCOUT REPORT:
    {scout_report}
    
    Your output must include:
    1. **DOMINANT STRENGTHS** (Backed by evidence)
    2. **CRITICAL GAPS**
    3. **THE ATOMIC ANGLE** (A unique narrative that connects your past victories to their future problems)
    4. **INTERVIEW STORYLINE**
    5. **WIN PROBABILITY**
    
    Concrete, specific, and metric-driven. Max 450 words.
    """
    report = call_model(system, user, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))
    return {"strategy_report": report}

def node_crafter(state: JobGraphState) -> JobGraphState:
    """Writes or revises the pitch in 3 distinct formats (LinkedIn connect note, InMail, full pitch)."""
    job = state["job_data"]
    scout_report = state.get("scout_report", "")
    strategy_report = state.get("strategy_report", "")
    feedback = state.get("reviewer_feedback", "")
    lang = state.get("detected_language", "en")
    candidate_name = state.get("candidate_name") or extract_candidate_name(state.get("candidate_profile", ""))
    
    revision_instruction = ""
    if feedback:
        revision_instruction = f"\n\n🚨 URGENT FEEDBACK FROM REVIEWER: You must revise your previous pitches. The reviewer said: '{feedback}'"

    lang_guideline = (
        "ESCREVA EM PORTUGUÊS (estilo profissional e direto de Portugal/Brasil, mantendo termos técnicos universais em inglês como 'pipeline', 'stack', 'cloud')."
        if lang == "pt" else
        "WRITE IN ENGLISH. Crisp, executive, solutions-oriented."
    )

    system = f"""
    You are an Elite Career Persuasion Copywriter & Social Engineering Specialist. 
    Your style is bold, direct, and solutions-oriented. You never beg for a job; you offer a strategic partnership that solves the company's specific problems.
    You use evidence as your primary weapon.
    
    {lang_guideline}
    
    You MUST output ONLY a valid JSON object with EXACTLY three distinct outreach formats:
    1. "linkedin_connect_note": A razor-sharp connection invitation note. CRITICAL: MAXIMUM 280 CHARACTERS. No exceptions.
    2. "inmail_pitch": A punchy 100-140 word direct message for InMail or email.
    3. "full_pitch": A 200-260 word executive pitch/cover letter backed by concrete metrics from the Strategy Alignment.
    """
    user = f"""
    Write the 3-channel persuasion package for '{job.get('title')}' at '{job.get('company')}'.
    CANDIDATE NAME: {candidate_name}
    
    STRATEGIC INTELLIGENCE:
    {strategy_report}
    
    {revision_instruction}
    
    CRITICAL RULES:
    - Respond ONLY with valid JSON in this exact structure:
    {{
      "linkedin_connect_note": "...",
      "inmail_pitch": "...",
      "full_pitch": "..."
    }}
    - linkedin_connect_note MUST BE UNDER 280 CHARACTERS. Focus on the single most impressive metric or hook.
    - SIGNATURE in full_pitch: End with "Com os melhores cumprimentos," (if Portuguese) or "Best regards," (if English) followed by {candidate_name}.
    - DO NOT use placeholders like [Your Name] or [Company Name].
    - Zero AI cliches ('In today's fast-paced world', 'I am thrilled to...', 'No mundo dinâmico de hoje', 'Venho por este meio', 'Cutting-edge', 'De ponta').
    """
    report = call_model(system, user, json_mode=True, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))

    
    connect_note = ""
    inmail = ""
    full_pitch = ""
    
    try:
        data = json.loads(report)
        connect_note = data.get("linkedin_connect_note", "").strip()
        inmail = data.get("inmail_pitch", "").strip()
        full_pitch = data.get("full_pitch", "").strip()
    except Exception as e:
        print(f"[CRAFTER NOTICE] JSON parsing fallback: {e}")
        full_pitch = report.strip()
        connect_note = full_pitch[:270] + "..." if len(full_pitch) > 270 else full_pitch
        inmail = full_pitch
        
    if len(connect_note) > 300:
        connect_note = connect_note[:295] + "..."

    current_count = state.get("revision_count", 0)
    return {
        "draft_pitch": full_pitch,
        "linkedin_connect_note": connect_note,
        "inmail_pitch": inmail,
        "revision_count": current_count + 1
    }

def node_reviewer(state: JobGraphState) -> JobGraphState:
    """THE MIRROR AGENT: Simulates a skeptical recruiter and enforces human-like elite quality."""
    full_pitch = state.get("draft_pitch", "")
    connect_note = state.get("linkedin_connect_note", "")
    inmail_pitch = state.get("inmail_pitch", "")
    scout_report = state.get("scout_report", "")
    spy_report = state.get("spy_report", "")
    lang = state.get("detected_language", "en")
    
    # Deterministic guardrail: LinkedIn note MUST be <= 300 chars
    if len(connect_note) > 300:
        print(f"[MIRROR AGENT] REJECTED: connect_note length ({len(connect_note)}) exceeds 300 chars.")
        return {
            "pitch_approved": False,
            "reviewer_feedback": f"The linkedin_connect_note has {len(connect_note)} characters. It MUST be under 280 characters to fit LinkedIn invitation constraints."
        }
    
    system = """
    You are THE MIRROR AGENT. You are a cynical, high-stakes headhunter who hates generic AI-generated fluff. 
    Your mission is to ensure the pitch is indistinguishable from a top 1% human expert.
    
    CRITICAL REJECTION TRIGGERS:
    - Character limit violation: linkedin_connect_note must strictly be under 300 characters.
    - Use of AI cliches: 'In today's fast-paced world', 'I am thrilled to...', 'Leveraging my...', 'As a...', 'Cutting-edge', 'Venho por este meio', 'No mundo dinâmico de hoje'.
    - Lack of specific evidence: If it doesn't mention a specific project or metric found in the strategy.
    - Too formal or too passive: We want bold, direct, and solutions-oriented.
    - Generic opening: If it starts with 'Dear Hiring Manager', 'Estimado recrutador', or 'I am writing to...'.
    
    Respond ONLY with a valid JSON object.
    """
    user = f"""
    Review this 3-channel pitch package. Target Language: {lang}.
    
    LINKEDIN NOTE ({len(connect_note)} chars):
    "{connect_note}"
    
    INMAIL PITCH:
    "{inmail_pitch}"
    
    FULL PITCH:
    "{full_pitch}"
    
    CONTEXT:
    {scout_report[:800]}
    {spy_report[:800]}
    
    Respond with ONLY a JSON object:
    {{
        "approved": true/false,
        "feedback": "Specific instructions to fix bot-like patterns or add missing evidence. If approved, write 'N/A'."
    }}
    """
    result_text = call_model(system, user, json_mode=True, groq_key=state.get("groq_key"), gemini_key=state.get("gemini_key"))

    
    try:
        data = json.loads(result_text)
        is_approved = data.get("approved", False)
        feedback = data.get("feedback", "Failed generic criteria.")
    except Exception as e:
        is_approved = True
        feedback = "N/A"
    
    if not is_approved:
        print(f"[MIRROR AGENT] REJECTED. Feedback: {feedback}")
    else:
        print(f"[MIRROR AGENT] APPROVED. 3-channel pitch is elite.")
        
    return {
        "pitch_approved": is_approved,
        "reviewer_feedback": feedback
    }


def evaluate_graph_flow(state: JobGraphState) -> str:
    """Conditional edge router after reviewing."""
    if state.get("pitch_approved", False):
        return "end"
    if state.get("revision_count", 0) >= 3:
        return "end"
    return "revise"
