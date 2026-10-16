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
    'Google Sheets', 'Slack', 'Figma', 'Microsoft Teams', 'Canva', 'Adobe Creative Cloud',
    'Trello', 'Asana', 'Jira', 'Confluence', 'Notion', 'Zoom'
];

// Skill Synonyms Map for Semantical Matching
const SKILL_SYNONYMS = {
    'ai': ['artificial intelligence', 'machine learning', 'ml', 'nlp', 'llm', 'generative ai', 'ia'],
    'javascript': ['js', 'es6', 'ecmascript'],
    'typescript': ['ts'],
    'react': ['react.js', 'reactjs', 'next.js', 'nextjs'],
    'node.js': ['nodejs', 'node'],
    // Do not map GCP/Hetzner to Azure/AWS — candidate cloud stack is GCP + Hetzner VPS (see user_cv.json).
    'cloud': ['gcp', 'google cloud', 'hetzner', 'infrastructure', 'cloud solutions', 'cloud-based', 'vertex ai'],
    'google cloud platform (gcp)': ['gcp', 'google cloud', 'vertex ai', 'cloud'],
    'hetzner cloud': ['hetzner', 'vps', 'cloud hosting'],
    'python': ['fastapi', 'flask', 'django', 'pandas'],
    'agile': ['scrum', 'kanban', 'scrum master'],
    'full-stack': ['frontend', 'backend', 'fullstack', 'software engineering'],
    'ui/ux': ['figma', 'design', 'user experience', 'ux', 'ui'],
    'figma': ['figma design', 'ui design', 'prototyping', 'design systems'],
    'slack': ['slack workspace', 'slack notifications', 'team collaboration'],
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

    if (Array.isArray(cv.hard_skills) && cv.hard_skills.length) {
        chunks.push(`Technical Skills: ${cv.hard_skills.join(', ')}`);
    } else if (cv.hard_skills && typeof cv.hard_skills === 'object') {
        for (const [category, skills] of Object.entries(cv.hard_skills)) {
            const skillList = Array.isArray(skills) ? skills.join(', ') : String(skills);
            chunks.push(`Technical Skills [${category}]: ${skillList}`);
        }
    }
    if (cv.dev_tooling?.primary_ides?.length) {
        const usage = cv.dev_tooling.usage ? ` ${cv.dev_tooling.usage}` : '';
        chunks.push(`Development environment: ${cv.dev_tooling.primary_ides.join(', ')}.${usage}`);
    }

    if (cv.soft_skills?.length) chunks.push(`Soft Skills: ${cv.soft_skills.join(', ')}`);
    if (cv.languages?.length) chunks.push(`Languages: ${cv.languages.join(', ')}`);
    if (cv.certifications?.length) {
        const certLine = cv.certifications
            .map(c => (typeof c === 'string' ? c : `${c.name}${c.issuer ? ` (${c.issuer})` : ''}`))
            .join('; ');
        chunks.push(`Certifications: ${certLine}`);
    }
    if (cv.books_read?.length) {
        const booksLine = cv.books_read
            .map(b => `${b.title}${b.author ? ` — ${b.author}` : ''}${b.edition ? ` [${b.edition}]` : ''}`)
            .join('; ');
        chunks.push(`Professional reading (completed): ${booksLine}`);
        for (const book of cv.books_read) {
            const topics = Array.isArray(book.topics) ? book.topics.join(', ') : '';
            chunks.push(
                `Book: ${book.title}${book.author ? ` by ${book.author}` : ''}.` +
                (topics ? ` Themes: ${topics}.` : '')
            );
        }
    }
    if (cv.education?.length) {
        const edu = cv.education.map(e => `${e.degree} at ${e.institution || e.school}`).join('; ');
        chunks.push(`Education: ${edu}`);
    }
    if (cv.projects?.length) {
        for (const project of cv.projects) {
            chunks.push(formatProjectMemory(project));
        }
    }
    if (cv.operational_metrics && typeof cv.operational_metrics === 'object') {
        const om = Object.entries(cv.operational_metrics)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
        chunks.push(`Operational scale: ${om}`);
    }
    if (cv.preferences) chunks.push(`Candidate Preferences / Constraints:\n${cv.preferences}`);
    if (cv.screening) chunks.push(`Screening Answers:\n${cv.screening}`);

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
        summary: cv?.summary || kb?.identity?.summary || '',
        projects: cv?.projects || kb?.identity?.relationalProjects || [],
        preferences: cv?.preferences || ''
    };
}

function cvFilePath() {
    return path.join(__dirname, '..', 'user_cv.json');
}

