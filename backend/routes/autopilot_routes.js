// ============================================================
// 🤖 AUTOPILOT & BACKGROUND SCHEDULING ROUTES
// Autonomous Hunting Daemon, Keyword Rotation & Quota Guard
// ============================================================

const express = require('express');
const router = express.Router();
const path = require('path');
const { spawn } = require('child_process');

const knowledgeService = require('../services/knowledge_service');
const jobService = require('../services/job_service');
const mcpService = require('../services/mcp_service');
const cacheService = require('../services/cache_service');
const vectorEngine = require('../vector_engine');
const { validateBody } = require('../middleware/validation');
const { AutopilotConfigSchema } = require('../contracts/schemas');

let autopilotInterval = null;

async function runMasterAutopilotHunt() {
    const kb = knowledgeService.knowledgeBase;
    const ap = kb.autopilot;
    if (!ap || !ap.enabled) return;

    const today = new Date().toISOString().split('T')[0];
    if (ap.todayDate !== today) {
        ap.todayDate = today;
        ap.todayCount = 0;
        await knowledgeService.saveKB();
    }

    if (ap.todayCount >= (ap.dailyLimit || 3)) {
        console.log('[AUTOPILOT] Daily quota reached. Standing by for next cycle.');
        return;
    }

    const now = Date.now();
    const minIntervalMs = (ap.intervalHours || 6) * 60 * 60 * 1000;
    const lastRunMs = ap.lastRunAt ? new Date(ap.lastRunAt).getTime() : 0;

    if (now - lastRunMs < minIntervalMs) {
        const nextIn = Math.round((minIntervalMs - (now - lastRunMs)) / (60 * 60 * 1000) * 10) / 10;
        console.log(`[AUTOPILOT] Frequency Check: Silent. Next hunt in ~${nextIn}h.`);
        return;
    }

    if (kb.daily_stats?.last_date === today && kb.daily_stats?.count >= 30) {
        console.log('[AUTOPILOT] Global quota (30) reached. Protecting account.');
        return;
    }

    console.log(`\n🚀 [AUTOPILOT] MISSION START: Run ${ap.todayCount + 1}/${ap.dailyLimit}`);

    try {
        const userReqs = knowledgeService.getUserTargetRequirements();
        const pool = ap.huntKeywords && ap.huntKeywords.length > 0
            ? ap.huntKeywords
            : [
                userReqs.title || 'AI Systems & Automation Engineer',
                'AI Automation Engineer',
                'AI Solutions Architect',
                ...(userReqs.skills || []).slice(0, 5)
            ].filter(Boolean);
        const keywords = pool[Math.floor(Math.random() * pool.length)];
        const max_pages = ap.maxPages || 1;

        console.log(`[AUTOPILOT] MISSION TARGET: "${keywords}" (Depth: ${max_pages} pages)`);

        const safetyDelay = Math.floor(Math.random() * 8000) + 4000;
        await new Promise(r => setTimeout(r, safetyDelay));

        const locationPool = ap.huntLocations || ['Remote', 'Portugal', 'Spain', 'United Kingdom', 'Global'];
        const huntLocation = locationPool[Math.floor(Math.random() * locationPool.length)];

        let mcpAvailable = false;
        let jobsList = [];
        try {
            const result = await mcpService.callEngine('search_jobs', {
                keywords,
                location: huntLocation,
                max_pages,
                date_posted: 'past_24_hours'
            });

            let rawResults = result.content ? (result.content[0]?.text || '[]') : result;
            if (typeof rawResults === 'string') {
                try { rawResults = JSON.parse(rawResults); } catch (e) { }
            }
            jobsList = Array.isArray(rawResults) ? rawResults : (rawResults.results || rawResults.job_ids || []);
            if (jobsList && jobsList.length > 0) mcpAvailable = true;
        } catch (mcpErr) {
            console.warn(`[AUTOPILOT MCP] Primary search failed (${mcpErr.message}). Activating public scraper fallback.`);
        }

        if (!jobsList || jobsList.length === 0) {
            console.log(`[AUTOPILOT] Fetching jobs via public LinkedIn scraper for "${keywords}"...`);
            jobsList = await jobService.fetchPublicLinkedInJobs(keywords, huntLocation, 10);
        }

        let newJobsCount = 0;

        if (jobsList.length > 0) {
            const analyzeLimit = Math.min(15, Math.max(5, max_pages * 3));

            for (const job of jobsList.slice(0, analyzeLimit)) {
                const jobId = job.job_id || job.id || job.linkedin_id;

                try {
                    let detailData = null;
                    if (mcpAvailable) {
                        try {
                            const detailResult = await mcpService.callEngine('get_job_details', { job_id: jobId });
                            detailData = detailResult?.content ? (detailResult.content[0]?.text || '{}') : detailResult;
                            if (typeof detailData === 'string') {
                                try { detailData = JSON.parse(detailData); } catch (e) { }
                            }
                        } catch (e) { }
                    }

                    if (!detailData || (!detailData.sections && !detailData.text)) {
                        detailData = await jobService.fetchPublicJobDetails(jobId);
                    }

                    const description = detailData?.sections?.job_posting || detailData?.text || '';

                    let analysis = null;
                    const cachedResult = await cacheService.findSimilar(description);

                    const { title: extractedTitle, company: extractedCompany } = jobService.extractJobMetadata(detailData, job, description);
                    if (cachedResult && cachedResult.score) {
                        analysis = {
                            score: cachedResult.score,
                            matched: cachedResult.matched_skills || [],
                            missing: cachedResult.skills_gaps || [],
                            fromCache: true
                        };
                    } else {
                        analysis = jobService.calculateMatchAnalysis(description, extractedTitle, userReqs);
                    }

                    if (analysis.score >= 40) {

                        await vectorEngine.dbQuery(
                            `INSERT INTO jobs (linkedin_id, title, company, location, description, match_score, status, url, updated_at)
                             VALUES ($1, $2, $3, $4, $5, $6, 'discovered', $7, NOW())
                             ON CONFLICT (linkedin_id) DO UPDATE SET
                               match_score = EXCLUDED.match_score, status = 'discovered', updated_at = NOW()`,
                            [jobId, extractedTitle, extractedCompany, detailData.location || huntLocation, description, analysis.score, `https://www.linkedin.com/jobs/view/${jobId}`]
                        ).catch(() => null);

                        newJobsCount++;
                        console.log(`[AUTOPILOT] ✅ High-DNA Match persisted: "${extractedTitle}" (${analysis.score}%)`);
                    }
                } catch (e) {
                    console.error(`[AUTOPILOT] Detail fetch failed for ${jobId}:`, e.message);
                }
            }
        }

        ap.lastRunAt = new Date().toISOString();
        ap.todayCount++;
        ap.totalJobsFound = (ap.totalJobsFound || 0) + newJobsCount;

        if (!kb.daily_stats) kb.daily_stats = { last_date: today, count: 0 };
        kb.daily_stats.count++;

        await knowledgeService.saveKB();
        console.log(`[AUTOPILOT] MISSION COMPLETE: ${newJobsCount} new high-value nodes synchronized.\n`);
    } catch (e) {
        console.error('[AUTOPILOT ERROR] Mission Failure:', e.message);
    }
}

