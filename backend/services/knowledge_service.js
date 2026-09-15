// ============================================================
// 🧠 KNOWLEDGE BASE & CANDIDATE MEMORY SERVICE
// Single Source of Truth for Candidate DNA, Skills & Identity
// ============================================================

const fs = require('fs');
const path = require('path');
const vectorEngine = require('../vector_engine');
const aiService = require('./ai_service');

const KB_PATH = path.join(__dirname, '..', 'knowledge_base.json');

// Expanded Master Dictionary for Job Analysis (Elite 2026 Hard + Soft Pillars)
const MASTER_DICTIONARY = [
    // --- Hard Skills ---
    'n8n', 'Python', 'AI', 'Artificial Intelligence', 'Agentic Workflows', 'LangChain',
    'React', 'Node.js', 'Typescript', 'Scrum Master', 'Agile', 'AEO', 'SEO',
    'Strategic Branding', 'UI/UX', 'Cloud', 'Docker', '3D', 'Three.js',
    'Full-stack', 'Automation', 'FastAPI', 'AWS', 'GCP', 'Kubernetes',
    'Pensamento Estratégico', 'Pensamento Crítico', 'Gestão de Mudança',
    'Mentoria', 'Comunicação Assertiva', 'Storytelling', 'Stakeholder Management',

    // Pillar 2: Software Development Agility
    'Learning Agility', 'Aprendizado Contínuo', 'Resolução de Problemas Complexos',
    'Colaboração', 'Comunicação Técnica', 'Proatividade', 'Teamwork',

    // Pillar 3: AI & Machine Learning Ethics
    'Pensamento Analítico', 'Pensamento Lógico', 'Criatividade', 'Curiosidade',
    'Ética Digital', 'Responsabilidade Digital', 'Context Engineering', 'LLM Training',

    // Pillar 4: Product & Agile Governance (PM, PO, Scrum)
    'Pensamento Crítico e Decisório', 'Influência sem Autoridade', 'Visão de Negócio',
    'Commercial Acumen', 'Sintetização de Dados', 'Comunicação Assertiva e Tradução',
    'Gestão de Conflitos', 'Negociação Diplomática', 'Priorização Baseada em Valor',
    'Escuta Ativa', 'Facilitação e Mediação', 'Inteligência Social', 'Liderança Servidora',
    'Resiliência', 'Melhoria Contínua',

    // Pillar 5: Creative & Branding Strategy
    'Psicologia do Consumidor', 'Storytelling e Narrativa', 'Visão Sistêmica',
    'Persuasão e Negociação', 'Curadoria e Senso Crítico', 'Pensamento Analítico',
    'Colaboração Radical', 'Flexibilidade Cognitiva', 'Design Systems', 'UX/UI Strategy',

    // --- Common & Productivity Tools (Automated Gap Detection) ---
    'Microsoft Word', 'Word', 'PowerPoint', 'Microsoft PowerPoint', 'Excel', 'Microsoft Excel',
    'Google Sheets', 'Slack', 'Microsoft Teams', 'Canva', 'Adobe Creative Cloud',
    'Trello', 'Asana', 'Jira', 'Confluence', 'Notion', 'Zoom'
];

// Skill Synonyms Map for Semantical Matching
const SKILL_SYNONYMS = {
    'ai': ['artificial intelligence', 'machine learning', 'ml', 'nlp', 'llm', 'generative ai', 'ia'],
    'javascript': ['js', 'es6', 'ecmascript'],
    'typescript': ['ts'],
    'react': ['react.js', 'reactjs', 'next.js', 'nextjs'],
    'node.js': ['nodejs', 'node'],
    'cloud': ['aws', 'gcp', 'azure', 'infrastructure', 'cloud solutions', 'cloud-based'],
    'python': ['fastapi', 'flask', 'django', 'pandas'],
    'agile': ['scrum', 'kanban', 'scrum master'],
    'full-stack': ['frontend', 'backend', 'fullstack', 'software engineering'],
    'ui/ux': ['figma', 'design', 'user experience', 'ux', 'ui'],
    'rag': ['vector database', 'embeddings', 'pinecode', 'chromadb'],
    'storytelling': ['communication', 'evangelism', 'advocacy', 'public speaking', 'content creation']
};

