const { Groq } = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');

let groq = null;
let gemini = null;
let cohere = null;

let groqApiKey = process.env.GROQ_API_KEY || '';
let geminiApiKey = process.env.GEMINI_API_KEY || '';
let cohereApiKey = process.env.COHERE_API_KEY || '';

// Initialize default clients from env if available
if (groqApiKey) groq = new Groq({ apiKey: groqApiKey });
let genAI = null;
if (geminiApiKey) {
    genAI = new GoogleGenerativeAI(geminiApiKey);
    gemini = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
}
if (cohereApiKey) cohere = new CohereClient({ token: cohereApiKey });

/**
 * Dynamically reinitialize clients with new keys (from user config / database)
 */
function initAI(keys = {}) {
    if (keys.groqApiKey && keys.groqApiKey !== groqApiKey) {
        groqApiKey = keys.groqApiKey;
        groq = new Groq({ apiKey: groqApiKey });
        console.log('[AI SERVICE] Groq AI Engine initialized dynamically');
    }
    if (keys.geminiApiKey && keys.geminiApiKey !== geminiApiKey) {
        geminiApiKey = keys.geminiApiKey;
        genAI = new GoogleGenerativeAI(geminiApiKey);
        gemini = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        console.log('[AI SERVICE] Gemini AI Engine initialized dynamically');
    }
    if (keys.cohereApiKey && keys.cohereApiKey !== cohereApiKey) {
        cohereApiKey = keys.cohereApiKey;
        cohere = new CohereClient({ token: cohereApiKey });
        console.log('[AI SERVICE] Cohere Engine initialized dynamically');
    }
}

/**
 * Universal AI Completion with 4-Layer Fallback Strategy (2026 Protocol)
 */
async function getCombinedAICompletion(prompt, systemPrompt, isJson = false) {
    // LAYER 1: Groq Llama 3.3 70B
    if (groq) {
        try {
            console.log('[AI SERVICE] L1: Attempting Groq Llama 3.3 70B...');
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: isJson ? { type: 'json_object' } : undefined
            });
            return completion.choices[0].message.content;
        } catch (e) {
            console.warn('[AI SERVICE] L1 Fail (70B):', e.message);
        }

        // LAYER 2: Groq Llama 3.1 8B Fallback
        try {
            console.log('[AI SERVICE] L2: Attempting Groq Llama 3.1 8B...');
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
                model: 'llama-3.1-8b-instant',
                response_format: isJson ? { type: 'json_object' } : undefined
            });
            return completion.choices[0].message.content;
        } catch (e) {
            console.warn('[AI SERVICE] L2 Fail (8B):', e.message);
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

    // LAYER 4: Google Gemini (Neural Backbone)
    if (genAI || gemini) {
        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'];
        for (const modelName of candidateModels) {
            try {
                console.log(`[AI SERVICE] L4: Attempting Gemini (${modelName})...`);
                const activeModel = genAI ? genAI.getGenerativeModel({ model: modelName }) : gemini;
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

    throw new Error("All AI Engines are currently unavailable or quota-limited.");
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
