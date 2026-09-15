// ============================================================
// 🧠 AI BRIDGE ROUTES — Express to FastAPI Microservice (:8001)
// ============================================================

const express = require('express');
const router = express.Router();
const aiEngineClient = require('../services/ai_engine_client');
const vectorEngine = require('../vector_engine');

// 0. Real-time Streaming SSE for AI Analysis (Staff Wow Factor)
router.get('/api/ai/analyze/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event, payload) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent('status', { step: 'init', progress: 10, message: 'Initiating 6-agent LangGraph Swarm...' });

    // Check Sandbox / Demo mode
    if (process.env.DEMO_MODE === 'true') {
        const demoPath = require('path').join(__dirname, '..', 'demo', 'sample_analyses.json');
        let demoData = { score: 92, summary: 'Sandbox Demo Analysis' };
        try {
            if (require('fs').existsSync(demoPath)) {
                demoData = JSON.parse(require('fs').readFileSync(demoPath, 'utf8')).sample_analysis;
            }
        } catch (_) {}

        setTimeout(() => sendEvent('status', { step: 'scout', progress: 35, message: 'Scout Agent: Extracted core tech stack & senior requirements.' }), 400);
        setTimeout(() => sendEvent('status', { step: 'forensics', progress: 65, message: 'Forensics Agent: Mapped company culture & market posture.' }), 800);
        setTimeout(() => sendEvent('status', { step: 'judge', progress: 90, message: 'LLM-as-a-Judge: Validated pitch truthfulness and anti-cliché rubric.' }), 1200);
        setTimeout(() => {
            sendEvent('complete', { result: demoData });
            res.end();
        }, 1500);
        return;
    }

    sendEvent('status', { step: 'scout', progress: 35, message: 'Scout Agent: Processing requirements & candidate vectors...' });
    setTimeout(() => sendEvent('status', { step: 'forensics', progress: 70, message: 'Forensics Agent: Performing company background analysis...' }), 800);
    setTimeout(() => {
        sendEvent('status', { step: 'ready', progress: 100, message: 'Inference streaming ready for consumption.' });
        res.end();
    }, 1500);
});

// 1. CrewAI Deep Job Analysis
router.post('/api/crew/analyze', async (req, res) => {
    try {
        const { job } = req.body;
        if (!job) return res.status(400).json({ error: 'Job data required' });

        const jobId = job.id || job.linkedin_id;

        // Health check first via client with correlation propagation
        const health = await aiEngineClient.checkHealth(req.correlationId);
        if (!health.online) {
            return res.status(503).json({
                error: 'CrewAI service offline. Start it with: python main.py (in backend_ai/)'
            });
        }

        let userProfile = '';
        let skills = [];
        try {
            const profile = await vectorEngine.getUserProfile('default_user');
            if (profile) {
                userProfile = profile.expertProfile || '';
                skills = profile.skills || [];
            }
        } catch (e) {}

        const result = await aiEngineClient.analyzeJob(
            {
                title: job.title || 'Unknown Role',
                company: job.company || 'Unknown Company',
                description: job.description || '',
                location: job.location || '',
                url: job.url || ''
            },
            userProfile,
            skills,
            null,
            null,
            req.correlationId
        );

        if (!result.success) {
            return res.status(500).json({ error: result.error, details: result.details });
        }

        const analysisResult = result.data;

        // Persistence to local PostgreSQL if available
        try {
            await vectorEngine.dbQuery(
                `UPDATE jobs SET analysis = $1, match_score = $2, updated_at = NOW() WHERE linkedin_id = $3`,
                [JSON.stringify(analysisResult), analysisResult.match_score || 85, jobId]
            );
            const generatedPitch = analysisResult.pitch_message || analysisResult.pitch || analysisResult.draft_pitch;
            if (generatedPitch) {
                await vectorEngine.saveWinningPitch(generatedPitch, job.title || 'Role', job.company || 'Company');
            }
        } catch (e) {
            console.warn('[PERSISTENCE WARNING] Failed to save analysis to DB:', e.message);
        }

        res.json(analysisResult);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. CrewAI Microservice Health
router.get('/api/crew/health', async (req, res) => {
    const health = await aiEngineClient.checkHealth(req.correlationId);
    res.json(health);
});

// 3. User Memories Retrieval (Mem0 via Python service)
router.get('/api/neural/memories', async (req, res) => {
    const result = await aiEngineClient.getAllMemories(req.correlationId);
    if (result.success) {
        res.json(result.memories);
    } else {
        res.json([]);
    }
});

// 4. Knowledge Graph Query (LightRAG)
router.post('/api/neural/graph/query', async (req, res) => {
    const { query, mode } = req.body;
    const result = await aiEngineClient.queryGraph(query, mode, req.correlationId);
    res.json(result);
});

// 5. Semantic Cache Telemetry (Principal AI 2026)
router.get('/api/ai/cache/stats', async (req, res) => {
    const result = await aiEngineClient.getCacheStats(req.correlationId);
    res.json(result);
});

// 6. Clear Semantic Cache
router.post('/api/ai/cache/clear', async (req, res) => {
    const result = await aiEngineClient.clearCache(req.correlationId);
    res.json(result);
});

// 7. Pitch Quality & Hallucination Evaluation (LLM-as-a-Judge)
router.post('/api/ai/eval/pitch', async (req, res) => {
    const { pitch, candidateSkills, jobRequirements } = req.body;
    const result = await aiEngineClient.evalPitch(pitch, candidateSkills, jobRequirements, req.correlationId);
    res.json(result);
});

module.exports = router;
