const { Groq } = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');
const { getGroqApiKeys, hasGroqApiKeys } = require('./groq_keys');

let groq = null;
let gemini = null;
let cohere = null;

let groqApiKey = process.env.GROQ_API_KEY || '';
let geminiApiKey = process.env.GEMINI_API_KEY || '';
let cohereApiKey = process.env.COHERE_API_KEY || '';

function syncGroqClient() {
    const keys = getGroqApiKeys();
    groqApiKey = keys[0] || '';
    groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
}

async function withGroqKeyFallback(runWithClient) {
    const keys = getGroqApiKeys();
    if (!keys.length) {
        throw new Error('No Groq API keys configured');
    }
    let lastError;
    for (let i = 0; i < keys.length; i++) {
        const client = new Groq({ apiKey: keys[i] });
        try {
            return await runWithClient(client);
        } catch (e) {
            lastError = e;
            console.warn(`[GROQ] Key ${i + 1}/${keys.length} failed:`, e.message);
        }
    }
    throw lastError;
}

// Initialize default clients from env if available
syncGroqClient();
let genAI = null;
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.8-flash';

const DEPRECATED_GROQ_MODELS = new Set([
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile'
]);

function isGroqPromptTooLargeError(err) {
    const msg = String(err?.message || err || '');
    return /413|Request too large|tokens per minute/i.test(msg);
}

if (geminiApiKey) {
    genAI = new GoogleGenerativeAI(geminiApiKey);
    gemini = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
}
if (cohereApiKey) cohere = new CohereClient({ token: cohereApiKey });

/**
 * Dynamically reinitialize clients with new keys (from user config / database)
 */
function initAI(keys = {}) {
    if (keys.groqApiKey) {
        process.env.GROQ_API_KEY = keys.groqApiKey;
        syncGroqClient();
        console.log('[AI SERVICE] Groq AI Engine initialized dynamically');
    }
    if (keys.geminiApiKey && keys.geminiApiKey !== geminiApiKey) {
        geminiApiKey = keys.geminiApiKey;
        genAI = new GoogleGenerativeAI(geminiApiKey);
        gemini = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
        console.log('[AI SERVICE] Gemini AI Engine initialized dynamically');
    }
    if (keys.cohereApiKey && keys.cohereApiKey !== cohereApiKey) {
        cohereApiKey = keys.cohereApiKey;
        cohere = new CohereClient({ token: cohereApiKey });
        console.log('[AI SERVICE] Cohere Engine initialized dynamically');
    }
}

function getGroqModelCandidates() {
    const defaults = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
    const fromEnv = [process.env.GROQ_MODEL_PRIMARY, process.env.GROQ_MODEL_FAST].filter(
        (m) => m && !DEPRECATED_GROQ_MODELS.has(m)
    );
    const seen = new Set();
    const out = [];
    for (const m of [...defaults, ...fromEnv]) {
        if (m && !seen.has(m) && !DEPRECATED_GROQ_MODELS.has(m)) {
            seen.add(m);
            out.push(m);
        }
    }
    return out;
}

function getGeminiModelCandidates() {
    const deprecatedGemini = new Set(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash']);
    const fromEnv = [process.env.GEMINI_MODEL_PRIMARY].filter((m) => m && !deprecatedGemini.has(m));
    const defaults = [
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest'
    ];
    const seen = new Set();
    const out = [];
    for (const m of [...fromEnv, ...defaults]) {
        if (m && !seen.has(m)) {
            seen.add(m);
            out.push(m);
        }
    }
    return out;
}

async function tryOllamaCompletion(prompt, systemPrompt, isJson = false) {
    const useOllama = process.env.USE_OLLAMA !== 'false';
    const host = (process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '');
    if (!useOllama || !host) return null;
    const model = process.env.OLLAMA_MODEL || 'llama3.1:latest';
    const base = host.endsWith('/api') ? host.replace(/\/api$/, '') : host;
    const url = `${base}/api/chat`;
    try {
        console.log(`[AI SERVICE] L5: Attempting Ollama (${model})...`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                format: isJson ? 'json' : undefined
            })
        });
        if (!res.ok) {
            console.warn('[AI SERVICE] L5 Fail (Ollama):', res.status, await res.text().catch(() => ''));
            return null;
        }
        const data = await res.json();
        const text = data.message?.content || '';
        if (!text) return null;
        if (isJson) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : text;
        }
        return text;
    } catch (e) {
        console.warn('[AI SERVICE] L5 Fail (Ollama):', e.message);
        return null;
    }
}

