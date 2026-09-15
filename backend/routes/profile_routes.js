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
const aiService = require('../services/ai_service');
const vectorEngine = require('../vector_engine');
const mcpService = require('../services/mcp_service');
const vaultService = require('../services/vault_service');
const loggerService = require('../services/logger_service');
const telemetryService = require('../services/telemetry_service');
const { validateBody } = require('../middleware/validation');
const { PortfolioAnalyzeSchema, CookieConfigSchema } = require('../contracts/schemas');

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
            education: masterProfile.education || [],
            languages: masterProfile.languages || [],
            soft_skills: masterProfile.soft_skills || neuralIdentity.softSkills || [],
            tech_philosophy: neuralIdentity.techPhilosophy || masterProfile.techPhilosophy || "",
            projects: neuralIdentity.relationalProjects || masterProfile.projects || masterProfile.relationalProjects || []
        };

        res.json({ success: true, profile: combinedProfile });
    } catch (error) {
        console.error('[CV API ERROR]', error.message);
        res.status(500).json({ error: 'Failed to retrieve neural CV.' });
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
