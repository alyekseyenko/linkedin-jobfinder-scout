// ============================================================
// 👤 PROFILE, CV & CANDIDATE IDENTITY ROUTES
// Handles CV uploads, portfolio parsing, bio generation, and identity
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const cheerio = require('cheerio');

const knowledgeService = require('../services/knowledge_service');
const jobService = require('../services/job_service');
const aiService = require('../services/ai_service');
const vectorEngine = require('../vector_engine');
const mcpService = require('../services/mcp_service');
const vaultService = require('../services/vault_service');
const loggerService = require('../services/logger_service');
const telemetryService = require('../services/telemetry_service');
const aiEngineClient = require('../services/ai_engine_client');
const { buildCandidateDigest, buildAtsContextInsights } = require('../services/cv_digest_service');
const { validateBody } = require('../middleware/validation');
const { PortfolioAnalyzeSchema, CookieConfigSchema, CvTailorSchema, IngestProjectSchema, IngestExperienceSchema, IngestLessonSchema } = require('../contracts/schemas');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper: Scrape deep content from URL
async function scrapeUrlContent(url) {
    try {
        const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, iframe, noscript').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const links = [];

        const baseUrl = new URL(url);
        $('a[href]').each((_, el) => {
            try {
                const href = $(el).attr('href');
                const fullUrl = new URL(href, url);
                if (fullUrl.hostname === baseUrl.hostname) {
                    const pathname = fullUrl.pathname.toLowerCase();
                    const keywords = ['project', 'projeto', 'work', 'cert', 'portfolio', 'case-study', 'estudo', 'trabalho', 'formacao', 'skills', 'about'];
                    if (keywords.some(k => pathname.includes(k))) {
                        links.push(fullUrl.toString());
                    }
                }
            } catch (e) { }
        });

        return { text, links: [...new Set(links)].slice(0, 5) };
    } catch (error) {
        console.error(`[SCRAPE ERROR] ${url}:`, error.message);
        return { text: '', links: [] };
    }
}

// 1. Analyze Raw Portfolio Text
router.post('/api/analyze-portfolio', validateBody(PortfolioAnalyzeSchema), async (req, res) => {
    const { text } = req.validatedBody || req.body;
    const kb = knowledgeService.knowledgeBase;

    const extracted = knowledgeService.extractSkills(text, knowledgeService.MASTER_DICTIONARY);
    kb.skills = [...new Set([...(kb.skills || []), ...extracted])];
    kb.expertProfile = text;
    await knowledgeService.saveKBSilent();

    console.log(`[PORTFOLIO] Instant recognition: ${extracted.length} skills found. Moving to background synthesis...`);

    res.json({
        skills: extracted,
        suggestedKeywords: extracted.slice(0, 3).join(' ') || 'Software Engineer',
        status: 'processing_background'
    });

    (async () => {
        try {
            await vectorEngine.addInformation(text, 'Manual Portfolio Update');
            if (aiService.getGroqClient() || aiService.getGeminiModel()) {
                await aiService.synthesizeExpertIdentity(text, kb, knowledgeService.saveKB);
            }
            console.log('[PORTFOLIO] Background learning and synthesis complete.');
        } catch (bgErr) {
            console.error('[PORTFOLIO BG ERROR] Learning failed:', bgErr.message);
        }
    })();
});

// 2. Deep Learn from Web Portfolio URL
router.post('/api/learn-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        console.log(`[DEEP LEARN] Starting crawl for ${url}...`);
        const mainPage = await scrapeUrlContent(url);
        if (!mainPage.text) throw new Error('Could not read main page');

        let allText = `Main Page (${url}):\n${mainPage.text}\n\n`;
        const deepMatches = [];

        for (const deepUrl of mainPage.links) {
            try {
                console.log(`[DEEP LEARN] Visiting sub-page: ${deepUrl}`);
                const subPage = await scrapeUrlContent(deepUrl);
                if (subPage.text) {
                    allText += `Sub-page (${deepUrl}):\n${subPage.text.substring(0, 3000)}\n\n`;
                    deepMatches.push(deepUrl);
                }
            } catch (err) {
                console.warn(`[DEEP LEARN] Skipping ${deepUrl}: ${err.message}`);
            }
        }

        console.log(`[DEEP LEARN] Synthesis triggered for ${deepMatches.length + 1} pages total.`);

        await vectorEngine.addInformation(allText, `Web Study: ${url}`);

        const detected = knowledgeService.extractSkills(allText, knowledgeService.MASTER_DICTIONARY);
        const kb = knowledgeService.knowledgeBase;
        kb.skills = [...new Set([...(kb.skills || []), ...detected])];

        aiService.synthesizeExpertIdentity(allText, kb, knowledgeService.saveKB)
            .catch(e => console.error('[SYNTH] Background failed:', e.message));

        if (!kb.websites.includes(url)) {
            kb.websites.push(url);
        }
        await knowledgeService.saveKB();

        res.json({
            success: true,
            detectedSkills: detected,
            message: `Deep Learning complete. Explored ${deepMatches.length} sub-pages and identified ${detected.length} competencies.`
        });
    } catch (error) {
        console.error(`[DEEP LEARN ERROR] Failed:`, error.message);
        res.status(500).json({ error: 'Failed to perform deep crawl. Check URL accessibility.' });
    }
});