// Internal in-memory Knowledge Base singleton
let knowledgeBase = {
    expertProfile: '',
    identity: {
        summary: '',
        topSkills: [],
        softSkills: [],
        keyProjects: [],
        certifications: [],
        industryNiche: '',
        techPhilosophy: ''
    },
    skills: [],
    websites: [],
    lastUpdated: new Date().toISOString(),
    groqApiKey: '',
    geminiApiKey: '',
    daily_stats: {
        last_date: new Date().toISOString().split('T')[0],
        count: 0
    },
    autopilot: {
        enabled: false,
        dailyLimit: 3,
        intervalHours: 6,
        lastRunAt: null,
        todayCount: 0,
        todayDate: new Date().toISOString().split('T')[0],
        totalJobsFound: 0
    }
};

// Initial sync fallback from local JSON file
if (fs.existsSync(KB_PATH)) {
    try {
        const localData = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
        Object.assign(knowledgeBase, localData);
    } catch (e) {
        console.warn('[KB] Offline fallback parse warning:', e.message);
    }
}

function sanitizeExpertProfile(text) {
    if (!text) return '';
    let cleaned = text.replace(/Headline:\s*Summary:\s*Experience:\s*/gi, '');
    cleaned = cleaned.replace(/^\s*(Headline|Summary|Experience):\s*$/gm, '');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    return cleaned.trim();
}

function initQuotas() {
    if (!knowledgeBase.neural_budget) {
        knowledgeBase.neural_budget = {
            tokens_consumed: 0,
            calls_today: 0,
            last_reset: new Date().toISOString().split('T')[0],
            estimated_cost_saved: 0
        };
    }
    const today = new Date().toISOString().split('T')[0];
    if (knowledgeBase.neural_budget.last_reset !== today) {
        knowledgeBase.neural_budget.last_reset = today;
        knowledgeBase.neural_budget.calls_today = 0;
    }
}

function logNeuralCall(estimatedTokens = 1500, saved = false) {
    initQuotas();
    if (saved) {
        knowledgeBase.neural_budget.estimated_cost_saved += estimatedTokens;
    } else {
        knowledgeBase.neural_budget.tokens_consumed += estimatedTokens;
        knowledgeBase.neural_budget.calls_today += 1;
    }
    saveKB();
}

async function saveKBSilent() {
    try {
        knowledgeBase.expertProfile = sanitizeExpertProfile(knowledgeBase.expertProfile);
        fs.writeFileSync(KB_PATH, JSON.stringify(knowledgeBase, null, 2));
        await vectorEngine.saveUserProfile(knowledgeBase);
    } catch (err) {
        console.error('[KB SILENT SAVE ERROR]', err.message);
    }
}

async function saveKB() {
    try {
        knowledgeBase.lastUpdated = new Date().toISOString();
        knowledgeBase.expertProfile = sanitizeExpertProfile(knowledgeBase.expertProfile);
        fs.writeFileSync(KB_PATH, JSON.stringify(knowledgeBase, null, 2));
        await vectorEngine.saveUserProfile(knowledgeBase);
        console.log('[KB] Neural State saved successfully to PostgreSQL database ✅');
    } catch (err) {
        console.error('[KB SAVE ERROR]', err.message);
    }
}