/**
 * Universal AI Completion with multi-layer fallback (Groq model pool → Cohere → Gemini → Ollama)
 */
async function groqChatCompletion(model, prompt, systemPrompt, isJson) {
    const run = (userContent) =>
        withGroqKeyFallback((client) =>
            client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                model,
                max_tokens: isJson ? 8192 : 4096,
                response_format: isJson ? { type: 'json_object' } : undefined
            })
        );

    try {
        const completion = await run(prompt);
        return completion.choices[0].message.content;
    } catch (e) {
        if (!isGroqPromptTooLargeError(e) || prompt.length < 4000) throw e;
        const shrunk = prompt.substring(0, Math.floor(prompt.length * 0.72));
        console.warn(`[AI SERVICE] Groq prompt too large (${prompt.length} chars); retrying with ${shrunk.length} chars...`);
        const completion = await run(shrunk);
        return completion.choices[0].message.content;
    }
}

async function getCombinedAICompletion(prompt, systemPrompt, isJson = false) {
    // LAYER 1–2: Groq (rotate keys, then try current + legacy model IDs)
    if (hasGroqApiKeys()) {
        for (const model of getGroqModelCandidates()) {
            try {
                console.log(`[AI SERVICE] Groq attempt: ${model} (key pool)...`);
                return await groqChatCompletion(model, prompt, systemPrompt, isJson);
            } catch (e) {
                console.warn(`[AI SERVICE] Groq fail (${model}):`, e.message);
            }
        }
    }

    // LAYER 3: Cohere Command R
    if (cohere) {
        try {
            console.log('[AI SERVICE] L3: Attempting Cohere Command R...');
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
            const response = await cohere.chat({
                message: fullPrompt,
                model: 'command-r-08-2024'
            });
            return response.text;
        } catch (e) {
            console.warn('[AI SERVICE] L3 Fail (Cohere):', e.message);
        }
    }

    // LAYER 4: Google Gemini
    if (genAI) {
        for (const modelName of getGeminiModelCandidates()) {
            try {
                console.log(`[AI SERVICE] L4: Attempting Gemini (${modelName})...`);
                const activeModel = genAI.getGenerativeModel({ model: modelName });
                const fullPrompt = `System Context: ${systemPrompt}\n\nUser Request: ${prompt}`;
                const result = await activeModel.generateContent(fullPrompt);
                const response = await result.response;
                let text = response.text();

                if (isJson) {
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    return jsonMatch ? jsonMatch[0] : text;
                }
                return text;
            } catch (e) {
                console.warn(`[AI SERVICE] L4 Fail (${modelName}):`, e.message);
            }
        }
    }

    const ollamaText = await tryOllamaCompletion(prompt, systemPrompt, isJson);
    if (ollamaText) return ollamaText;

    throw new Error(
        'All AI engines are unavailable (Groq models retired or rate-limited, Gemini busy). Set GROQ_MODEL_PRIMARY=openai/gpt-oss-120b or enable Ollama, then retry.'
    );
}

/**
 * Intelligence Synthesis: Transform Raw Text into Expert Identity (Cognitive Flywheel)
 */