// 3. Upload and Parse CV (PDF/DOCX)
router.post('/api/upload-cv', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        let extractedText = '';
        const fileBuffer = req.file.buffer;
        const filename = req.file.originalname.toLowerCase();

        console.log(`[UPLOAD] Processing file: ${filename}`);

        try {
            if (filename.endsWith('.pdf')) {
                const data = await pdfParse(fileBuffer);
                extractedText = data.text;
            } else if (filename.endsWith('.docx')) {
                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                extractedText = result.value;
            } else {
                extractedText = fileBuffer.toString('utf8');
            }
        } catch (e) {
            console.warn(`[INGESTION] Failed to parse ${filename}, skipping...`);
            extractedText = '';
        }

        if (!extractedText || !extractedText.trim()) {
            console.warn(`[UPLOAD WARNING] No text extracted from ${filename}. Node might be empty or scanned image.`);
            extractedText = `[Empty or Non-textual Node: ${filename}]`;
        }

        const detected = knowledgeService.extractSkills(extractedText, knowledgeService.MASTER_DICTIONARY);
        const kb = knowledgeService.knowledgeBase;
        kb.skills = [...new Set([...(kb.skills || []), ...detected])];
        kb.expertProfile = `Uploaded CV (${filename}):\n\n${extractedText}\n\n${kb.expertProfile}`.substring(0, 100000);

        await vectorEngine.addInformation(extractedText, `CV Upload: ${filename}`);

        // AI Structured CV Parsing & Identity Synthesis
        let parsedCV = null;
        if (extractedText.length > 50) {
            try {
                console.log(`[UPLOAD] Running AI Structured CV Parser on ${filename}...`);
                parsedCV = await aiService.parseStructuredCV(extractedText);
            } catch (parseErr) {
                console.warn(`[UPLOAD WARNING] AI structured parsing failed, continuing with basic extraction:`, parseErr.message);
            }
        }

        if (parsedCV) {
            const cvPath = path.join(__dirname, '..', 'user_cv.json');
            let existing = {};
            if (fs.existsSync(cvPath)) {
                try { existing = JSON.parse(fs.readFileSync(cvPath, 'utf8')); } catch (e) { existing = {}; }
            }
            parsedCV.projects = knowledgeService.mergeProjects(parsedCV.projects, existing.projects);
            if (!parsedCV.preferences && existing.preferences) parsedCV.preferences = existing.preferences;
            if (!parsedCV.screening && existing.screening) parsedCV.screening = existing.screening;
            fs.writeFileSync(cvPath, JSON.stringify(parsedCV, null, 2), 'utf8');
            console.log(`[UPLOAD] Updated user_cv.json with candidate: ${parsedCV.personal_info?.name}`);

            kb.identity = kb.identity || {};
            kb.identity.personal_info = parsedCV.personal_info;
            if (parsedCV.summary) kb.identity.summary = parsedCV.summary;
            if (parsedCV.personal_info?.title) kb.identity.industryNiche = parsedCV.personal_info.title;
            if (parsedCV.hard_skills?.length) {
                kb.identity.topSkills = parsedCV.hard_skills;
                kb.skills = [...new Set([...(kb.skills || []), ...parsedCV.hard_skills, ...detected])];
            }
            if (parsedCV.experience?.length) {
                kb.identity.experience = parsedCV.experience.map(e => ({
                    role: e.role,
                    company: e.company,
                    year: e.period,
                    description: Array.isArray(e.bullets) ? e.bullets.join('. ') : (e.bullets || '')
                }));
            }
            if (parsedCV.certifications?.length) {
                kb.identity.certifications = parsedCV.certifications.map(c => typeof c === 'string' ? { name: c, issuer: '' } : c);
            }
        }

        await knowledgeService.saveKB();
        await knowledgeService.seedCvIntoMemory();

        res.json({
            success: true,
            profile: parsedCV,
            detectedSkills: parsedCV ? parsedCV.hard_skills : detected,
            message: `CV de ${parsedCV?.personal_info?.name || filename} analisado e perfil atualizado com sucesso!`
        });
    } catch (error) {
        console.error(`[UPLOAD ERROR] Failed to process ${req.file.originalname}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/cv/ingest-project', validateBody(IngestProjectSchema), async (req, res) => {
    try {
        const payload = req.validatedBody || req.body;
        const { project } = await knowledgeService.ingestStructuredProject(payload);
        res.json({
            success: true,
            project,
            message: `Projeto "${project.title}" gravado em user_cv.json, identity.relationalProjects e candidate_memory.`
        });
    } catch (error) {
        console.error('[INGEST PROJECT]', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/cv/ingest-experience', validateBody(IngestExperienceSchema), async (req, res) => {
    try {
        const payload = req.validatedBody || req.body;
        await knowledgeService.ingestExperienceBullet(payload);
        res.json({
            success: true,
            message: `Bullet adicionado a ${payload.company}.`
        });
    } catch (error) {
        console.error('[INGEST EXPERIENCE]', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/cv/ingest-text', validateBody(IngestLessonSchema), async (req, res) => {
    try {
        const { text, kind } = req.validatedBody || req.body;
        const result = await knowledgeService.ingestTeachText(text, kind || 'project_notes');
        res.json({
            success: true,
            ...result,
            message: 'Texto indexado na memória semântica.'
        });
    } catch (error) {
        console.error('[INGEST TEXT]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Configure Groq API Key
router.post('/api/config/groq', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    const kb = knowledgeService.knowledgeBase;
    kb.groqApiKey = apiKey;
    process.env.GROQ_API_KEY = apiKey;
    aiService.initAI({ groqApiKey: apiKey });
    await knowledgeService.saveKB();

    console.log('[CONFIG] Groq API Key updated and persisted');
    res.json({ success: true, message: 'Groq AI Engine initialized' });
});

// 5. Configure LinkedIn Cookie (Zero-Trust Session Vault)
router.post('/api/config/cookie', validateBody(CookieConfigSchema), (req, res) => {
    try {
        let { cookie, li_at } = req.validatedBody || req.body;
        let rawVal = cookie || li_at || '';

        if (rawVal.includes('li_at=')) {
            const match = rawVal.match(/li_at=([^;]+)/);
            if (match) rawVal = match[1];
        }
        rawVal = rawVal.trim().replace(/^"|"$/g, '');

        process.env.LI_AT = rawVal;
        process.env.LINKEDIN_COOKIE = `li_at=${rawVal}`;

        // 1. Vault Storage
        try {
            vaultService.storeSecret('li_at', rawVal);
            vaultService.storeSecret('linkedin_cookie', `li_at=${rawVal}`);
            loggerService.info('vault', 'LinkedIn session credentials safely encrypted in Zero-Trust Vault');
            telemetryService.emitSystemEvent('vault_updated', { credential: 'li_at' });
        } catch (vaultErr) {
            loggerService.error('vault', 'Failed to encrypt credentials in vault:', vaultErr);
        }

        // 2. Restart MCP Engine to reload credentials
        console.log('[CONFIG] Restarting LinkedIn Engine to apply new cookie credentials...');
        mcpService.restartLinkedInMCP();

        res.json({ success: true, message: 'LinkedIn Cookie updated, safely encrypted in vault, and engine reconnected.' });
    } catch (error) {
        console.error('[CONFIG ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. Get Expert Profile
router.get('/api/expert-profile', async (req, res) => {
    try {
        const freshData = await vectorEngine.getUserProfile();
        if (freshData && Object.keys(freshData).length > 0) {
            Object.assign(knowledgeService.knowledgeBase, freshData);
        }
        res.json(knowledgeService.knowledgeBase);
    } catch (e) {
        console.error('[API EXPERT-PROFILE GET ERROR]', e.message);
        res.json(knowledgeService.knowledgeBase);
    }
});

// 7. Generate Professional Bio
router.post('/api/generate-bio', async (req, res) => {
    if (!aiService.getGroqClient() && !aiService.getGeminiModel()) {
        return res.status(503).json({ error: 'AI Engines offline' });
    }

    console.log('[AI] Generating High-Impact Professional Bio...');
    const kb = knowledgeService.knowledgeBase;

    const prompt = `
        YOU ARE AN ELITE COPYWRITER SPECIALIZING IN PERSONAL BRANDING FOR TECH LEADERS (2026).
        Your task is to create an ultra-impactful professional summary in ENGLISH.
        
        IDENTITY DATA:
        ${JSON.stringify(kb.identity, null, 2)}
        
        INSTRUCTIONS:
        1. LANGUAGE: ENGLISH.
        2. TONE: Visionary, Premium, Highly Professional, and Result-Oriented.
        3. FOCUS: Fusion of Strategic Design (Digital Art) and Complex Automation (Agentic Workflows/AI).
        4. STRUCTURE: 2 short and powerful paragraphs.
        5. KEYWORDS: Creative Technologist, Solutions Architect, ROI, Scalability, Agentic Automation, Digital Art.
        
        Respond ONLY with the summary text in English. Do not include greetings or explanations.
    `;

    try {
        const bio = await aiService.getCombinedAICompletion(prompt, 'You are an elite professional branding architect.', false);
        res.json({ bio });
    } catch (error) {
        console.error('[AI ERROR] Bio generation failed:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 8. Fetch LinkedIn Profile (Sync "me")
router.get('/api/profile', async (req, res) => {
    try {
        console.log(`[PROFILE] Fetching profile for "me"`);
        const result = await mcpService.callEngine('get_person_profile', {
            linkedin_username: 'me',
            sections: 'experience,skills,education'
        });

        let data = result.content ? result.content[0].text : result;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }

        const userSkills = data.skills || [];
        const kb = knowledgeService.knowledgeBase;

        const expArray = Array.isArray(data.experience) ? data.experience : [];
        const experienceText = expArray.map(exp => `${exp.title || ''} em ${exp.company || ''}`).filter(t => t.trim().length > 5).join(', ');

        let profileParts = [];
        if (data.headline) profileParts.push(`Headline: ${data.headline}`);
        if (data.summary) profileParts.push(`Summary: ${data.summary}`);
        if (experienceText) profileParts.push(`Experience: ${experienceText}`);

        const fullProfileSummary = profileParts.join('\n');

        if (fullProfileSummary.trim()) {
            kb.expertProfile = `[LinkedIn Sync ${new Date().toLocaleDateString()}]:\n${fullProfileSummary}\n\n${kb.expertProfile}`.substring(0, 15000);
            await vectorEngine.addInformation(fullProfileSummary, 'LinkedIn Profile Sync');
            await knowledgeService.saveKB();

            if (aiService.getGroqClient()) {
                await aiService.synthesizeExpertIdentity(fullProfileSummary, kb, knowledgeService.saveKB);
            }
        }

        res.json({
            name: data.name || 'LinkedIn User',
            headline: data.headline || 'Professional',
            skills: userSkills,
            experience: data.experience || []
        });
    } catch (error) {
        console.error('[PROFILE ERROR]', error.message);
        res.status(503).json({ error: error.message });
    }
});

// 9. Neural Synthesized CV
router.get('/api/cv/neural', (req, res) => {
    try {
        const cvPath = path.join(__dirname, '..', 'user_cv.json');
        const examplePath = path.join(__dirname, '..', 'user_cv.json.example');
        const activePath = fs.existsSync(cvPath) ? cvPath : (fs.existsSync(examplePath) ? examplePath : null);

        let masterProfile = {};
        if (activePath && fs.existsSync(activePath)) {
            masterProfile = JSON.parse(fs.readFileSync(activePath, 'utf8'));
        }

        const kb = knowledgeService.knowledgeBase;
        const neuralIdentity = kb.identity || {};

        // Merge skills accurately
        const cvHardSkills = Array.isArray(masterProfile.hard_skills)
            ? masterProfile.hard_skills
            : (typeof masterProfile.hard_skills === 'object' && masterProfile.hard_skills !== null)
                ? Object.values(masterProfile.hard_skills).flat()
                : [];

        const normalizedHardSkills = cvHardSkills.length > 0
            ? cvHardSkills
            : (neuralIdentity.topSkills && neuralIdentity.topSkills.length > 0
                ? neuralIdentity.topSkills
                : (kb.skills || []));

        const combinedProfile = {
            personal_info: {
                ...(neuralIdentity.personal_info || {}),
                ...(masterProfile.personal_info || {}),
                name: masterProfile.personal_info?.name || neuralIdentity.personal_info?.name || "Neural Scout Candidate",
                title: masterProfile.personal_info?.title || neuralIdentity.personal_info?.title || neuralIdentity.industryNiche || "Solutions Architect & Engineer",
                email: masterProfile.personal_info?.email || neuralIdentity.personal_info?.email || "candidate@example.com",
                location: masterProfile.personal_info?.location || neuralIdentity.personal_info?.location || "Remote",
                phone: masterProfile.personal_info?.phone || neuralIdentity.personal_info?.phone || "+123456789",
                website: masterProfile.personal_info?.website || neuralIdentity.personal_info?.website || "github.com"
            },
            summary: masterProfile.summary || neuralIdentity.summary || "",
            experience: (masterProfile.experience && masterProfile.experience.length > 0)
                ? masterProfile.experience
                : (neuralIdentity.experience && neuralIdentity.experience.length > 0
                    ? neuralIdentity.experience.map(exp => ({
                        company: exp.company,
                        role: exp.role,
                        period: exp.year,
                        bullets: Array.isArray(exp.description) ? exp.description : [exp.description]
                    }))
                    : []),
            hard_skills: normalizedHardSkills,
            certifications: masterProfile.certifications || neuralIdentity.certifications || [],
            education: masterProfile.education?.length ? masterProfile.education : (neuralIdentity.education || []),
            languages: masterProfile.languages?.length ? masterProfile.languages : (neuralIdentity.languages || []),
            soft_skills: masterProfile.soft_skills || neuralIdentity.softSkills || [],
            tech_philosophy: neuralIdentity.techPhilosophy || masterProfile.techPhilosophy || "",
            projects: knowledgeService.mergeProjects(masterProfile.projects, neuralIdentity.relationalProjects),
            books_read: masterProfile.books_read || neuralIdentity.booksRead || [],
            preferences: masterProfile.preferences || '',
            screening: masterProfile.screening || '',
            job_search: masterProfile.job_search || null
        };

        res.json({ success: true, profile: combinedProfile });
    } catch (error) {
        console.error('[CV API ERROR]', error.message);
        res.status(500).json({ error: 'Failed to retrieve neural CV.' });
    }
});

function sanitizeAtsText(value) {
    if (value == null) return '';
    if (typeof value !== 'string') return value;
    return value
        .replace(/\u2014|\u2013/g, ',')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Prefer full sentences over hard substring (avoids bullets ending mid-word or with ".."). */
function truncateAtSentence(text, maxLen = 280) {
    const t = sanitizeAtsText(text);
    if (!t || t.length <= maxLen) return t;
    const slice = t.slice(0, maxLen);
    const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
    if (lastSentence >= Math.floor(maxLen * 0.5)) {
        return slice.slice(0, lastSentence + 1).trim();
    }
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > 48 ? slice.slice(0, lastSpace) : slice;
    return cut.trim().replace(/[.,;:\s]+$/, '') + '.';
}

function polishBulletEnding(text) {
    let t = sanitizeAtsText(text);
    if (!t) return '';
    t = t.replace(/(\.\.)+$/, '').replace(/…+$/g, '').trim();
    if (t && !/[.!?)]$/.test(t)) {
        t += '.';
    }
    return t;
}

/** Date ranges: keep readable hyphens (never comma between month and Present). */
function normalizeAtsPeriod(value) {
    if (value == null) return '';
    return String(value)
        .replace(/\u2014|\u2013/g, ' - ')
        .replace(/\s+to\s+/gi, ' - ')
        .replace(/\s*-\s*/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim();
}

function experienceCompanyKey(name) {
    return (name || '')
        .toLowerCase()
        .replace(/estores\s*rainha|estoresrainha/g, 'habitarmos')
        .replace(/[^a-z0-9]/g, '');
}

const COMMON_HALLUCINATED_TOOLS = [
    { re: /\bamazon web services\b/gi, key: 'aws' },
    { re: /\baws\b/gi, key: 'aws' },
    { re: /\bmicrosoft azure\b/gi, key: 'azure' },
    { re: /\bazure\b/gi, key: 'azure' },
    { re: /\bkubernetes\b/gi, key: 'kubernetes' },
    { re: /\bk8s\b/gi, key: 'kubernetes' },
    { re: /\bterraform\b/gi, key: 'terraform' }
];

function isHabitarmosCompany(name) {
    const k = experienceCompanyKey(name);
    return k.includes('habitarmos');
}

function companiesMatch(a, b) {
    const ak = experienceCompanyKey(a);
    const bk = experienceCompanyKey(b);
    if (!ak || !bk) return false;
    return ak === bk || ak.includes(bk) || bk.includes(ak);
}

function periodStart(period) {
    const p = normalizeAtsPeriod(period);
    const parts = p.split(' - ');
    return (parts[0] || p).trim();
}

function meaningfulTokens(text) {
    const stop = new Set(['with', 'from', 'that', 'this', 'have', 'been', 'were', 'their', 'through', 'across', 'using', 'into']);
    return tokenizeForJdMatch(text).filter((t) => t.length > 3 && !stop.has(t));
}

function buildCompanyEvidenceCorpus(sourceEntries, projects, companyKey) {
    let text = '';
    (sourceEntries || []).forEach((e) => {
        text += ` ${(e.bullets || []).join(' ')} ${e.role || ''}`;
    });
    (projects || []).forEach((p) => {
        if (!companiesMatch(p.company, sourceEntries[0]?.company || '')) return;
        text += ` ${p.context || ''} ${(p.bullets || []).join(' ')} ${(p.edges_outcomes || p.outcomes || []).join(' ')}`;
    });
    return text.toLowerCase();
}

function bulletHasFactualOverlap(bullet, corpus) {
    if (!bullet || !corpus) return false;
    const tokens = meaningfulTokens(bullet);
    if (!tokens.length) return false;
    let hits = 0;
    for (const t of tokens) {
        if (corpus.includes(t)) hits++;
    }
    return hits >= 2;
}

function rankBulletsForJob(bullets, jobText, limit = 4) {
    const unique = [];
    const seen = new Set();
    for (const b of bullets || []) {
        const line = guardEnglishField(b);
        if (!line || seen.has(line)) continue;
        seen.add(line);
        unique.push(line);
    }
    return unique
        .sort((a, b) => jdOverlapScore(b, jobText) - jdOverlapScore(a, jobText))
        .slice(0, limit);
}

function collectFactualBulletsForCompany(sourceEntries, projects, companyLabel, jobText) {
    const bullets = (sourceEntries || []).flatMap((e) => e.bullets || []);
    const fromProjects = (projects || [])
        .filter((p) => companiesMatch(p.company, companyLabel || sourceEntries[0]?.company || ''))
        .flatMap((p) => {
            const title = p.title || p.name || '';
            const impl = (p.bullets || p.implementation_highlights || []).map((b) =>
                title ? `${title}: ${b}` : b
            );
            const outs = (p.edges_outcomes || p.outcomes || []).map((o) =>
                title ? `${title}: ${o}` : o
            );
            return [...impl, ...outs];
        });
    return rankBulletsForJob([...bullets, ...fromProjects], jobText, 12);
}

function buildAtsTailorAnchors(operational_metrics, rankedProjects, roi_metrics) {
    const lines = [];
    if (operational_metrics?.n8n_production_workflows) {
        const exec = operational_metrics.n8n_executions_last_7_days;
        lines.push(
            `Automation scale: ${operational_metrics.n8n_production_workflows} production n8n workflows` +
                (exec ? ` (~${exec.toLocaleString('en-US')} executions in a recent 7-day window)` : '')
        );
    }
    if (operational_metrics?.phc_erp_sources?.length) {
        const dbs = operational_metrics.phc_erp_sources
            .map((s) => `${s.database} (~${s.base_tables_count?.toLocaleString('en-US')} tables)`)
            .join(', ');
        lines.push(`PHC ERP cloud ELT sources: ${dbs}`);
    } else if (operational_metrics?.phc_erp_source?.database) {
        lines.push(
            `PHC ERP: ${operational_metrics.phc_erp_source.database} (~${operational_metrics.phc_erp_source.base_tables_count} tables)`
        );
    }
    if (roi_metrics?.portfolio_roi_percent) {
        lines.push(`Innovation Hub portfolio ROI ~${roi_metrics.portfolio_roi_percent}% on delivered automation`);
    }
    (rankedProjects || []).slice(0, 4).forEach((p) => {
        const title = p.title || p.name;
        const hit = (p.outcomes || [])[0] || (p.context || '').substring(0, 200);
        if (title && hit) lines.push(`${title}: ${hit}`);
    });
    return lines.filter(Boolean).slice(0, 10);
}

function ensureRankedProjectsOnCv(tailored, rankedProjects, max = 3) {
    const ranked = (rankedProjects || []).slice(0, max);
    const fromAi = tailored.selected_projects || [];
    const out = [];
    for (const p of ranked) {
        const name = sanitizeAtsText(p.title || p.name || '');
        if (!name) continue;
        const aiMatch = fromAi.find(
            (a) => a.name && name.toLowerCase().includes(String(a.name).toLowerCase().slice(0, 24))
        );
        const impact = guardEnglishField(
            polishBulletEnding(
                aiMatch?.impact ||
                    (p.outcomes && p.outcomes[0]) ||
                    (p.bullets && p.bullets[0]) ||
                    truncateAtSentence(p.context || '', 300)
            )
        );
        if (!impact) continue;
        if (out.some((x) => x.name === name)) continue;
        out.push({ name, impact });
        if (out.length >= max) break;
    }
    for (const a of fromAi) {
        if (out.length >= max) break;
        const name = sanitizeAtsText(a.name || '');
        const impact = guardEnglishField(a.impact || '');
        if (!name || !impact || out.some((x) => x.name === name)) continue;
        out.push({ name, impact });
    }
    tailored.selected_projects = out.slice(0, max);
    return tailored;
}

function pickBestSourceBullet(sourceEntries, jobText, aiBullet = '') {
    const pool = (sourceEntries || []).flatMap((e) => (e.bullets || []).filter(Boolean));
    if (!pool.length) return guardEnglishField(aiBullet || '');
    let best = pool[0];
    let bestScore = -1;
    for (const b of pool) {
        let score = jdOverlapScore(b, jobText);
        const aiTokens = meaningfulTokens(aiBullet);
        aiTokens.forEach((t) => {
            if (b.toLowerCase().includes(t)) score += 1;
        });
        if (score > bestScore) {
            bestScore = score;
            best = b;
        }
    }
    return guardEnglishField(best);
}

function groundExperienceBullets(experience, fullExperience, projects, jobText) {
    return (experience || []).map((exp) => {
        const sources = (fullExperience || []).filter((e) => companiesMatch(e.company, exp.company));
        const corpus = buildCompanyEvidenceCorpus(sources, projects, experienceCompanyKey(exp.company));
        const grounded = [];
        const usedSource = new Set();
        for (const b of exp.bullets || []) {
            const cleaned = guardEnglishField(b);
            if (!cleaned) continue;
            if (bulletHasFactualOverlap(cleaned, corpus)) {
                grounded.push(cleaned);
            } else {
                const replacement = pickBestSourceBullet(sources, jobText, cleaned);
                if (replacement && !usedSource.has(replacement)) {
                    usedSource.add(replacement);
                    grounded.push(replacement);
                }
            }
        }
        if (grounded.length < 4) {
            const ranked = collectFactualBulletsForCompany(sources, projects, exp.company, jobText).filter(
                (b) => !usedSource.has(b)
            );
            for (const line of ranked) {
                if (grounded.length >= 4) break;
                if (line && !grounded.includes(line)) {
                    grounded.push(line);
                    usedSource.add(line);
                }
            }
        }
        const companyPool = collectFactualBulletsForCompany(sources, projects, exp.company, jobText);
        const finalBullets = rankBulletsForJob(
            [...new Set([...grounded, ...companyPool])],
            jobText,
            4
        );
        return { ...exp, bullets: finalBullets };
    });
}

function consolidateHabitarmosInExperience(tailoredExperience, fullExperience, projects, jobText, maxSlots = 3) {
    const habitarmosRoles = (fullExperience || []).filter((e) => isHabitarmosCompany(e.company));
    if (habitarmosRoles.length < 2) return tailoredExperience;

    const newest = habitarmosRoles[0];
    const oldest = habitarmosRoles[habitarmosRoles.length - 1];
    const roleTimeline = habitarmosRoles.map((e) => ({
        role: e.role,
        period: normalizeAtsPeriod(e.period)
    }));
    const spanPeriod = `${periodStart(oldest.period)} - Present`;

    const poolBullets = collectFactualBulletsForCompany(
        habitarmosRoles,
        projects,
        newest.company,
        jobText
    );
    const bullets = poolBullets.slice(0, 4);

    const consolidated = {
        company: newest.company,
        role: newest.role,
        period: spanPeriod,
        role_timeline: roleTimeline,
        bullets
    };

    const others = (tailoredExperience || []).filter((e) => !isHabitarmosCompany(e.company));
    return [consolidated, ...others].slice(0, maxSlots);
}

function buildAllowedTechTerms(combinedProfile) {
    const terms = new Set();
    (combinedProfile.hard_skills || []).forEach((s) => {
        const low = String(s).toLowerCase().trim();
        if (low) terms.add(low);
    });
    (combinedProfile.projects || []).forEach((p) => {
        flattenProjectTech(p).forEach((t) => terms.add(String(t).toLowerCase()));
        (p.edges_skills || []).forEach((t) => terms.add(String(t).toLowerCase()));
    });
    (combinedProfile.soft_skills || []).forEach((s) => terms.add(String(s).toLowerCase()));
    if (terms.has('google cloud platform (gcp)')) terms.add('gcp');
    if (terms.has('google cloud platform (gcp)')) terms.add('google cloud');
    return terms;
}

function termIsAllowed(key, allowedTerms) {
    if (allowedTerms.has(key)) return true;
    for (const t of allowedTerms) {
        if (t.includes(key) || key.includes(t)) return true;
    }
    return false;
}

function stripUnauthorizedClaimsFromText(text, allowedTerms) {
    if (!text || typeof text !== 'string') return text;
    let out = text;
    for (const { re, key } of COMMON_HALLUCINATED_TOOLS) {
        if (!termIsAllowed(key, allowedTerms)) {
            out = out.replace(re, '');
        }
    }
    return out.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

function stripUnauthorizedClaimsFromCv(tailored, combinedProfile) {
    const allowed = buildAllowedTechTerms(combinedProfile);
    const out = { ...tailored };
    out.summary = stripUnauthorizedClaimsFromText(out.summary, allowed);
    out.target_headline = stripUnauthorizedClaimsFromText(out.target_headline, allowed);
    out.hard_skills = (out.hard_skills || []).filter((skill) => {
        const low = String(skill).toLowerCase();
        for (const { key } of COMMON_HALLUCINATED_TOOLS) {
            if (low.includes(key) && !termIsAllowed(key, allowed)) return false;
        }
        return true;
    });
    out.experience = (out.experience || []).map((exp) => ({
        ...exp,
        bullets: (exp.bullets || []).map((b) => stripUnauthorizedClaimsFromText(b, allowed)).filter(Boolean)
    }));
    if (out.core_competencies && typeof out.core_competencies === 'object') {
        for (const key of Object.keys(out.core_competencies)) {
            if (Array.isArray(out.core_competencies[key])) {
                out.core_competencies[key] = out.core_competencies[key]
                    .map((s) => stripUnauthorizedClaimsFromText(s, allowed))
                    .filter(Boolean);
            }
        }
    }
    return out;
}

function alignExperienceWithSource(aiExperience, sourceExperience) {
    const sources = Array.isArray(sourceExperience) ? sourceExperience : [];
    const used = new Set();
    return (aiExperience || []).map((exp) => {
        const ck = experienceCompanyKey(exp.company);
        const roleWords = (exp.role || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        let bestIdx = -1;
        let bestScore = 0;
        sources.forEach((s, idx) => {
            if (used.has(idx)) return;
            const sk = experienceCompanyKey(s.company);
            if (!sk || !ck) return;
            if (sk !== ck && !sk.includes(ck) && !ck.includes(sk)) return;
            const sr = (s.role || '').toLowerCase();
            let score = 1;
            roleWords.forEach((w) => {
                if (sr.includes(w)) score += 2;
            });
            if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
            }
        });
        const period = normalizeAtsPeriod(exp.period);
        if (bestIdx >= 0) {
            used.add(bestIdx);
            const match = sources[bestIdx];
            return {
                ...exp,
                company: match.company,
                role: match.role,
                period: normalizeAtsPeriod(match.period),
                bullets: (exp.bullets || []).slice(0, 4)
            };
        }
        return { ...exp, period, bullets: (exp.bullets || []).slice(0, 4) };
    });
}

function normalizeAtsEducationLine(entry) {
    if (typeof entry === 'string') return sanitizeAtsText(entry);
    if (!entry || typeof entry !== 'object') return '';
    const degree = entry.degree || entry.title || '';
    const institution = entry.institution || entry.school || '';
    const details = entry.details || entry.period || entry.year || '';
    const line = [degree, institution].filter(Boolean).join(', ');
    return sanitizeAtsText(details ? `${line} (${details})` : line);
}

function normalizeAtsCertLine(entry) {
    if (typeof entry === 'string') return sanitizeAtsText(entry);
    if (!entry || typeof entry !== 'object') return '';
    const name = entry.name || entry.title || entry.certification || '';
    const issuer = entry.issuer || entry.organization || '';
    const year = entry.year || entry.date || '';
    return sanitizeAtsText([name, issuer, year].filter(Boolean).join(', '));
}

const PT_LEAK_PATTERN = /\b(não|nao|como|para|gestão|gestao|empresa|vaga|oportunidade|experiência|experiencia|desenvolvimento|automação|automacao|sistemas|utilizador|equipa|comercial|obra|distribuidor|formação|formacao|certificação|certificacao)\b/i;

function looksLikePortuguese(text) {
    if (!text || typeof text !== 'string') return false;
    return PT_LEAK_PATTERN.test(text);
}

function guardEnglishField(text) {
    const cleaned = sanitizeAtsText(text);
    if (!cleaned) return '';
    if (looksLikePortuguese(cleaned)) return '';
    return cleaned;
}

function tokenizeForJdMatch(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9+#./\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

function jdOverlapScore(blob, jobText) {
    const jobTokens = tokenizeForJdMatch(jobText);
    if (!jobTokens.length) return 0;
    const blobStr = typeof blob === 'string' ? blob : JSON.stringify(blob);
    const blobTokens = tokenizeForJdMatch(blobStr);
    let hits = 0;
    for (const t of blobTokens) {
        const matched = jobTokens.some((jt) => jt === t || jt.includes(t) || t.includes(jt));
        if (matched) hits++;
    }
    return hits;
}

function flattenProjectTech(project) {
    const out = [];
    if (Array.isArray(project.technologies)) out.push(...project.technologies);
    if (Array.isArray(project.tech_stack)) out.push(...project.tech_stack);
    if (project.tech_stack && typeof project.tech_stack === 'object' && !Array.isArray(project.tech_stack)) {
        Object.values(project.tech_stack).forEach((v) => {
            if (Array.isArray(v)) out.push(...v);
            else if (typeof v === 'string') out.push(v);
        });
    }
    if (Array.isArray(project.edges_skills)) out.push(...project.edges_skills);
    const unique = [];
    const seen = new Set();
    for (const item of out) {
        const s = String(item).trim();
        if (!s) continue;
        const key = s.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
        }
    }
    return unique.slice(0, 24);
}

function mapProjectForAtsSource(p) {
    return {
        title: p.title || p.name,
        company: p.company,
        period: p.period || '',
        repository: p.repository || '',
        context: sanitizeAtsText((p.context || p.description || '').substring(0, 520)),
        modules: Array.isArray(p.modules) ? p.modules.slice(0, 6).map(sanitizeAtsText) : [],
        bullets: (p.bullets || p.implementation_highlights || []).slice(0, 6).map(sanitizeAtsText),
        outcomes: (p.edges_outcomes || p.outcomes || []).slice(0, 6).map(sanitizeAtsText),
        tech: flattenProjectTech(p),
        edges_skills: (p.edges_skills || []).slice(0, 12).map(sanitizeAtsText)
    };
}

function buildAtsSourcePayload(combinedProfile, neuralIdentity, masterProfile, jobContext = {}) {
    const jdText = `${jobContext.jobTitle || ''} ${jobContext.jobDescription || ''}`;
    const priorityBoost = { flagship: 15, high: 8 };

    const rankedProjects = (combinedProfile.projects || [])
        .filter((p) => p && p.portfolio_priority !== 'low')
        .sort((a, b) => {
            const scoreA = jdOverlapScore(a, jdText) + (priorityBoost[a.portfolio_priority] || 0);
            const scoreB = jdOverlapScore(b, jdText) + (priorityBoost[b.portfolio_priority] || 0);
            return scoreB - scoreA;
        })
        .slice(0, 6)
        .map(mapProjectForAtsSource);

    const rankedExperience = (combinedProfile.experience || [])
        .sort((a, b) => {
            const blobA = `${a.role} ${a.company} ${(a.bullets || []).join(' ')}`;
            const blobB = `${b.role} ${b.company} ${(b.bullets || []).join(' ')}`;
            return jdOverlapScore(blobB, jdText) - jdOverlapScore(blobA, jdText);
        })
        .slice(0, 4)
        .map((exp) => ({
            company: exp.company,
            role: exp.role,
            period: exp.period,
            location: exp.location,
            bullets: rankBulletsForJob(exp.bullets || [], jdText, 6).map(sanitizeAtsText)
        }));

    const operational_metrics =
        masterProfile?.operational_metrics ||
        neuralIdentity.operational_metrics ||
        null;
    const dev_tooling = masterProfile?.dev_tooling || null;

    const tailor_anchors = buildAtsTailorAnchors(
        operational_metrics,
        rankedProjects,
        neuralIdentity.roi_metrics || null
    );

    return {
        personal_info: combinedProfile.personal_info,
        summary: sanitizeAtsText((combinedProfile.summary || '').substring(0, 900)),
        experience: rankedExperience,
        hard_skills: (combinedProfile.hard_skills || []).slice(0, 80),
        soft_skills: combinedProfile.soft_skills,
        education: combinedProfile.education,
        certifications: combinedProfile.certifications,
        languages: combinedProfile.languages,
        projects: rankedProjects,
        operational_metrics,
        dev_tooling,
        roi_metrics: neuralIdentity.roi_metrics || null,
        tech_philosophy: neuralIdentity.techPhilosophy || null,
        tailor_anchors
    };
}

/** Keep Groq on-demand TPM (~8k) by sending a dense, capped source blob. */
function stringifyAtsSourceForTailorPrompt(atsSource, maxChars = 9000) {
    const compact = {
        personal_info: atsSource.personal_info,
        summary: atsSource.summary,
        experience: (atsSource.experience || []).map((e) => ({
            company: e.company,
            role: e.role,
            period: e.period,
            bullets: (e.bullets || []).slice(0, 4)
        })),
        hard_skills: (atsSource.hard_skills || []).slice(0, 24),
        education: atsSource.education,
        certifications: atsSource.certifications,
        projects: (atsSource.projects || []).slice(0, 4),
        operational_metrics: atsSource.operational_metrics,
        tailor_anchors: atsSource.tailor_anchors
    };
    let json = JSON.stringify(compact);
    if (json.length > maxChars) {
        compact.projects = (compact.projects || []).slice(0, 2);
        compact.hard_skills = (compact.hard_skills || []).slice(0, 16);
        json = JSON.stringify(compact);
    }
    if (json.length > maxChars) return json.substring(0, maxChars);
    return json;
}

const RETIRED_PORTFOLIO_HOST_RE = /alyekseyenko\.ovh/i;
const GITHUB_PORTFOLIO_URL = 'https://github.com/alyekseyenko';
const DEFAULT_PUBLIC_PROFILE_URL = 'https://www.linkedin.com/in/vadym-alyekseyenko-0113b11b0/';

function scrubRetiredPortfolioUrls(text) {
    if (!text || typeof text !== 'string') return text;
    let t = text;
    t = t.replace(/https?:\/\/(?:www\.)?alyekseyenko\.ovh[^\s,;)]*/gi, GITHUB_PORTFOLIO_URL);
    t = t.replace(/alyekseyenko\.ovh[^\s,;)]*/gi, 'github.com/alyekseyenko');
    t = t.replace(/\(portfolio:\s*alyekseyenko\.ovh\)/gi, '(production at HABITARMOS)');
    t = t.replace(/published on alyekseyenko\.ovh[^:]*:/gi, 'Portfolio case study:');
    t = t.replace(/\bon my site\b/gi, 'in open-source portfolio');
    return t.replace(/\s+/g, ' ').trim();
}

function normalizePublicWebsite(url) {
    const u = String(url || '').trim();
    if (!u || RETIRED_PORTFOLIO_HOST_RE.test(u)) return DEFAULT_PUBLIC_PROFILE_URL;
    return u;
}

function applyAtsSanitization(tailored) {
    const out = { ...tailored };
    if (out.personal_info && typeof out.personal_info === 'object') {
        out.personal_info = {
            ...out.personal_info,
            website: normalizePublicWebsite(out.personal_info.website)
        };
    }
    out.summary = scrubRetiredPortfolioUrls(guardEnglishField(out.summary || ''));
    out.target_headline = scrubRetiredPortfolioUrls(guardEnglishField(out.target_headline || ''));
    out.fit_notes = scrubRetiredPortfolioUrls(guardEnglishField(out.fit_notes || ''));
    out.hard_skills = (out.hard_skills || []).map(sanitizeAtsText).filter(Boolean);
    out.keywords_used = (out.keywords_used || []).map(sanitizeAtsText).filter(Boolean);
    out.experience = (out.experience || []).map((exp) => ({
        ...exp,
        company: sanitizeAtsText(exp.company || ''),
        role: sanitizeAtsText(exp.role || ''),
        period: normalizeAtsPeriod(exp.period || ''),
        role_timeline: Array.isArray(exp.role_timeline)
            ? exp.role_timeline.map((rt) => ({
                role: sanitizeAtsText(rt.role || ''),
                period: normalizeAtsPeriod(rt.period || '')
            }))
            : undefined,
        bullets: (exp.bullets || [])
            .map((b) => polishBulletEnding(scrubRetiredPortfolioUrls(guardEnglishField(b))))
            .filter(Boolean)
    }));
    out.education = (out.education || []).map(normalizeAtsEducationLine).filter(Boolean);
    out.certifications = (out.certifications || []).map(normalizeAtsCertLine).filter(Boolean);
    if (out.core_competencies && typeof out.core_competencies === 'object') {
        for (const key of Object.keys(out.core_competencies)) {
            const list = out.core_competencies[key];
            if (Array.isArray(list)) {
                out.core_competencies[key] = list.map(guardEnglishField).filter(Boolean);
            }
        }
    }
    if (Array.isArray(out.selected_projects)) {
        out.selected_projects = out.selected_projects.map((p) => ({
            name: sanitizeAtsText(p.name || p.title || ''),
            impact: polishBulletEnding(
                scrubRetiredPortfolioUrls(guardEnglishField(p.impact || p.one_liner || ''))
            )
        })).filter((p) => p.name);
    }
    return out;
}

function loadMasterProfileBundle() {
    const cvPath = path.join(__dirname, '..', 'user_cv.json');
    const examplePath = path.join(__dirname, '..', 'user_cv.json.example');
    const activePath = fs.existsSync(cvPath) ? cvPath : (fs.existsSync(examplePath) ? examplePath : null);

    let masterProfile = {};
    if (activePath) {
        masterProfile = JSON.parse(fs.readFileSync(activePath, 'utf8'));
    }

    const kb = knowledgeService.knowledgeBase;
    const neuralIdentity = kb.identity || {};

    const cvHardSkills = Array.isArray(masterProfile.hard_skills)
        ? masterProfile.hard_skills
        : (typeof masterProfile.hard_skills === 'object' && masterProfile.hard_skills !== null)
            ? Object.values(masterProfile.hard_skills).flat()
            : [];

    const normalizedHardSkills = cvHardSkills.length > 0
        ? cvHardSkills
        : (neuralIdentity.topSkills?.length ? neuralIdentity.topSkills : (kb.skills || []));

    const combinedProfile = {
        personal_info: {
            ...(neuralIdentity.personal_info || {}),
            ...(masterProfile.personal_info || {}),
            name: masterProfile.personal_info?.name || neuralIdentity.personal_info?.name || 'Candidate',
            title: masterProfile.personal_info?.title || neuralIdentity.personal_info?.title || neuralIdentity.industryNiche || 'Professional',
            email: masterProfile.personal_info?.email || neuralIdentity.personal_info?.email || '',
            location: masterProfile.personal_info?.location || neuralIdentity.personal_info?.location || '',
            phone: masterProfile.personal_info?.phone || neuralIdentity.personal_info?.phone || '',
            website: normalizePublicWebsite(
                masterProfile.personal_info?.website || neuralIdentity.personal_info?.website || ''
            )
        },
        summary: masterProfile.summary || neuralIdentity.summary || '',
        experience: (masterProfile.experience?.length)
            ? masterProfile.experience
            : (neuralIdentity.experience || []).map(exp => ({
                company: exp.company,
                role: exp.role,
                period: exp.year || exp.period,
                bullets: Array.isArray(exp.description) ? exp.description : [exp.description].filter(Boolean)
            })),
        hard_skills: normalizedHardSkills,
        certifications: masterProfile.certifications || neuralIdentity.certifications || [],
        education: masterProfile.education?.length ? masterProfile.education : (neuralIdentity.education || []),
        languages: masterProfile.languages?.length ? masterProfile.languages : (neuralIdentity.languages || []),
        soft_skills: masterProfile.soft_skills || neuralIdentity.softSkills || [],
        projects: knowledgeService.mergeProjects(masterProfile.projects, neuralIdentity.relationalProjects),
        books_read: masterProfile.books_read || neuralIdentity.booksRead || [],
        operational_metrics: masterProfile.operational_metrics || neuralIdentity.operational_metrics,
        dev_tooling: masterProfile.dev_tooling
    };

    return { masterProfile, neuralIdentity, combinedProfile };
}

function admissionChanceMeta(percent) {
    const score = Math.min(98, Math.max(5, Math.round(percent)));
    let level = 'low';
    let label_pt = 'Chance baixa';
    let label_en = 'Low chance';
    if (score >= 80) {
        level = 'high';
        label_pt = 'Chance alta';
        label_en = 'High chance';
    } else if (score >= 65) {
        level = 'good';
        label_pt = 'Boa chance';
        label_en = 'Good chance';
    } else if (score >= 45) {
        level = 'moderate';
        label_pt = 'Chance moderada';
        label_en = 'Moderate chance';
    }
    return { level, label_pt, label_en };
}

function keywordOverlapMeta(percent) {
    const score = Math.min(98, Math.max(5, Math.round(percent)));
    let level = 'low';
    let label_en = 'Limited keyword fit';
    let label_pt = 'Pouca sobreposição';
    if (score >= 80) {
        level = 'high';
        label_en = 'Strong keyword fit';
        label_pt = 'Forte sobreposição';
    } else if (score >= 65) {
        level = 'good';
        label_en = 'Solid keyword fit';
        label_pt = 'Boa sobreposição';
    } else if (score >= 45) {
        level = 'moderate';
        label_en = 'Partial keyword fit';
        label_pt = 'Sobreposição parcial';
    }
    return { level, label_en, label_pt, overlap_label_en: 'Keyword overlap' };
}

async function resolveAtsJobInput(validatedBody) {
    const body = validatedBody || {};
    const pastedDescription = (body.jobDescription || '').trim();
    const jobUrl = (body.jobUrl || '').trim();
    const overrideTitle = (body.jobTitle || '').trim();
    const overrideCompany = (body.company || '').trim();

    if (jobUrl) {
        try {
            const resolved = await jobService.resolveJobPostingFromUrl(jobUrl);
            const description =
                pastedDescription.length >= 10 ? pastedDescription : resolved.description;
            return {
                jobDescription: description,
                title: overrideTitle || resolved.title || 'Target Role',
                companyName: overrideCompany || resolved.company || 'Target Company',
                jobUrl: resolved.url || jobUrl,
                job_resolution: {
                    source: resolved.source,
                    location: resolved.location || '',
                    fetched_from_url: true
                }
            };
        } catch (urlErr) {
            if (pastedDescription.length >= 10) {
                console.warn('[ATS TAILOR] Job URL fetch failed, using pasted description:', urlErr.message);
                return {
                    jobDescription: pastedDescription,
                    title: overrideTitle || 'Target Role',
                    companyName: overrideCompany || 'Target Company',
                    jobUrl,
                    job_resolution: {
                        source: 'pasted_fallback',
                        location: '',
                        fetched_from_url: false,
                        url_error: urlErr.message
                    }
                };
            }
            throw urlErr;
        }
    }

    return {
        jobDescription: pastedDescription,
        title: overrideTitle || 'Target Role',
        companyName: overrideCompany || 'Target Company',
        jobUrl: null,
        job_resolution: null
    };
}

async function runAtsAgentBriefing(jobData, combinedProfile, neuralIdentity, candidateDigest, correlationId) {
    const profileBrief = [
        combinedProfile.summary || '',
        '',
        'CANDIDATE_FACT_DIGEST (facts only):',
        JSON.stringify(candidateDigest).substring(0, 14000)
    ].join('\n');
    const skills = [
        ...(combinedProfile.hard_skills || []),
        ...(neuralIdentity.topSkills || []),
        ...(knowledgeService.getAggregateUserSkills() || [])
    ];
    const resp = await aiEngineClient.atsBriefing(
        jobData,
        profileBrief,
        skills,
        candidateDigest,
        correlationId
    );
    if (!resp.success || !resp.data) return null;
    return resp.data;
}

// 9a. One-page ATS CV from job URL and/or pasted description (+ Scout/Strategist briefing)
router.post('/api/cv/tailor', validateBody(CvTailorSchema), async (req, res) => {
    try {
        const resolvedInput = await resolveAtsJobInput(req.validatedBody || req.body);
        const jobDescription = resolvedInput.jobDescription;
        const title = resolvedInput.title;
        const companyName = resolvedInput.companyName;

        if (!jobDescription || jobDescription.trim().length < 10) {
            return res.status(400).json({ error: 'Job description is too short after URL resolution.' });
        }

        console.log(
            `[ATS TAILOR] Generating one-page CV for ${title} @ ${companyName}` +
                (resolvedInput.job_resolution ? ` (from ${resolvedInput.job_resolution.source})` : '')
        );

        const { combinedProfile, neuralIdentity, masterProfile } = loadMasterProfileBundle();

        let memoryFragments = [];
        try {
            memoryFragments = await vectorEngine.searchCandidateMemory(jobDescription, 12);
        } catch (memErr) {
            console.warn('[ATS TAILOR] Memory search skipped:', memErr.message);
        }

        const memoryBlock = memoryFragments.length
            ? memoryFragments
                  .slice(0, 6)
                  .map((m, i) => `[${i + 1}] (${m.source}): ${m.text.substring(0, 520)}`)
                  .join('\n\n')
            : '(No additional memory fragments found; using CV and identity only.)';

        const atsSource = buildAtsSourcePayload(combinedProfile, neuralIdentity, masterProfile, {
            jobDescription,
            jobTitle: title
        });
        const rankedProjectsForCv = atsSource.projects || [];

        const candidateDigest = buildCandidateDigest({
            jobDescription,
            jobTitle: title
        });
        const contextInsights = buildAtsContextInsights(
            { jobDescription, jobTitle: title },
            memoryFragments,
            candidateDigest
        );

        let agentBriefing = null;
        try {
            agentBriefing = await runAtsAgentBriefing(
                {
                    title,
                    company: companyName,
                    description: jobDescription,
                    location: resolvedInput.job_resolution?.location || '',
                    url: resolvedInput.jobUrl || ''
                },
                combinedProfile,
                neuralIdentity,
                candidateDigest,
                req.correlationId
            );
        } catch (briefErr) {
            console.warn('[ATS TAILOR] Agent briefing skipped:', briefErr.message);
        }

        const agentBriefingBlock = agentBriefing
            ? `
AGENT BRIEFING (Scout + Strategist — emphasis only; never invent facts beyond CANDIDATE SOURCE):
SCOUT REPORT:
${(agentBriefing.scout_report || '').substring(0, 1600)}

STRATEGY ALIGNMENT:
${(agentBriefing.strategy_analysis || '').substring(0, 1600)}
`
            : '(Agent briefing unavailable — using CV source and memory only.)';

        const candidateForMatch = {
            title: title || combinedProfile.personal_info?.title || 'Professional',
            skills: [
                ...(combinedProfile.hard_skills || []),
                ...(neuralIdentity.topSkills || []),
                ...(knowledgeService.getAggregateUserSkills() || []),
                ...(candidateDigest.hard_skills || []),
                ...(candidateDigest.top_project_skills || [])
            ]
        };
        const heuristicFit = jobService.calculateMatchAnalysis(jobDescription, title, candidateForMatch);

        const prompt = `
You are a senior technical recruiter and ATS resume writer.
Produce a single one-page resume tailored to the job below.

TARGET JOB:
Title: ${title}
Company: ${companyName}
Description:
${jobDescription.substring(0, 4800)}

CANDIDATE SOURCE (facts only; do not invent):
${stringifyAtsSourceForTailorPrompt(atsSource)}

RELEVANT MEMORY (use only if consistent with candidate source):
${memoryBlock}

${agentBriefingBlock}

WRITING RULES:
1. FACTS: Never invent employers, titles, dates, degrees, certifications, or metrics. If a metric is not in the source, omit it.
2. LANGUAGE: Write every field in professional English (US). Translate Portuguese source material; do not output Portuguese in the JSON.
3. TONE: Calm, specific, recruiter-ready. No hype, no superlatives (avoid: elite, world-class, cutting-edge, rockstar, ninja, passionate). No marketing slogans.
4. PUNCTUATION: No em dashes in prose. For period fields use ASCII hyphens only (example: Jan 2024 - Dec 2025).
5. ATS: Mirror exact job phrases where truthful. Each bullet: verb + scope + outcome (metrics only if sourced). Every bullet must be a complete English sentence ending with a period. Never end with ".." or "…" or cut off mid-phrase.
6. SELECTION: Use roles from CANDIDATE SOURCE experience (pre-ranked). Do not merge two jobs into one. Do not invent Scrum-only titles if the source title is engineering or transformation lead.
7. DATES AND TITLES: Copy company and period EXACTLY from the matching entry in CANDIDATE SOURCE experience. Copy role title verbatim from source; align the job only via target_headline, summary, and bullets (truthful emphasis).
8. ONE PAGE: Summary 50-70 words; max 3 roles from source; max 4 bullets per role; 14-18 hard_skills.
9. ANCHORS: When tailor_anchors or operational_metrics appear in CANDIDATE SOURCE, weave at least two sourced metrics or project outcomes into summary or bullets (only if relevant to the job).
10. PROJECTS: Prefer selected_projects from the highest-ranked entries in CANDIDATE SOURCE projects; use outcomes verbatim in spirit, one sentence each.

Return ONLY valid JSON:
{
  "personal_info": { "name": "...", "title": "job-aligned headline", "email": "...", "phone": "...", "location": "...", "website": "..." },
  "target_headline": "one line under the name for this application",
  "summary": "...",
  "core_competencies": {
    "leadership_and_delivery": ["..."],
    "technical": ["..."],
    "platforms_and_tools": ["..."]
  },
  "experience": [{ "company": "...", "role": "...", "period": "...", "bullets": ["..."] }],
  "selected_projects": [{ "name": "...", "impact": "one sentence, factual" }],
  "hard_skills": ["..."],
  "education": ["Degree, Institution (year)"],
  "certifications": ["Name, Issuer (year)"],
  "keywords_used": ["8-14 exact job phrases reflected in the CV"],
  "fit_notes": "2-3 sentences in English for the candidate on what was emphasized",
  "admission_chance_percent": 0,
  "chance_rationale": "1-2 sentences in English on realistic ATS + recruiter screen odds (not an offer guarantee)"
}

Set admission_chance_percent honestly (0-100). Heuristic calibration: ${heuristicFit.score}/100.
`;

        const raw = await aiService.getCombinedAICompletion(
            prompt,
            'You write ATS resumes. Output ONLY valid JSON. All string values must be professional English.',
            true
        );
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : raw;
        let aiResult = {};
        try {
            aiResult = JSON.parse(cleanedJson);
        } catch (parseErr) {
            console.error('[ATS TAILOR] JSON parse failed:', parseErr.message);
            return res.status(502).json({ error: 'AI returned invalid JSON for tailored CV.' });
        }

        let tailored = {
            personal_info: {
                ...combinedProfile.personal_info,
                ...(aiResult.personal_info || {}),
                title: aiResult.personal_info?.title || combinedProfile.personal_info.title
            },
            target_headline: aiResult.target_headline || '',
            summary: aiResult.summary || '',
            core_competencies: aiResult.core_competencies || null,
            experience: (Array.isArray(aiResult.experience) ? aiResult.experience : []).slice(0, 3).map(exp => ({
                ...exp,
                bullets: (exp.bullets || []).slice(0, 4)
            })),
            selected_projects: Array.isArray(aiResult.selected_projects) ? aiResult.selected_projects.slice(0, 4) : [],
            hard_skills: (Array.isArray(aiResult.hard_skills) && aiResult.hard_skills.length
                ? aiResult.hard_skills
                : (combinedProfile.hard_skills || []).slice(0, 18)).slice(0, 18),
            education: (Array.isArray(aiResult.education) && aiResult.education.length
                ? aiResult.education
                : combinedProfile.education || []),
            certifications: (Array.isArray(aiResult.certifications) && aiResult.certifications.length
                ? aiResult.certifications
                : combinedProfile.certifications || []),
            keywords_used: Array.isArray(aiResult.keywords_used) ? aiResult.keywords_used : [],
            fit_notes: aiResult.fit_notes || ''
        };
        const jdText = `${title} ${jobDescription}`;
        tailored.experience = alignExperienceWithSource(tailored.experience, combinedProfile.experience);
        tailored.experience = consolidateHabitarmosInExperience(
            tailored.experience,
            combinedProfile.experience,
            combinedProfile.projects,
            jdText,
            3
        );
        tailored.experience = groundExperienceBullets(
            tailored.experience,
            combinedProfile.experience,
            combinedProfile.projects,
            jdText
        );
        tailored = applyAtsSanitization(tailored);
        tailored = stripUnauthorizedClaimsFromCv(tailored, combinedProfile);
        ensureRankedProjectsOnCv(tailored, rankedProjectsForCv, 3);

        const keywordOverlap = Math.min(98, Math.max(5, heuristicFit.score));
        const overlapMeta = keywordOverlapMeta(keywordOverlap);

        const fit_assessment = {
            admission_chance_percent: keywordOverlap,
            match_score: heuristicFit.score,
            keyword_overlap_only: true,
            level: overlapMeta.level,
            label_pt: overlapMeta.label_pt,
            label_en: overlapMeta.label_en,
            overlap_label_en: overlapMeta.overlap_label_en,
            matched_skills: heuristicFit.matched || [],
            skills_gaps: heuristicFit.missing || [],
            work_area: heuristicFit.workArea,
            breakdown: heuristicFit.breakdown,
            chance_rationale: guardEnglishField(aiResult.chance_rationale || aiResult.fit_notes || ''),
            disclaimer_pt: 'Sobreposição de palavras-chave com a descrição da vaga. Não é o score do ATS da empresa nem probabilidade de entrevista.',
            disclaimer_en: 'Keyword overlap with the job description only. Not the employer ATS score and not an interview probability.'
        };

        res.json({
            success: true,
            tailored_cv: tailored,
            fit_assessment,
            context_insights: contextInsights,
            target: { jobTitle: title, company: companyName, jobUrl: resolvedInput.jobUrl || undefined },
            job_resolution: resolvedInput.job_resolution,
            agent_trace: agentBriefing?.agent_trace || [],
            job_context: {
                title,
                company: companyName,
                description: jobDescription,
                jobUrl: resolvedInput.jobUrl || null
            }
        });
    } catch (error) {
        console.error('[ATS TAILOR ERROR]', error.message);
        const msg = error.message || 'Failed to tailor ATS CV.';
        const aiDown =
            /unavailable|quota-limited|rate limit|503|model_not_found|All AI engines/i.test(msg);
        const status = aiDown ? 503 : msg.includes('HTTP 429') ? 429 : 500;
        res.status(status).json({
            error: msg,
            code: aiDown ? 'AI_UNAVAILABLE' : status === 429 ? 'JOB_URL_RATE_LIMIT' : 'TAILOR_FAILED'
        });
    }
});

// 9b. Direct CV / Profile Update
router.post('/api/cv/update', async (req, res) => {
    try {
        const updated = req.body;
        if (!updated) return res.status(400).json({ error: 'No data provided' });

        const cvPath = path.join(__dirname, '..', 'user_cv.json');
        let current = {};
        if (fs.existsSync(cvPath)) {
            try { current = JSON.parse(fs.readFileSync(cvPath, 'utf8')); } catch (e) { }
        }

        const merged = {
            ...current,
            ...updated,
            personal_info: {
                ...(current.personal_info || {}),
                ...(updated.personal_info || {})
            }
        };

        fs.writeFileSync(cvPath, JSON.stringify(merged, null, 2), 'utf8');
        console.log(`[PROFILE] Directly updated profile for: ${merged.personal_info?.name}`);

        // Sync with knowledgeBase
        const kb = knowledgeService.knowledgeBase;
        kb.identity = kb.identity || {};
        if (merged.personal_info) kb.identity.personal_info = merged.personal_info;
        if (merged.summary) kb.identity.summary = merged.summary;
        if (merged.personal_info?.title) kb.identity.industryNiche = merged.personal_info.title;
        if (merged.hard_skills) {
            const skillsArr = Array.isArray(merged.hard_skills) ? merged.hard_skills : Object.values(merged.hard_skills).flat();
            kb.identity.topSkills = skillsArr;
            kb.skills = [...new Set([...(kb.skills || []), ...skillsArr])];
        }
        if (merged.experience) {
            kb.identity.experience = merged.experience.map(e => ({
                role: e.role,
                company: e.company,
                year: e.period,
                description: Array.isArray(e.bullets) ? e.bullets.join('. ') : (e.bullets || '')
            }));
        }
        if (merged.projects) {
            kb.identity.relationalProjects = merged.projects;
        }

        await knowledgeService.saveKB();
        await knowledgeService.seedCvIntoMemory();

        res.json({ success: true, profile: merged, message: 'Perfil atualizado com sucesso!' });
    } catch (e) {
        console.error('[CV UPDATE ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// 10. Memory Graph (Nodes & Edges)
router.get('/api/memory/graph', async (req, res) => {
    try {
        const cvPath = path.join(__dirname, '..', 'user_cv.json');
        let cv = {};
        if (fs.existsSync(cvPath)) {
            try { cv = JSON.parse(fs.readFileSync(cvPath, 'utf8')); } catch (e) { }
        }

        const candidateName = cv.personal_info?.name || 'Candidato Master';
        const candidateTitle = cv.personal_info?.title || 'Engineer';

        const nodes = [
            { id: 'c1', label: `${candidateName} (${candidateTitle})`, type: 'candidate' }
        ];
        const edges = [];

        let skillIdx = 1;
        if (cv.hard_skills && typeof cv.hard_skills === 'object') {
            for (const [cat, skillList] of Object.entries(cv.hard_skills)) {
                const list = Array.isArray(skillList) ? skillList : [String(skillList)];
                for (const sk of list) {
                    const skId = `s_${skillIdx++}`;
                    nodes.push({ id: skId, label: sk, type: 'skill', category: cat });
                    edges.push({ from: 'c1', to: skId, relation: 'DOMINA' });
                }
            }
        }

        let expIdx = 1;
        if (cv.experience && Array.isArray(cv.experience)) {
            for (const exp of cv.experience) {
                const expId = `e_${expIdx++}`;
                nodes.push({ id: expId, label: `${exp.company} (${exp.role})`, type: 'experience' });
                edges.push({ from: 'c1', to: expId, relation: 'TRABALHOU' });
            }
        }

        try {
            const { rows } = await vectorEngine.dbQuery(
                `SELECT content, source FROM candidate_memory WHERE source LIKE 'Winning Pitch%' LIMIT 5`
            );
            let pitchIdx = 1;
            for (const r of rows) {
                const pId = `w_${pitchIdx++}`;
                nodes.push({ id: pId, label: r.source.replace('Winning Pitch:', 'Pitch Vencedor:'), type: 'winning_pitch' });
                edges.push({ from: 'c1', to: pId, relation: 'PITCH_VENCEDOR' });
            }
        } catch (e) {
            console.warn('[GRAPH API] Pitch fetch failed:', e.message);
        }

        res.json({ nodes, edges });
    } catch (error) {
        console.error('[GRAPH API ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 11. LinkedIn Diagnostic Probe
router.get('/api/diagnostic/linkedin', async (req, res) => {
    try {
        console.log('[DIAGNOSTIC] Testing LinkedIn Connectivity...');
        await mcpService.callEngine('search_jobs', { keywords: 'React', location: 'Portugal' });
        res.json({
            success: true,
            status: 'connected',
            message: 'LinkedIn Engine online and accepting requests.'
        });
    } catch (error) {
        console.error('[DIAGNOSTIC ERROR]', error.message);
        res.json({
            success: false,
            status: 'expired',
            message: 'LinkedIn Session Expired or Network Error. Please update LINKEDIN_COOKIE.'
        });
    }
});

module.exports = router;