async function bootstrapKnowledgeBase() {
    try {
        await vectorEngine.initVectorEngine();
        let dbProfile = await vectorEngine.getUserProfile();

        if (dbProfile && Object.keys(dbProfile).length > 0) {
            console.log('[KB] Neural DNA restored from PostgreSQL user_profiles ✅');
            knowledgeBase = dbProfile;
        } else {
            console.log('[KB] No profile found in DB. Searching for legacy local file...');
            if (fs.existsSync(KB_PATH)) {
                try {
                    const localData = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
                    console.log('[KB] Migrating legacy knowledge_base.json to PostgreSQL...');
                    knowledgeBase = localData;
                    await vectorEngine.saveUserProfile(knowledgeBase);
                    console.log('[KB] Migration complete! Legacy profile saved to Postgres.');
                } catch (err) {
                    console.warn('[KB] Failed to read legacy file during migration:', err.message);
                }
            } else {
                console.log('[KB] No legacy file found. Using default schema and saving to Postgres.');
                await vectorEngine.saveUserProfile(knowledgeBase);
            }
        }

        if (!knowledgeBase.skills) knowledgeBase.skills = [];
        if (!knowledgeBase.identity) {
            knowledgeBase.identity = { summary: '', topSkills: [], softSkills: [], keyProjects: [], certifications: [], industryNiche: '', techPhilosophy: '' };
        }
        knowledgeBase.expertProfile = sanitizeExpertProfile(knowledgeBase.expertProfile);

        aiService.initAI({
            groqApiKey: knowledgeBase.groqApiKey,
            geminiApiKey: knowledgeBase.geminiApiKey,
            cohereApiKey: process.env.COHERE_API_KEY
        });

        initQuotas();
    } catch (e) {
        console.error('[KB] Failed to bootstrap Knowledge Base:', e.message);
    }
}

