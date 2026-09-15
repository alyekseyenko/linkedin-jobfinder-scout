// ============================================================
// 💼 JOBS & CRM ROUTES
// Job Search, Deep Matching, Import, Tailored CV & Pipeline Management
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const vectorEngine = require('../vector_engine');
const knowledgeService = require('../services/knowledge_service');
const jobService = require('../services/job_service');
const mcpService = require('../services/mcp_service');
const cacheService = require('../services/cache_service');
const aiEngineClient = require('../services/ai_engine_client');
const aiService = require('../services/ai_service');
const { validateBody } = require('../middleware/validation');
const { JobImportSchema } = require('../contracts/schemas');

// 1. Import Job (from URL or Raw Text)
router.post('/api/jobs/import', validateBody(JobImportSchema), async (req, res) => {
    try {
        const { url, title, company, description, location } = req.validatedBody || req.body;

        let finalTitle = title || 'Imported Role';
        let finalCompany = company || 'Target Company';
        let finalDescription = description || '';
        let finalLocation = location || 'Remote';
        let finalUrl = url || '';

        if (url && (!finalDescription || finalDescription.length < 50)) {
            console.log(`[IMPORT] Scraping live job URL: ${url}`);
            try {
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const $ = cheerio.load(response.data);
                $('script, style, nav, footer, iframe, noscript').remove();

                const pageTitle = $('title').text() || $('h1').first().text();
                const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

                if (bodyText && bodyText.length > 100) {
                    finalDescription = bodyText.substring(0, 10000);
                    if (pageTitle && finalTitle === 'Imported Role') {
                        finalTitle = pageTitle.split('|')[0].split('-')[0].trim();
                    }
                    console.log(`[IMPORT SUCCESS] Scraped ${finalDescription.length} chars from ${url}`);
                }
            } catch (scrapeErr) {
                console.error(`[IMPORT SCRAPE WARNING] Failed to scrape ${url}:`, scrapeErr.message);
            }
        }

        if (!finalDescription) {
            return res.status(400).json({ error: 'Please provide a valid job URL or job description text.' });
        }

        const jobId = `imported-${Date.now()}`;
        const importedJob = {
            id: jobId,
            linkedin_id: jobId,
            title: finalTitle,
            company: finalCompany,
            location: finalLocation,
            description: finalDescription,
            url: finalUrl,
            source: 'custom_import',
            created_at: new Date().toISOString()
        };

        try {
            await vectorEngine.dbQuery(
                `INSERT INTO jobs (linkedin_id, title, company, location, description, url, source)
                 VALUES ($1, $2, $3, $4, $5, $6, 'custom_import')
                 ON CONFLICT (linkedin_id) DO UPDATE SET
                   title = EXCLUDED.title, company = EXCLUDED.company,
                   location = EXCLUDED.location, description = EXCLUDED.description,
                   url = EXCLUDED.url, updated_at = NOW()`,
                [jobId, finalTitle, finalCompany, finalLocation, finalDescription, finalUrl]
            );
        } catch (dbErr) {
            console.warn('[IMPORT DB WARNING]', dbErr.message);
        }

        try {
            await vectorEngine.addMarketMemory(
                `Job Vacancy: ${finalTitle} at ${finalCompany}.\nLocation: ${finalLocation}.\nDescription: ${finalDescription.substring(0, 3000)}`,
                `Imported Job: ${finalUrl || finalTitle}`
            );
            aiEngineClient.ingestGraph(`Job Opportunity: ${finalTitle} at ${finalCompany}.\n${finalDescription.substring(0, 3000)}`).catch(() => null);
            console.log(`[MARKET MEM] ✅ Job ingested into market_memory: ${finalTitle} @ ${finalCompany}`);
        } catch (learnErr) {
            console.warn('[MARKET MEM WARNING]', learnErr.message);
        }

        res.json({ success: true, job: importedJob });
    } catch (error) {
        console.error('[IMPORT ERROR]', error.message);
        res.status(500).json({ error: 'Failed to import job: ' + error.message });
    }
});

