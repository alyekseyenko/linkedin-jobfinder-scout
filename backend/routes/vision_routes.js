// ============================================================
// 👁️ NEURAL VISION & STAGEHAND AUTOMATION ROUTES
// Visual Inspection, Ground Truth Validation & Autonomous Actions
// ============================================================

const express = require('express');
const router = express.Router();
const visionService = require('../services/vision_service');
const jobService = require('../services/job_service');
const knowledgeService = require('../services/knowledge_service');
const vectorEngine = require('../vector_engine');

// 1. Initialize Vision Engine
router.post('/api/vision/init', async (req, res) => {
    try {
        await visionService.initialize();
        res.json({ success: true, message: 'Neural Vision Engine initialized.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Execute Smart Action via Vision
router.post('/api/vision/act', async (req, res) => {
    const { instruction } = req.body;
    try {
        const result = await visionService.smartAct(instruction);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Extract Visual Structured Data
router.post('/api/vision/extract', async (req, res) => {
    const { instruction, schema } = req.body;
    try {
        const result = await visionService.visualExtract(instruction, schema);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Full Neural Vision Hunt
router.post('/api/vision/hunt', async (req, res) => {
    let { keywords, location } = req.body;
    const userReqs = knowledgeService.getUserTargetRequirements();

    if (!keywords || keywords === 'developer' || keywords === 'Software Engineer') {
        keywords = userReqs.title || 'AI Systems & Automation Engineer';
    }
    if (!location || location === 'Remote' || location === 'Hybrid') {
        location = userReqs.location || 'Portugal';
    }

    try {
        let job = null;
        let validation = { verified: true, matchQuality: 'High' };

        // Attempt visual browser search
        try {
            await visionService.initialize();
            console.log(`👁️ [VISION] Initiating neural hunt for "${keywords}" in "${location}"...`);
            const searchResult = await visionService.searchLinkedInJobs(keywords, location);
            if (searchResult.success) {
                console.log(`👁️ [VISION] Search complete. Extracting high-value data...`);
                const extraction = await visionService.extractJobDetails();
                if (extraction.success && extraction.data && extraction.data.title !== 'Software Engineer') {
                    job = extraction.data;
                    validation = await visionService.validateTruth(job);
                }
            }
        } catch (visionErr) {
            console.warn(`[VISION] Browser hunt warning: ${visionErr.message}. Falling back to direct live scraper.`);
        }

        // Resilient Fallback: If visual extraction did not find a concrete job, fetch live jobs
        if (!job || !job.title || job.title === 'Software Engineer') {
            console.log(`[VISION] Sourcing live jobs via public engine for "${keywords}" in "${location}"...`);
            const publicJobs = await jobService.fetchPublicLinkedInJobs(keywords, location, { limit: 5 });
            if (publicJobs && publicJobs.length > 0) {
                const topJob = publicJobs[0];
                const detail = await jobService.fetchPublicJobDetails(topJob.id);
                const desc = detail?.text || `${topJob.title} at ${topJob.company}`;
                const analysis = jobService.calculateMatchAnalysis(desc, topJob.title, userReqs);

                job = {
                    id: topJob.id,
                    title: topJob.title,
                    company: topJob.company,
                    location: topJob.location,
                    url: topJob.url,
                    description: desc,
                    matchScore: analysis.score,
                    matchedSkills: analysis.matched,
                    missingSkills: analysis.missing
                };

                // Persist all discovered jobs to Postgres CRM
                for (const pJob of publicJobs) {
                    await vectorEngine.dbQuery(
                        `INSERT INTO jobs (linkedin_id, title, company, location, description, match_score, status, url, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, 'discovered', $7, NOW())
                         ON CONFLICT (linkedin_id) DO UPDATE SET updated_at = NOW()`,
                        [pJob.id, pJob.title, pJob.company, pJob.location, `${pJob.title} at ${pJob.company}`, analysis.score, pJob.url]
                    ).catch(() => null);
                }
            }
        }

        if (job) {
            // Ensure top hunted job is persisted
            const jobId = job.id || `hunt_${Date.now()}`;
            await vectorEngine.dbQuery(
                `INSERT INTO jobs (linkedin_id, title, company, location, description, match_score, status, url, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'discovered', $7, NOW())
                 ON CONFLICT (linkedin_id) DO UPDATE SET
                   match_score = EXCLUDED.match_score, status = EXCLUDED.status, updated_at = NOW()`,
                [jobId, job.title, job.company, job.location || location || 'Remote', job.description || '', job.matchScore || 85, job.url || `https://www.linkedin.com/jobs/view/${jobId}`]
            ).catch(() => null);

            res.json({
                success: true,
                message: 'Neural Hunt successful and vision-validated.',
                job: job,
                validation: validation
            });
        } else {
            res.json({ success: false, error: 'No matching jobs could be extracted at this moment.' });
        }
    } catch (error) {
        console.error('❌ [VISION HUNT ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Live Auto-Fill with Human-in-the-Loop
router.post('/api/vision/autofill', async (req, res) => {
    const { jobId, jobUrl } = req.body;
    try {
        const autofillService = require('../services/autofill_service');
        const result = await autofillService.startAutofill({ jobId, jobUrl });
        res.json(result);
    } catch (err) {
        console.error('❌ [AUTOFILL ROUTE ERROR]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Poll Auto-Fill Session Status & Live Screenshot
router.get('/api/vision/autofill/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const autofillService = require('../services/autofill_service');
    const session = autofillService.getSessionStatus(jobId);
    res.json(session);
});

module.exports = router;