function extractSkills(text, dictionary = MASTER_DICTIONARY) {
    if (!text) return [];
    return dictionary.filter(skill => {
        const skillEscaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${skillEscaped}\\b`, 'i');
        return regex.test(text);
    });
}

function getAggregateUserSkills() {
    let all = [...(knowledgeBase.skills || [])];
    if (knowledgeBase.identity) {
        if (Array.isArray(knowledgeBase.identity.topSkills)) {
            all = [...all, ...knowledgeBase.identity.topSkills];
        }
        if (knowledgeBase.identity.softSkills) {
            if (Array.isArray(knowledgeBase.identity.softSkills)) {
                all = [...all, ...knowledgeBase.identity.softSkills];
            } else if (typeof knowledgeBase.identity.softSkills === 'object') {
                Object.values(knowledgeBase.identity.softSkills).forEach(categorySkills => {
                    if (Array.isArray(categorySkills)) {
                        all = [...all, ...categorySkills];
                    }
                });
            }
        }
    }

    let expanded = new Set();
    all.forEach(s => {
        const lower = s.toLowerCase().trim();
        if (!lower) return;
        expanded.add(lower);
        if (SKILL_SYNONYMS[lower]) {
            SKILL_SYNONYMS[lower].forEach(syn => expanded.add(syn));
        }
        Object.entries(SKILL_SYNONYMS).forEach(([main, syns]) => {
            if (syns.includes(lower)) expanded.add(main);
        });
    });

    return Array.from(expanded);
}

let synthDebounceTimer = null;
function debouncedSynthesize(text) {
    if (synthDebounceTimer) clearTimeout(synthDebounceTimer);
    synthDebounceTimer = setTimeout(async () => {
        console.log('[SYNTH DEBOUNCE] Running deferred synthesis...');
        try {
            await aiService.synthesizeExpertIdentity(text, knowledgeBase, saveKB);
        } catch (e) {
            console.error('[SYNTH DEBOUNCE] Failed:', e.message);
        }
    }, 5000);
}

async function seedCvIntoMemory() {
    const CV_PATH = path.join(__dirname, '..', 'user_cv.json');
    const EXAMPLE_PATH = path.join(__dirname, '..', 'user_cv.json.example');

    let cvPath = fs.existsSync(CV_PATH) ? CV_PATH : (fs.existsSync(EXAMPLE_PATH) ? EXAMPLE_PATH : null);
    if (!cvPath) {
        console.log('[CV SEED] No user_cv.json found. Skipping CV auto-seed.');
        return;
    }

    let cv;
    try {
        cv = JSON.parse(fs.readFileSync(cvPath, 'utf8'));
    } catch (e) {
        console.warn('[CV SEED] Failed to parse user_cv.json:', e.message);
        return;
    }

    const name = cv.personal_info?.name || 'Candidate';
    const title = cv.personal_info?.title || '';
    const location = cv.personal_info?.location || '';
    const summary = cv.summary || '';

    const chunks = [];
    chunks.push(`Candidate Profile:\nName: ${name}\nTitle: ${title}\nLocation: ${location}\nSummary: ${summary}`);

    if (cv.experience && Array.isArray(cv.experience)) {
        for (const exp of cv.experience) {
            const bullets = (exp.bullets || []).join('. ');
            chunks.push(`Work Experience: ${exp.role} at ${exp.company} (${exp.period}). ${bullets}`);
        }
    }

    if (cv.hard_skills && typeof cv.hard_skills === 'object') {
        for (const [category, skills] of Object.entries(cv.hard_skills)) {
            const skillList = Array.isArray(skills) ? skills.join(', ') : String(skills);
            chunks.push(`Technical Skills [${category}]: ${skillList}`);
        }
    }

    if (cv.soft_skills?.length) chunks.push(`Soft Skills: ${cv.soft_skills.join(', ')}`);
    if (cv.languages?.length) chunks.push(`Languages: ${cv.languages.join(', ')}`);
    if (cv.certifications?.length) chunks.push(`Certifications: ${cv.certifications.join(', ')}`);
    if (cv.education?.length) {
        const edu = cv.education.map(e => `${e.degree} at ${e.institution}`).join('; ');
        chunks.push(`Education: ${edu}`);
    }

    console.log(`[CV SEED] 🧬 Auto-seeding ${chunks.length} knowledge fragments from user_cv.json...`);

    for (const chunk of chunks) {
        try {
            await vectorEngine.addInformation(chunk, `CV Auto-Seed: ${name}`);
        } catch (e) {
            console.warn('[CV SEED] Chunk failed:', e.message);
        }
    }

    console.log(`[CV SEED] ✅ Neural memory seeded with ${name}'s professional DNA. System is ready to match jobs.`);
}

function getUserCv() {
    const CV_PATH = path.join(__dirname, '..', 'user_cv.json');
    const EXAMPLE_PATH = path.join(__dirname, '..', 'user_cv.json.example');
    const cvPath = fs.existsSync(CV_PATH) ? CV_PATH : (fs.existsSync(EXAMPLE_PATH) ? EXAMPLE_PATH : null);
    if (!cvPath) return null;
    try {
        return JSON.parse(fs.readFileSync(cvPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function getUserTargetRequirements() {
    const cv = getUserCv();
    const kb = knowledgeBase;

    const title = cv?.personal_info?.title || kb?.identity?.industryNiche || 'AI Systems & Automation Engineer';
    const location = cv?.personal_info?.location || 'Portugal';
    const name = cv?.personal_info?.name || 'Candidate';

    let skills = [];
    if (cv?.hard_skills) {
        if (Array.isArray(cv.hard_skills)) {
            skills = [...cv.hard_skills];
        } else if (typeof cv.hard_skills === 'object') {
            skills = Object.values(cv.hard_skills).flat();
        }
    }
    if (skills.length === 0 && kb?.skills?.length) {
        skills = [...kb.skills];
    }

    return {
        name,
        title,
        location,
        skills,
        experience: cv?.experience || [],
        summary: cv?.summary || kb?.identity?.summary || ''
    };
}

module.exports = {
    knowledgeBase,
    getKnowledgeBase: () => knowledgeBase,
    bootstrapKnowledgeBase,
    saveKB,
    saveKBSilent,
    sanitizeExpertProfile,
    initQuotas,
    logNeuralCall,
    MASTER_DICTIONARY,
    SKILL_SYNONYMS,
    extractSkills,
    getAggregateUserSkills,
    debouncedSynthesize,
    seedCvIntoMemory,
    getUserCv,
    getUserTargetRequirements
};