function loadOrCreateUserCv() {
    const CV_PATH = cvFilePath();
    if (!fs.existsSync(CV_PATH)) {
        return {
            personal_info: {},
            summary: '',
            experience: [],
            hard_skills: [],
            projects: []
        };
    }
    try {
        return JSON.parse(fs.readFileSync(CV_PATH, 'utf8'));
    } catch (e) {
        return { personal_info: {}, summary: '', experience: [], hard_skills: [], projects: [] };
    }
}

function saveUserCv(cv) {
    fs.writeFileSync(cvFilePath(), JSON.stringify(cv, null, 2), 'utf8');
}

function splitSkillList(value) {
    if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
    if (!value) return [];
    return String(value).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
}

function slugifyTitle(title) {
    return String(title || 'project')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60);
}

function flattenTechStack(techStack) {
    if (!techStack || typeof techStack !== 'object') return [];
    const items = [];
    for (const value of Object.values(techStack)) {
        if (Array.isArray(value)) items.push(...value.map(String));
        else if (value) items.push(String(value));
    }
    return items;
}

function formatProjectMemory(project) {
    const skills = splitSkillList(project.edges_skills || project.stack);
    const techFromStack = flattenTechStack(project.tech_stack);
    const allStack = [...new Set([...skills, ...techFromStack])];
    const outcomes = Array.isArray(project.edges_outcomes)
        ? project.edges_outcomes
        : (project.result ? [project.result] : []);
    const stackLine = allStack.length ? allStack.join(', ') : '';
    const techLayers = project.tech_stack && typeof project.tech_stack === 'object'
        ? Object.entries(project.tech_stack)
            .filter(([, tools]) => Array.isArray(tools) && tools.length)
            .map(([layer, tools]) => `${layer}: ${tools.join(', ')}`)
            .join(' | ')
        : '';
    return [
        `PROJECT: ${project.title || 'Untitled'}`,
        project.period ? `PERIOD: ${project.period}` : '',
        project.role ? `ROLE: ${project.role}` : '',
        project.context ? `CONTEXT: ${project.context}` : '',
        techLayers ? `TECHNOLOGIES: ${techLayers}` : '',
        stackLine ? `STACK: ${stackLine}` : '',
        outcomes.length ? `RESULT: ${outcomes.join('; ')}` : '',
        Array.isArray(project.modules) && project.modules.length
            ? `MODULES: ${project.modules.join('; ')}`
            : '',
        Array.isArray(project.websites) && project.websites.length
            ? `WEBSITES: ${project.websites.map(w => `${w.url || w.label} (${w.stack || w.label || ''})`).join('; ')}`
            : '',
        project.link ? `LINK: ${project.link}` : '',
        project.company ? `COMPANY: ${project.company}` : ''
    ].filter(Boolean).join('\n');
}

function mergeProjects(cvProjects, kbProjects) {
    const list = Array.isArray(cvProjects) ? [...cvProjects] : [];
    const titles = new Set(list.map(p => (p.title || '').toLowerCase()));
    for (const project of (kbProjects || [])) {
        const title = (project.title || '').toLowerCase();
        if (title && !titles.has(title)) {
            list.push(project);
            titles.add(title);
        }
    }
    return list;
}

function upsertCvProject(cv, project) {
    cv.projects = Array.isArray(cv.projects) ? cv.projects : [];
    const idx = cv.projects.findIndex(p =>
        (p.id && p.id === project.id) ||
        (p.title && p.title.toLowerCase() === project.title.toLowerCase())
    );
    if (idx >= 0) cv.projects[idx] = { ...cv.projects[idx], ...project };
    else cv.projects.push(project);
    return cv;
}

function attachBulletToExperience(cv, { company, role, period, bullet }) {
    cv.experience = Array.isArray(cv.experience) ? cv.experience : [];
    const match = cv.experience.find(e =>
        (e.company || '').toLowerCase() === company.toLowerCase() &&
        (!role || (e.role || '').toLowerCase() === role.toLowerCase())
    );
    if (match) {
        match.bullets = Array.isArray(match.bullets) ? match.bullets : [];
        if (!match.bullets.includes(bullet)) match.bullets.push(bullet);
        if (period && !match.period) match.period = period;
        return;
    }
    cv.experience.push({
        company,
        role: role || 'Contributor',
        period: period || '',
        bullets: [bullet]
    });
}

