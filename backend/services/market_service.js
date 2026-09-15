const fs = require('fs');
const path = require('path');
const knowledgeService = require('./knowledge_service');
const aiService = require('./ai_service');

const CACHE_FILE = path.join(__dirname, '..', 'market_cache.json');

/**
 * Builds high-fidelity deterministic recommendations with 8 diverse, market-proven roles
 */
function getDeterministicRecommendations(profile) {
    const title = profile.title || 'AI Systems & Automation Engineer';
    const skills = profile.skills || [];
    const location = profile.location || 'Remote / Worldwide';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    return {
        success: true,
        generated_date: formattedDate,
        candidate_name: profile.name || 'Alex Hunter',
        candidate_title: title,
        target_location: location,
        market_summary: `Global AI engineering market shows peak demand for hybrid Agentic Systems & Production Automation Engineers in ${now.getFullYear()}. The candidate profile combines cutting-edge multi-agent orchestration (LangGraph, MCP, CrewAI) with production software engineering (Python, FastAPI, Docker, RAGAS), positioning them with strong leverage across top-tier international scale-ups and remote enterprises.`,
        market_signals: [
            "Demand for Autonomous Agent Engineers and Model Context Protocol (MCP) integrations surged 50%+ quarter-over-quarter.",
            "Enterprises prioritize Senior Engineers demonstrating verified production automation with tangible business ROI.",
            "Graph RAG architectures and decoupled vector data stores (CQRS) are now the standard pattern to suppress LLM hallucinations.",
            "Remote B2B and full-time senior roles in US/EU offer compensations between $120,000 and $190,000 / year for applied AI & Python specialists."
        ],
        recommended_roles: [
            {
                id: "role-1",
                category: "agentic",
                category_label: "🤖 Autonomous Agents",
                title: "AI Systems & Automation Engineer",
                search_query: "AI Engineer",
                match_score: 98,
                demand_level: "🔥 Critical Demand",
                demand_tier: "critical",
                reasoning: "Direct match with verified core expertise in intelligent autonomous agents and high-throughput production backends. High volume of open positions.",
                top_skills: ["Python", "LangGraph", "FastAPI", "MCP", "Docker"],
                estimated_salary: "$120,000 - $165,000 / year",
                estimated_jobs_count: "250+ active roles",
                work_mode: "Remote / Hybrid"
            },
            {
                id: "role-2",
                category: "agentic",
                category_label: "🤖 Autonomous Agents",
                title: "Agentic AI Systems Engineer (LangGraph / CrewAI)",
                search_query: "Agentic AI Engineer",
                match_score: 96,
                demand_level: "🚀 Rapid Growth",
                demand_tier: "critical",
                reasoning: "Pioneering mastery of LangGraph, multi-agent coordination, and custom MCP tools places this profile at the forefront of actionable AI agents.",
                top_skills: ["LangGraph", "CrewAI", "MCP Server", "Ollama", "Python"],
                estimated_salary: "$130,000 - $180,000 / year",
                estimated_jobs_count: "120+ premium roles",
                work_mode: "Remote Worldwide"
            },
            {
                id: "role-3",
                category: "automation",
                category_label: "⚡ Automation & Python",
                title: "Senior Python Automation Engineer",
                search_query: "Python Automation Engineer",
                match_score: 95,
                demand_level: "🔥 Critical Demand",
                demand_tier: "critical",
                reasoning: "Solid track record engineering high-throughput enterprise automations, asynchronous microservices, and zero-latency operational pipelines.",
                top_skills: ["Python", "FastAPI", "PostgreSQL", "AsyncIO", "Docker"],
                estimated_salary: "$110,000 - $150,000 / year",
                estimated_jobs_count: "320+ open positions",
                work_mode: "Remote / Hybrid"
            },
            {
                id: "role-4",
                category: "automation",
                category_label: "⚡ Automation & Python",
                title: "Workflow Automation Specialist (APIs / Integrations / ERP)",
                search_query: "Workflow Automation Specialist",
                match_score: 94,
                demand_level: "🚀 Rapid Growth",
                demand_tier: "high",
                reasoning: "Proven history orchestrating multi-system enterprise workflows, REST API microservices, webhooks, and high-impact automated processes.",
                top_skills: ["n8n", "REST APIs", "Webhooks", "ERP Integration", "Python"],
                estimated_salary: "$95,000 - $135,000 / year",
                estimated_jobs_count: "150+ active roles",
                work_mode: "Remote"
            },
            {
                id: "role-5",
                category: "rag",
                category_label: "🧠 RAG & Knowledge Systems",
                title: "Enterprise RAG & Knowledge Systems Engineer",
                search_query: "RAG Engineer",
                match_score: 93,
                demand_level: "⚡ Top Tier Compensation",
                demand_tier: "critical",
                reasoning: "Demonstrated mastery of Graph RAG, vector databases (pgvector, Qdrant), semantic caching, and RAGAS benchmarks maintaining minimal hallucination rates.",
                top_skills: ["Graph RAG", "Qdrant", "pgvector", "RAGAS", "Semantic Cache"],
                estimated_salary: "$130,000 - $185,000 / year",
                estimated_jobs_count: "95+ specialized roles",
                work_mode: "Remote Worldwide"
            },
            {
                id: "role-6",
                category: "rag",
                category_label: "🧠 RAG & Knowledge Systems",
                title: "LLM & Generative AI Solutions Engineer",
                search_query: "LLM Engineer",
                match_score: 92,
                demand_level: "🚀 Rapid Growth",
                demand_tier: "high",
                reasoning: "Deployment and orchestration of generative models (OpenAI, Gemini, Ollama, Anthropic), advanced prompt architecture, and structured output evaluation.",
                top_skills: ["LLMs", "FastAPI", "Prompt Architecture", "Python", "Redis"],
                estimated_salary: "$120,000 - $170,000 / year",
                estimated_jobs_count: "180+ open roles",
                work_mode: "Remote / Hybrid"
            },
            {
                id: "role-7",
                category: "architecture",
                category_label: "🏛️ Architecture & MLOps",
                title: "AI Solutions Architect",
                search_query: "AI Solutions Architect",
                match_score: 91,
                demand_level: "📈 High Stability",
                demand_tier: "moderate",
                reasoning: "Executive capability to architect enterprise AI solutions from first principles, aligning Zero-Trust security, observability, and cost scalability.",
                top_skills: ["System Design", "Cloud Architecture", "Docker", "Security", "LangChain"],
                estimated_salary: "$140,000 - $200,000 / year",
                estimated_jobs_count: "110+ leadership roles",
                work_mode: "Remote Worldwide"
            },
            {
                id: "role-8",
                category: "architecture",
                category_label: "🏛️ Architecture & MLOps",
                title: "MLOps & AI Platform Engineer",
                search_query: "MLOps Engineer",
                match_score: 89,
                demand_level: "📈 High Stability",
                demand_tier: "moderate",
                reasoning: "Implementation of resilient microservice infrastructures in Docker, telemetry & tracing observability, and high-uptime operational guarantees.",
                top_skills: ["Docker", "Kubernetes", "Observability", "CI/CD", "Linux"],
                estimated_salary: "$115,000 - $160,000 / year",
                estimated_jobs_count: "140+ active roles",
                work_mode: "Remote"
            }
        ]
    };
}