async function synthesizeExpertIdentity(newRawText, knowledgeBase, saveKBCallback) {
    if (!groq && !gemini && !genAI) {
        console.warn('[AI SERVICE] Cannot run synthesis. No AI engines initialized.');
        return false;
    }

    console.log('[AI SERVICE LEARNING] Synthesizing new intelligence into Expert Identity...');

    const prompt = `
You are an ELITE Career Intelligence AI (2026). Read the new data below and UPDATE the user's Structured Identity with a focus on GRAPH RELATIONSHIPS.

CURRENT IDENTITY:
${JSON.stringify(knowledgeBase.identity, null, 2)}

NEW DATA RECEIVED:
${newRawText.substring(0, 50000)}

Return a SINGLE JSON object. You MUST include a "_reflexao_critica" field first to think about how this new data impacts the user's elite profile.

EXACT JSON STRUCTURE REQUIRED:
{
  "_reflexao_critica": "Think here. How does this connect to Stanford/IBM certificates? Does it prove a Gestion of €10M+ ROI?",
  "summary": "A 2-paragraph pitch focusing on Digital Art + Agentic Automation fusion",
  "summary2": "A complementary summary focusing on ROI and technical scalability",
  "topSkills": ["skill1", "skill2", ...],  // 7-10 elite technical competencies
  "softSkills": ["skill1", ...],  // 5-7 leadership/strategic skills
  "experience": [{"role": "Job Title", "company": "Company", "year": "2020-2024", "description": "What they did"}],
  "relationalProjects": [
    {
      "id": "node_project_name",
      "title": "Project Name",
      "context": "Brief context of what it is",
      "edges_skills": ["React", "Python"],
      "edges_outcomes": ["Reduced costs by 20%", "Scaled to 10k users"],
      "strategic_weight": "High ROI Automation",
      "related_certs": ["Stanford AI", "IBM Cloud"]
    }
  ],
  "certifications": [{"name": "Cert Name", "issuer": "Issuing Org"}],
  "industryNiche": "Creative Technologist & Solutions Architect",
  "techPhilosophy": "Their vision on human-machine fusion",
  "experienceLevel": "Principal Architect",
  "roi_metrics": {
    "total_managed_budget": "€10M+",
    "efficiency_gain": "85%",
    "agentic_deployments": 12
  }
}

AGENTIC RULES:
1. DEEP CONNECTION: Link every new project to at least 2 topSkills and 1 certification if possible.
2. ROI FOCUS: Always extract or estimate the financial/time impact of the projects.
3. SENIORITY PROTECTION: Only include projects that reinforce the "Principal Architect" level.

Respond with ONLY the raw JSON object. No markdown wrapping.
    `;

    try {
        const completionText = await getCombinedAICompletion(prompt, 'You are a professional identity architect. RESPOND WITH PURE JSON ONLY.', true);

        const jsonMatch = completionText.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : completionText;

        let update = JSON.parse(cleanedJson);

        if (update._reflexao_critica) {
            console.log('\n[AGENTIC REFLECTION]\n' + update._reflexao_critica + '\n');
            delete update._reflexao_critica;
        }

        if (update.identity) update = update.identity;
        const potentialKeys = Object.keys(update);
        if (potentialKeys.length === 1 && typeof update[potentialKeys[0]] === 'object' && !Array.isArray(update[potentialKeys[0]])) {
            update = update[potentialKeys[0]];
        }

        if (Array.isArray(update)) update = update[0] || {};

        const requiredFields = ['summary', 'topSkills', 'industryNiche', 'experienceLevel'];
        const hasData = requiredFields.some(f => update[f]);

        if (!hasData) {
            console.error('[AI SERVICE LEARNING ERROR] AI returned an object but missing core fields. Refusing to overwrite.');
            return false;
        }

        knowledgeBase.identity = update;
        console.log('[AI SERVICE LEARNING] Expert Identity updated and evolved across AI layers.');
        if (saveKBCallback && typeof saveKBCallback === 'function') {
            await saveKBCallback();
        }
        return true;
    } catch (error) {
        console.error('[AI SERVICE LEARNING ERROR] Synthesis failed entirely:', error.message);
        return false;
    }
}

/**
 * Contextual Scoring: Generate Attack Strategy for a specific Job
 */