function startAutopilotDaemon(intervalMinutes = 15) {
    if (autopilotInterval) clearInterval(autopilotInterval);
    autopilotInterval = setInterval(runMasterAutopilotHunt, intervalMinutes * 60 * 1000);
    console.log(`[AUTOPILOT] Master Neural Heartbeat active (${intervalMinutes}min check cycle)`);
}

function stopAutopilotDaemon() {
    if (autopilotInterval) {
        clearInterval(autopilotInterval);
        autopilotInterval = null;
        console.log('[AUTOPILOT] Master Neural Heartbeat stopped');
    }
}

// 1. Get Status
router.get('/api/autopilot/status', (req, res) => {
    const ap = knowledgeService.knowledgeBase.autopilot || {};
    const today = new Date().toISOString().split('T')[0];

    if (ap.todayDate !== today) {
        ap.todayDate = today;
        ap.todayCount = 0;
    }

    let nextRunAt = null;
    if (ap.enabled && ap.lastRunAt) {
        const minInterval = Math.max(3, ap.intervalHours || 6);
        nextRunAt = new Date(new Date(ap.lastRunAt).getTime() + minInterval * 60 * 60 * 1000).toISOString();
    }

    res.json({
        enabled: ap.enabled || false,
        dailyLimit: ap.dailyLimit || 3,
        intervalHours: ap.intervalHours || 6,
        maxPages: ap.maxPages || 1,
        todayCount: ap.todayCount || 0,
        totalJobsFound: ap.totalJobsFound || 0,
        lastRunAt: ap.lastRunAt || null,
        nextRunAt,
        safeMaxLimit: 5
    });
});

// 2. Toggle Autopilot
router.post('/api/autopilot/toggle', async (req, res) => {
    const kb = knowledgeService.knowledgeBase;
    if (!kb.autopilot) {
        kb.autopilot = { enabled: false, dailyLimit: 3, intervalHours: 6, lastRunAt: null, todayCount: 0, todayDate: new Date().toISOString().split('T')[0], totalJobsFound: 0 };
    }
    kb.autopilot.enabled = !kb.autopilot.enabled;
    await knowledgeService.saveKB();

    const state = kb.autopilot.enabled;
    console.log(`[AUTOPILOT] ${state ? '🟢 ACTIVATED' : '🔴 DEACTIVATED'} by user.`);
    res.json({ enabled: state, message: state ? 'Neural Autopilot engaged.' : 'Neural Autopilot offline.' });
});

// 3. Update Autopilot Config
router.post('/api/autopilot/config', validateBody(AutopilotConfigSchema), async (req, res) => {
    const { dailyLimit, intervalHours, maxPages } = req.validatedBody || req.body;
    const kb = knowledgeService.knowledgeBase;
    if (!kb.autopilot) kb.autopilot = {};

    if (dailyLimit !== undefined) {
        kb.autopilot.dailyLimit = Math.min(5, Math.max(1, parseInt(dailyLimit)));
    }
    if (intervalHours !== undefined) {
        kb.autopilot.intervalHours = Math.max(3, parseInt(intervalHours));
    }
    if (maxPages !== undefined) {
        kb.autopilot.maxPages = Math.min(10, Math.max(1, parseInt(maxPages)));
    }
    await knowledgeService.saveKB();

    console.log(`[AUTOPILOT] Config updated: ${kb.autopilot.dailyLimit}/day, every ${kb.autopilot.intervalHours}h, depth ${kb.autopilot.maxPages}p`);
    res.json({ success: true, config: kb.autopilot });
});

// 4. Trigger Deep Identity Mapping Sequence
router.post('/api/neural/deep-map', async (req, res) => {
    console.log('[API] Triggering Neural Deep Mapping sequence...');
    try {
        const mapper = spawn('node', [path.join(__dirname, '..', 'deep_identity_mapper.js')]);
        mapper.stdout.on('data', (data) => console.log(`[MAPPER] ${data}`));
        mapper.stderr.on('data', (data) => console.error(`[MAPPER ERROR] ${data}`));
        res.json({ success: true, message: 'Deep Identity Mapping started in background.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = {
    router,
    startAutopilotDaemon,
    stopAutopilotDaemon,
    runMasterAutopilotHunt
};