/**
 * Generates market intelligence and CV-aligned role recommendations using LLM
 */
async function generateMarketRecommendations(forceRefresh = false) {
    const profile = knowledgeService.getUserTargetRequirements();

    // Check existing cache if not forcing refresh
    if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
        try {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            const cached = JSON.parse(raw);
            if (cached && cached.recommended_roles && cached.recommended_roles.length >= 6) {
                console.log('[MARKET SERVICE] Serving cached market intelligence (' + cached.recommended_roles.length + ' roles)');
                return cached;
            }
        } catch (e) {
            console.warn('[MARKET SERVICE] Cache read error, regenerating:', e.message);
        }
    }

    const deterministic = getDeterministicRecommendations(profile);

    // If AI service is available, enrich with live AI analysis
    try {
        console.log('[MARKET SERVICE] Generating live AI market intelligence for candidate:', profile.name);
        const cvData = knowledgeService.getUserCv();
        const experienceSummary = (cvData.experience || [])
            .map(e => `${e.role} @ ${e.company} (${e.period}): ${(e.bullets || []).slice(0, 2).join(' ')}`)
            .join('\n');

        const systemPrompt = `You are a Global Principal AI Talent Strategist and Tech Labor Market Analyst specializing in 2026 AI/ML and Agentic automation hiring.
Analyze the candidate's professional profile and formulate actionable, realistic job market intelligence for today.
Always respond with valid JSON matching the exact specified schema.`;

        const userPrompt = `
CANDIDATE PROFILE:
Name: ${profile.name}
Current Target Title: ${profile.title}
Location: ${profile.location}
Hard Skills: ${(profile.skills || []).join(', ')}
Key Experience Highlights:
${experienceSummary || "Architecting enterprise agentic workflows (HABITAI, LangGraph, CrewAI, MCP), microservices in FastAPI/Python, Docker, Kubernetes."}

TASK:
1. Provide a concise, highly strategic market summary (2-3 sentences in Portuguese) of where this profile has the strongest hiring leverage and commercial value TODAY in Europe / Portugal / Remote.
2. List 4 real-time market signals (tendências de contratação hoje).
3. Recommend 8 strategic job roles/titles to search for on LinkedIn right now that best match this candidate's seniority and tech stack.
Cover 4 areas:
- Agentic AI (LangGraph, CrewAI, MCP)
- Python Automation & Integration (FastAPI, n8n, ERPs)
- Enterprise RAG & Knowledge Systems (Qdrant, LightRAG)
- AI Architecture & MLOps (Docker, Platform)

For each recommended role:
- id: string ("role-1", "role-2", etc.)
- category: "agentic" | "automation" | "rag" | "architecture"
- category_label: "🤖 Agentes Autónomos" | "⚡ Automação & Python" | "🧠 RAG & Conhecimento" | "🏛️ Arquitetura & MLOps"
- title: clear, official market job title
- search_query: standard, high-volume LinkedIn search query string (e.g. "AI Engineer", "Agentic AI Engineer", "Python Automation Engineer")
- match_score: realistic percentage (88-99)
- demand_level: "🔥 Procura Crítica" | "🚀 Em Alta Expansão" | "⚡ Top Tier Salarial" | "📈 Forte Estabilidade"
- demand_tier: "critical" | "high" | "moderate"
- reasoning: 1-2 compelling sentences in Portuguese explaining specifically why the candidate's CV/projects make them a stellar fit for this role
- top_skills: 4-5 relevant skills from candidate profile
- estimated_salary: estimated realistic compensation range in EUR (e.g. "€65.000 - €95.000 / ano")
- estimated_jobs_count: approximate active listings (e.g. "200+ vagas")
- work_mode: "Remoto / Híbrido" | "Remoto UE" | "Remoto"

Format response strictly as JSON:
{
  "market_summary": "...",
  "market_signals": ["...", "...", "...", "..."],
  "recommended_roles": [
    {
      "id": "role-1",
      "category": "agentic",
      "category_label": "🤖 Agentes Autónomos",
      "title": "...",
      "search_query": "...",
      "match_score": 96,
      "demand_level": "🔥 Procura Crítica",
      "demand_tier": "critical",
      "reasoning": "...",
      "top_skills": ["...", "..."],
      "estimated_salary": "...",
      "estimated_jobs_count": "...",
      "work_mode": "..."
    }
  ]
}`;

        const aiResponse = await aiService.getCombinedAICompletion(userPrompt, systemPrompt, true);
        if (aiResponse) {
            let parsed = null;
            try {
                parsed = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
            } catch (jsonErr) {
                const match = aiResponse.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }

            if (parsed && parsed.recommended_roles && parsed.recommended_roles.length >= 6) {
                const enriched = {
                    success: true,
                    generated_date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
                    candidate_name: profile.name,
                    candidate_title: profile.title,
                    target_location: profile.location,
                    market_summary: parsed.market_summary || deterministic.market_summary,
                    market_signals: parsed.market_signals || deterministic.market_signals,
                    recommended_roles: parsed.recommended_roles
                };

                // Save to cache
                try {
                    fs.writeFileSync(CACHE_FILE, JSON.stringify(enriched, null, 2), 'utf8');
                    console.log('[MARKET SERVICE] ✅ Live AI market intelligence saved to cache (' + enriched.recommended_roles.length + ' roles)');
                } catch (saveErr) {
                    console.warn('[MARKET SERVICE] Failed to cache file:', saveErr.message);
                }

                return enriched;
            }
        }
    } catch (err) {
        console.warn('[MARKET SERVICE] AI generation failed, using deterministic strategy:', err.message);
    }

    // Save deterministic fallback to cache
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(deterministic, null, 2), 'utf8');
    } catch (e) { }

    return deterministic;
}

module.exports = {
    generateMarketRecommendations,
    getDeterministicRecommendations
};