async function generateAttackStrategy(jobDescription, identity) {
    if (!groq && !gemini) return null;

    console.log('[AI SERVICE TACTICAL] Generating Attack Strategy for Job Match...');

    const prompt = `
You are an ELITE Career Strategist (2026).
Your goal is to analyze the Job Description and the Candidate's Identity to create an "Attack Strategy Draft".

JOB DESCRIPTION:
${jobDescription.substring(0, 10000)}

CANDIDATE IDENTITY:
${JSON.stringify(identity, null, 2)}

TASK:
Determine exactly what to HIGHLIGHT and what to HIDE for this specific job.
All descriptions and reasons MUST be in ENGLISH.

Return a JSON object with this exact structure:
{
  "attack_strategy": {
    "projects_to_highlight": [
      {"title": "Project Name", "reason": "Why it perfectly matches the JD in English"},
      {"title": "Another Project", "reason": "Why it perfectly matches in English"}
    ],
    "projects_to_hide": [
      {"title": "Project Name", "reason": "Why it creates narrative noise in English"}
    ],
    "narrative_focus": "1-sentence instruction in English on the tone to use"
  }
}
    `;

    try {
        const completionText = await getCombinedAICompletion(prompt, 'You are an elite tactical career strategist. RESPOND WITH PURE JSON ONLY.', true);
        const jsonMatch = completionText.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : completionText);
    } catch (e) {
        console.error('[AI SERVICE TACTICAL ERROR] Strategy generation failed:', e.message);
        return null;
    }
}

/**
 * Structured CV Parser: Extract complete candidate resume into JSON
 */
async function parseStructuredCV(rawCvText) {
    console.log('[AI SERVICE] Parsing uploaded CV into structured JSON format...');
    const systemPrompt = `You are a Principal Technical Recruiter and Resume Parser (2026).
Extract the candidate's factual details from the provided CV into clean, valid JSON.
CRITICAL INSTRUCTIONS:
1. Extract candidate's real Full Name, Title/Headline, Email, Phone, Location (City, Country), Website/LinkedIn.
2. Extract the Professional Summary accurately.
3. Extract each Work Experience role: company, role (job title), period (dates/years), and bullet points of responsibilities/achievements.
4. Extract all Hard Skills (technologies, programming languages, frameworks, tools, platforms).
5. Extract Education items (degree, institution, details/dates).
6. Extract Certifications, Languages, and Soft Skills.
7. Return ONLY valid JSON matching the exact schema. No markdown backticks.`;

    const prompt = `
Parse this CV into the required JSON schema:
--------------------------------------------
${rawCvText.substring(0, 45000)}
--------------------------------------------

SCHEMA REQUIRED:
{
  "personal_info": {
    "name": "Full Name",
    "title": "Professional Title / Headline",
    "email": "Email address",
    "phone": "Phone number",
    "location": "City, Country or Remote",
    "website": "LinkedIn or Portfolio URL"
  },
  "summary": "Professional summary...",
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "period": "Period (e.g. 2022 - Present)",
      "bullets": [
        "Responsibility or accomplishment bullet"
      ]
    }
  ],
  "hard_skills": [
    "Skill 1", "Skill 2"
  ],
  "education": [
    {
      "degree": "Degree / Course",
      "institution": "University / Institute",
      "details": "Major or years"
    }
  ],
  "certifications": [
    "Cert 1"
  ],
  "languages": [
    "Language 1"
  ],
  "soft_skills": [
    "Skill 1"
  ]
}
`;

    const completionText = await getCombinedAICompletion(prompt, systemPrompt, true);
    const jsonMatch = completionText.match(/\{[\s\S]*\}/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : completionText;
    const parsed = JSON.parse(cleanedJson);

    // Normalize schema
    parsed.personal_info = parsed.personal_info || {};
    parsed.personal_info.name = parsed.personal_info.name || 'Candidate';
    parsed.personal_info.title = parsed.personal_info.title || 'Professional';
    parsed.personal_info.email = parsed.personal_info.email || '';
    parsed.personal_info.phone = parsed.personal_info.phone || '';
    parsed.personal_info.location = parsed.personal_info.location || '';
    parsed.personal_info.website = parsed.personal_info.website || '';
    parsed.summary = parsed.summary || '';
    parsed.experience = Array.isArray(parsed.experience) ? parsed.experience : [];
    parsed.hard_skills = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : [];
    parsed.education = Array.isArray(parsed.education) ? parsed.education : [];
    parsed.certifications = Array.isArray(parsed.certifications) ? parsed.certifications : [];
    parsed.languages = Array.isArray(parsed.languages) ? parsed.languages : [];
    parsed.soft_skills = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];

    return parsed;
}

module.exports = {
    initAI,
    getCombinedAICompletion,
    synthesizeExpertIdentity,
    generateAttackStrategy,
    parseStructuredCV,
    getGroqClient: () => groq,
    getGeminiModel: () => gemini,
    getCohereClient: () => cohere
};