// 2. On-Demand Deep Analysis (Asynchronous Queued - Staff Milestone 1)
router.post('/api/jobs/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[AI] Deep analysis queued for job ${id}`);

        const result = await mcpService.callEngine('get_job_details', { job_id: id });
        let data = result.content ? result.content[0].text : result;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }

        let description = data.sections?.job_posting || data.sections?.main || data.sections?.body || data.text || data.description || '';

        if (!description) {
            try {
                const { rows } = await vectorEngine.dbQuery('SELECT description, title, company FROM jobs WHERE linkedin_id = $1', [id]);
                if (rows && rows[0]?.description) {
                    description = rows[0].description;
                    if (!data.title) data.title = rows[0].title;
                    if (!data.company) data.company = rows[0].company;
                }
            } catch (dbErr) { }
        }

        const { title: extractedTitle, company: extractedCompany } = jobService.extractJobMetadata(data, {}, description);
        const finalCompany = extractedCompany || 'your organization';

        // Check semantic cache
        const cachedAnalysis = await cacheService.findSimilar(description);
        if (cachedAnalysis) {
            console.log(`[AI] Returning semantic cache result for ${id}.`);
            return res.json(cachedAnalysis);
        }

        const kb = knowledgeService.knowledgeBase;

        // Queue transactional task instead of blocking the request
        await queueService.enqueue('deep_analysis', {
            jobId: id,
            description,
            extractedTitle,
            finalCompany,
            kb
        }, {
            idempotencyKey: `analyze-${id}`
        });

        res.status(202).json({
            success: true,
            status: 'queued',
            message: 'Deep job analysis successfully queued into fault-tolerant background engine.',
            jobId: id
        });
    } catch (error) {
        console.error(`[AI ERROR] Analysis queuing for ${req.params.id} failed:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. Official Company Profile Proxy
router.get('/api/companies/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`[MCP] Fetching OFFICIAL company profile for: ${username}`);
        const result = await mcpService.callEngine('get_company_profile', { company_id: username });

        let data = result.content ? result.content[0].text : result;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }
        res.json(data);
    } catch (error) {
        console.error(`[MCP ERROR] Company Profile for ${req.params.username} failed:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Search Jobs with Deep Scoring
router.get('/api/jobs', async (req, res) => {
    try {
        const userReqs = knowledgeService.getUserTargetRequirements();
        let {
            keywords,
            location,
            experience_level = '',
            job_type = '',
            remote = '',
            work_mode = '',
            date_posted = 'past_week'
        } = req.query;

        // Auto-align with candidate requirements if empty or generic default
        if (!keywords || keywords === 'Creative Technologist' || keywords === 'Software Engineer') {
            keywords = userReqs.title || 'AI Systems & Automation Engineer';
        }
        if (!location || location === 'Remote' || location === 'Hybrid' || location === 'On-site') {
            location = userReqs.location || 'Portugal';
        }

        const effectiveWorkMode = work_mode || req.query.workMode || (remote === 'true' ? 'remote' : 'any');
        const maxDaysParam = parseInt(req.query.max_days?.toString() || '30');
        const resultsLimit = parseInt(req.query.results_limit?.toString() || req.query.limit?.toString() || '10');

        console.log(`[JOBS] Requirement search: "${keywords}" in "${location}" (mode: ${effectiveWorkMode}, exp: ${experience_level})`);

        const searchArgs = {
            keywords: keywords.toString(),
            location: location.toString(),
            max_pages: parseInt(req.query.max_pages?.toString() || '1')
        };
        if (experience_level) searchArgs.experience_level = experience_level.toString();

        const kb = knowledgeService.knowledgeBase;
        const today = new Date().toISOString().split('T')[0];
        if (!kb.daily_stats) kb.daily_stats = { last_date: today, count: 0 };
        if (kb.daily_stats.last_date !== today) {
            kb.daily_stats.last_date = today;
            kb.daily_stats.count = 0;
        }

        if (kb.daily_stats.count >= 100) {
            console.log(`[QUOTA] Daily limit reached (${kb.daily_stats.count}/100). Returning cached jobs.`);
            try {
                const { rows } = await vectorEngine.dbQuery(
                    `SELECT * FROM jobs WHERE match_score >= 70 ORDER BY updated_at DESC LIMIT $1`,
                    [resultsLimit || 10]
                );
                return res.json(rows || []);
            } catch (e) {
                return res.json([]);
            }
        }

        // Anti-bot human delay
        const safetyDelay = Math.floor(Math.random() * 1500) + 500;
        await new Promise(resolve => setTimeout(resolve, safetyDelay));

        let mcpAvailable = false;
        let jobsListRaw = [];
        try {
            const result = await mcpService.callEngine('search_jobs', searchArgs);
            if (result) {
                let data = result.content ? (result.content[0]?.text || '{}') : result;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (e) { }
                }
                jobsListRaw = data.results || data.job_ids || (Array.isArray(data) ? data : []);
                if (jobsListRaw && jobsListRaw.length > 0) {
                    mcpAvailable = true;
                }
            }
        } catch (mcpErr) {
            console.warn(`[JOBS MCP] Primary search warning: ${mcpErr.message}. Activating resilient Guest Scraper fallback.`);
        }

        // Resilient Fallback: If MCP returned empty or failed, fetch via public LinkedIn guest endpoint
        if (!jobsListRaw || jobsListRaw.length === 0) {
            console.log(`[JOBS] Fetching live LinkedIn jobs via Guest Scraper for "${keywords}" in "${location}"...`);
            jobsListRaw = await jobService.fetchPublicLinkedInJobs(keywords.toString(), location.toString(), {
                limit: resultsLimit,
                workMode: effectiveWorkMode,
                experienceLevel: experience_level.toString(),
                datePosted: date_posted.toString()
            });
        }

        kb.daily_stats.count++;
        await knowledgeService.saveKB();

        let knownJobIds = new Set();
        try {
            const { rows: existingJobs } = await vectorEngine.dbQuery(
                `SELECT linkedin_id FROM jobs WHERE status IN ('interested', 'applied', 'offer', 'rejected', 'archived')`
            );
            if (existingJobs && existingJobs.length > 0) {
                knownJobIds = new Set(existingJobs.map(j => j.linkedin_id));
            }
        } catch (e) { }

        const jobsList = jobsListRaw.filter(j => {
            const id = typeof j === 'string' ? j : (j.job_id || j.id);
            return !knownJobIds.has(id);
        });

        const formattedJobs = [];
        const seenScrapedIds = new Set();
        const seenFingerprints = new Set();
        const maxResults = Math.min(Math.max(resultsLimit, 1), 50);

        let i = 0;
        while (formattedJobs.length < maxResults && i < jobsList.length) {
            const job = jobsList[i];
            const jobId = typeof job === 'string' ? job : (job.job_id || job.id);
            i++;

            if (!jobId || seenScrapedIds.has(jobId.toString())) {
                continue;
            }

            try {
                let detailData = null;
                if (mcpAvailable) {
                    try {
                        const detailResult = await mcpService.callEngine('get_job_details', { job_id: jobId });
                        if (detailResult) {
                            detailData = detailResult.content ? (detailResult.content[0]?.text || '{}') : detailResult;
                            if (typeof detailData === 'string') {
                                try { detailData = JSON.parse(detailData); } catch (e) { }
                            }
                        }
                    } catch (e) { }
                }

                // Fast Fallback to public job details
                if (!detailData || (!detailData.sections && !detailData.text)) {
                    detailData = await jobService.fetchPublicJobDetails(jobId);
                }

                const description = detailData?.sections?.job_posting || detailData?.sections?.main || detailData?.sections?.body || detailData?.text || '';
                const { title: extractedTitle, company: extractedCompany } = jobService.extractJobMetadata(detailData || {}, job, description);
                const finalTitle = extractedTitle !== 'Specialized Role' && extractedTitle !== 'LinkedIn Job' ? extractedTitle : (job.title || userReqs.title || 'Software Role');
                const finalCompany = extractedCompany !== 'LinkedIn Partner' ? extractedCompany : (job.company || 'LinkedIn Opportunity');

                // Deduplicate by Title + Company fingerprint (avoids duplicate postings for same role)
                const normTitle = finalTitle.toLowerCase().replace(/\(m\/f\/d\)/g, '').replace(/[^a-z0-9]/g, '');
                const normCompany = finalCompany.toLowerCase().replace(/[^a-z0-9]/g, '');
                const fingerprint = `${normTitle}___${normCompany}`;

                if (fingerprint.length > 5 && seenFingerprints.has(fingerprint)) {
                    console.log(`[JOBS DEDUP] Skipping duplicate role: "${finalTitle}" @ "${finalCompany}"`);
                    continue;
                }

                seenScrapedIds.add(jobId.toString());
                if (fingerprint.length > 5) seenFingerprints.add(fingerprint);

                // Realistic multi-factor match against candidate CV requirements
                const analysis = jobService.calculateMatchAnalysis(description, finalTitle, userReqs);

                let aiReport = '';
                if (formattedJobs.length === 0 && aiService.getGroqClient()) {
                    aiReport = await jobService.performDeepAnalysis(description, kb);
                }

                const jobData = {
                    id: jobId,
                    linkedin_id: jobId,
                    title: finalTitle,
                    company: finalCompany,
                    location: detailData?.location || job.location || location,
                    matchScore: analysis.score,
                    match_score: analysis.score,
                    matchedSkills: analysis.matched,
                    missingSkills: analysis.missing,
                    matchBreakdown: analysis.breakdown,
                    aiReport: aiReport,
                    url: job.url || `https://www.linkedin.com/jobs/view/${jobId}`,
                    description: description || `${finalTitle} at ${finalCompany}`
                };
                formattedJobs.push(jobData);

                // Persist to Postgres
                const jobStatus = analysis.score >= 40 ? 'discovered' : 'ignored';
                await vectorEngine.dbQuery(
                    `INSERT INTO jobs (linkedin_id, title, company, location, description, match_score, status, url, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                     ON CONFLICT (linkedin_id) DO UPDATE SET
                       match_score = EXCLUDED.match_score, status = EXCLUDED.status, updated_at = NOW()`,
                    [jobId, finalTitle, finalCompany, jobData.location, description, analysis.score, jobStatus, jobData.url]
                ).catch(() => null);
            } catch (e) {
                console.error(`[JOBS] Detail fetch failed for ${jobId}:`, e.message);
            }
        }

        // Sort by matchScore descending: BEST MATCHES WITH CANDIDATE CV FIRST
        formattedJobs.sort((a, b) => (b.matchScore || b.match_score || 0) - (a.matchScore || a.match_score || 0));

        console.log(`[JOBS] Returning ${formattedJobs.length} clean, deduplicated jobs ranked by CV match.`);
        res.json(formattedJobs);
    } catch (error) {
        console.error('[JOBS ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. Get Single Job Details
router.get('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let data = null;
        try {
            const result = await mcpService.callEngine('get_job_details', { job_id: id });
            data = result.content ? result.content[0].text : result;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { }
            }
        } catch (e) { }

        if (!data || (!data.sections && !data.text)) {
            data = await jobService.fetchPublicJobDetails(id);
        }

        res.json(data || { error: 'Job details not available' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5a. Get Deep Intelligence Pack Status (Staff Milestone 3)
router.get('/api/jobs/:id/analyze/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await vectorEngine.dbQuery('SELECT deep_intelligence_pack FROM jobs WHERE linkedin_id = $1', [id]);
        if (rows && rows[0]?.deep_intelligence_pack) {
            const pack = JSON.parse(rows[0].deep_intelligence_pack);
            return res.json({ status: 'completed', result: pack });
        }
        res.json({ status: 'queued_or_processing' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Tailor/Adapt CV for Specific Job
router.post('/api/jobs/:id/adapt-cv', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[ADAPTER] Generating Tailored CV for Job ${id}`);

        let jobDescription = '';
        let jobTitle = 'Specialized Role';
        let companyName = 'Target Company';

        try {
            const { rows } = await vectorEngine.dbQuery(
                `SELECT description, title, company FROM jobs WHERE linkedin_id = $1`,
                [id]
            );
            if (rows && rows.length > 0) {
                jobDescription = rows[0].description || '';
                jobTitle = rows[0].title || jobTitle;
                companyName = rows[0].company || companyName;
            }
        } catch (e) { }

        if (!jobDescription) {
            try {
                const detailResult = await mcpService.callEngine('get_job_details', { job_id: id });
                let detailData = detailResult?.content ? (detailResult.content[0]?.text || '{}') : detailResult;
                if (typeof detailData === 'string') {
                    try { detailData = JSON.parse(detailData); } catch (e) { }
                }
                jobDescription = detailData?.sections?.job_posting || detailData?.text || '';
                jobTitle = detailData?.title || jobTitle;
                companyName = detailData?.company || companyName;
            } catch (e) { }
        }

        const cvPath = path.join(__dirname, '..', 'user_cv.json');
        const examplePath = path.join(__dirname, '..', 'user_cv.json.example');
        const activePath = fs.existsSync(cvPath) ? cvPath : (fs.existsSync(examplePath) ? examplePath : null);

        let masterProfile = {};
        if (activePath && fs.existsSync(activePath)) {
            masterProfile = JSON.parse(fs.readFileSync(activePath, 'utf8'));
        }

        const kb = knowledgeService.knowledgeBase;
        const prompt = `
You are an ELITE Resume & Technical Identity Architect (2026).
Your objective is to REWRITE and TAILOR the candidate's existing Master CV to maximize ATS compatibility (100% ATS score) and recruiter impact for the target job vacancy.

TARGET JOB VACANCY:
Title: ${jobTitle}
Company: ${companyName}
Description:
${jobDescription.substring(0, 5000)}

CANDIDATE MASTER CV (FACTUAL TRUTH):
${JSON.stringify({ summary: masterProfile.summary, experience: masterProfile.experience, hard_skills: masterProfile.hard_skills, personal_info: masterProfile.personal_info, education: masterProfile.education, certifications: masterProfile.certifications })}

CRITICAL RESUME & SKILL ENHANCEMENT RULES (ResumeSkills Framework):
1. ATS IMPACT & ACTION VERBS: Begin EVERY experience bullet with a high-impact action verb (e.g. Engineered, Architected, Spearheaded, Accelerated, Scaled, Deployed, Optimized).
2. QUANTIFIABLE RESULTS: Preserve or emphasize exact ROI, time savings, latency drops, and financial metrics from the master profile.
3. SKILL EMBEDDING: Seamlessly weave the target job's required technologies and keywords into the summary, bullet points, and hard_skills list so that every section displays deep technical competence.
4. ABSOLUTE FACTUAL INTEGRITY: Do NOT invent fake roles or fake companies. Maintain exact company names, roles, and dates.
5. NO DASHES/HYPHENS IN NARRATIVE: Do NOT use hyphens or em-dashes ('—', '–', '-') inside summary or bullets. Use commas, semicolons or period breaks.
6. OUTPUT FORMAT: Return ONLY a pure JSON object matching this exact schema:
{
  "summary": "High-impact 3-sentence summary tailored to ${jobTitle} at ${companyName} loaded with relevant skills and ROI...",
  "experience": [
    { 
      "company": "...", 
      "role": "...", 
      "period": "...", 
      "bullets": [
        "Action verb + technical accomplishment + metric solving a specific requirement of ${jobTitle}..."
      ] 
    }
  ],
  "hard_skills": ["Skill1", "Skill2", "Skill3"]
}
`;

        const adaptedCVText = await aiService.getCombinedAICompletion(prompt, 'You are an elite career strategist. RESPOND WITH ONLY PURE JSON.', true);
        const jsonMatch = adaptedCVText.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : adaptedCVText;
        let aiResult = {};
        try {
            aiResult = JSON.parse(cleanedJson);
        } catch (e) {
            aiResult = { summary: masterProfile.summary, experience: masterProfile.experience, hard_skills: [] };
        }

        const adaptedCV = {
            ...masterProfile,
            summary: aiResult.summary || masterProfile.summary,
            experience: aiResult.experience || masterProfile.experience,
            hard_skills: aiResult.hard_skills || []
        };

        res.json({ success: true, tailored_cv: adaptedCV });
    } catch (error) {
        console.error('[ADAPTER ERROR]', error.message);
        res.status(500).json({ error: 'Failed to generate tailored CV.' });
    }
});

// 7. Autofill Candidate Simulation
router.post('/api/jobs/:id/autofill', async (req, res) => {
    try {
        const { id } = req.params;
        const cvPath = path.join(__dirname, '..', 'user_cv.json');
        let cv = {};
        if (fs.existsSync(cvPath)) {
            try { cv = JSON.parse(fs.readFileSync(cvPath, 'utf8')); } catch (e) { }
        }

        const candidate = {
            name: cv.personal_info?.name || 'Candidate Name',
            email: cv.personal_info?.email || 'candidate@example.com',
            phone: cv.personal_info?.phone || '+123456789',
            title: cv.personal_info?.title || 'Software Engineer',
            summary: cv.summary || 'Experienced software professional'
        };

        res.json({
            success: true,
            message: `Form autofill prepared for ${candidate.name}!`,
            candidate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. CRM: Get all jobs
router.get('/api/crm/jobs', async (req, res) => {
    try {
        const { rows } = await vectorEngine.dbQuery('SELECT * FROM jobs ORDER BY updated_at DESC');
        res.json(rows || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. CRM: Update Job Status & Closed-Loop Flywheel Recording
router.patch('/api/crm/jobs/:linkedinId', async (req, res) => {
    const { linkedinId } = req.params;
    const { status, title, company, url, description, match_score, outcome } = req.body;

    try {
        const { rows } = await vectorEngine.dbQuery(
            `INSERT INTO jobs (linkedin_id, status, title, company, url, description, match_score, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (linkedin_id) DO UPDATE SET
               status = COALESCE($2, jobs.status),
               title = COALESCE($3, jobs.title),
               company = COALESCE($4, jobs.company),
               match_score = COALESCE($7, jobs.match_score),
               updated_at = NOW()
             RETURNING *`,
            [linkedinId, status || 'discovered', title || 'Specialized Role', company || 'Partner', url || '', description || '', match_score || 0]
        );

        // Flywheel feedback: If status indicates positive engagement, reinforce in memory
        const effectiveOutcome = outcome || status;
        if (effectiveOutcome && ['interview', 'replied', 'offer'].includes(effectiveOutcome.toLowerCase())) {
            const score = effectiveOutcome.toLowerCase() === 'offer' ? 1.0 : (effectiveOutcome.toLowerCase() === 'interview' ? 0.9 : 0.7);
            await vectorEngine.recordPitchOutcome(linkedinId, effectiveOutcome, score);
            console.log(`[NEURAL FLYWHEEL] 🎯 Recorded positive outcome '${effectiveOutcome}' (score: ${score}) for job ${linkedinId}`);
        } else if (effectiveOutcome && ['archived', 'rejected', 'dismissed'].includes(effectiveOutcome.toLowerCase())) {
            // Closed-loop negative feedback: AI learns candidate dislikes/dealbreakers
            try {
                const targetJob = rows[0] || {};
                const rejectionFact = `O utilizador rejeitou/arquivou a vaga "${targetJob.title || title || 'Cargo'}" na empresa "${targetJob.company || company || 'Empresa'}". Ajustar e penalizar oportunidades similares futuras.`;
                await aiEngineClient.addMemory(rejectionFact, {
                    event: 'rejection',
                    job_id: linkedinId,
                    title: targetJob.title || title,
                    company: targetJob.company || company
                });
                console.log(`[CLOSED-LOOP FLYWHEEL] 🛑 Registered rejection signal in AI Memory for job ${linkedinId} (${targetJob.title || title})`);
            } catch (memErr) {
                console.warn('[CLOSED-LOOP NOTICE] Failed to persist rejection memory:', memErr.message);
            }
        }


        res.json(rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9.1 CRM: Record Explicit Application Outcome (Closed-Loop Flywheel)
router.post('/api/crm/jobs/:linkedinId/outcome', async (req, res) => {
    const { linkedinId } = req.params;
    const { outcome, score = 1.0, notes } = req.body;

    try {
        const result = await vectorEngine.recordPitchOutcome(linkedinId, outcome, score);
        res.json({ success: true, result, notes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. CRM: Delete Job
router.delete('/api/crm/jobs/:linkedinId', async (req, res) => {
    const { linkedinId } = req.params;
    try {
        await vectorEngine.dbQuery('DELETE FROM jobs WHERE linkedin_id = $1', [linkedinId]);
        res.json({ success: true, message: 'Job node purged successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. CRM Health
router.get('/api/crm/health', async (req, res) => {
    try {
        const { rows } = await vectorEngine.dbQuery('SELECT count(*) FROM jobs');
        res.json({ ok: true, count: rows[0]?.count || 0, message: 'PostgreSQL jobs table accessible' });
    } catch (e) {
        res.json({ ok: false, reason: e.message });
    }
});

module.exports = router;