function syncIdentityFromCv(cv) {
    knowledgeBase.identity = knowledgeBase.identity || {};
    if (cv.personal_info) knowledgeBase.identity.personal_info = cv.personal_info;
    if (cv.summary) {
        knowledgeBase.identity.summary = cv.summary;
        delete knowledgeBase.identity.summary2;
    }
    if (cv.operational_metrics) knowledgeBase.identity.operational_metrics = cv.operational_metrics;
    if (cv.personal_info?.title) knowledgeBase.identity.industryNiche = cv.personal_info.title;
    if (Array.isArray(cv.hard_skills) && cv.hard_skills.length) {
        knowledgeBase.identity.topSkills = cv.hard_skills;
        knowledgeBase.skills = [...new Set([...(knowledgeBase.skills || []), ...cv.hard_skills])];
    }
    if (Array.isArray(cv.soft_skills) && cv.soft_skills.length) {
        knowledgeBase.identity.softSkills = cv.soft_skills;
    }
    if (Array.isArray(cv.projects)) {
        knowledgeBase.identity.relationalProjects = cv.projects;
    }
    if (Array.isArray(cv.experience)) {
        knowledgeBase.identity.experience = cv.experience.map(e => ({
            role: e.role,
            company: e.company,
            year: e.period,
            description: Array.isArray(e.bullets) ? e.bullets.join('. ') : (e.bullets || '')
        }));
    }
}

function projectToExperienceBullet(project) {
    const skills = splitSkillList(project.edges_skills);
    const outcome = Array.isArray(project.edges_outcomes) ? project.edges_outcomes[0] : '';
    const parts = [
        project.role || `Entreguei ${project.title}`,
        skills.length ? `stack: ${skills.join(', ')}` : '',
        outcome || ''
    ].filter(Boolean);
    return parts.join('; ');
}

async function ingestStructuredProject(payload) {
    const skills = splitSkillList(payload.stack);
    const outcomes = payload.result ? [String(payload.result).trim()].filter(Boolean) : [];
    const project = {
        id: `node_${slugifyTitle(payload.title)}`,
        title: payload.title.trim(),
        context: (payload.context || '').trim(),
        role: (payload.role || '').trim(),
        period: (payload.period || '').trim(),
        link: (payload.link || '').trim(),
        company: (payload.company || '').trim(),
        edges_skills: skills,
        edges_outcomes: outcomes,
        strategic_weight: 'Core Node'
    };

    const cv = loadOrCreateUserCv();
    upsertCvProject(cv, project);

    if (skills.length) {
        const current = Array.isArray(cv.hard_skills)
            ? cv.hard_skills
            : (cv.hard_skills && typeof cv.hard_skills === 'object' ? Object.values(cv.hard_skills).flat() : []);
        cv.hard_skills = [...new Set([...current, ...skills])];
    }

    if (payload.attach_to_experience && project.company) {
        attachBulletToExperience(cv, {
            company: project.company,
            role: project.role,
            period: project.period,
            bullet: projectToExperienceBullet(project)
        });
    }

    saveUserCv(cv);
    syncIdentityFromCv(cv);
    await saveKB();
    await vectorEngine.addInformation(formatProjectMemory(project), `Structured Project: ${project.title}`);
    return { project, cv };
}

async function ingestExperienceBullet(payload) {
    const cv = loadOrCreateUserCv();
    attachBulletToExperience(cv, payload);
    saveUserCv(cv);
    syncIdentityFromCv(cv);
    await saveKB();
    await vectorEngine.addInformation(
        `Work Experience: ${payload.role} at ${payload.company} (${payload.period || ''}). ${payload.bullet}`,
        `Experience Bullet: ${payload.company}`
    );
    return cv;
}

async function ingestTeachText(text, kind = 'project_notes') {
    const cv = loadOrCreateUserCv();
    const sourceMap = {
        project_notes: 'Manual Project Notes',
        preferences: 'Candidate Preferences',
        screening: 'Screening Answers'
    };
    const source = sourceMap[kind] || 'Manual Portfolio Update';

    if (kind === 'preferences') {
        cv.preferences = [cv.preferences, text].filter(Boolean).join('\n\n').slice(-20000);
        saveUserCv(cv);
    } else if (kind === 'screening') {
        cv.screening = [cv.screening, text].filter(Boolean).join('\n\n').slice(-20000);
        saveUserCv(cv);
    }

    knowledgeBase.expertProfile = `${source}:\n\n${text}\n\n${knowledgeBase.expertProfile || ''}`.substring(0, 100000);
    await saveKBSilent();
    await vectorEngine.addInformation(text, source);

    if (aiService.getGroqClient() || aiService.getGeminiModel()) {
        aiService.synthesizeExpertIdentity(
            `FACTUAL INGEST ONLY. Do not invent metrics, employers, or skills.\nKIND: ${kind}\n\n${text}`,
            knowledgeBase,
            saveKB
        ).catch(e => console.error('[INGEST SYNTH]', e.message));
    }

    return { kind, source };
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
    getUserTargetRequirements,
    mergeProjects,
    ingestStructuredProject,
    ingestExperienceBullet,
    ingestTeachText
};
