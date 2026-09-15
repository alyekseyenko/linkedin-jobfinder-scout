// ============================================================
// 🎮 DEMO MODE INTERCEPTOR ROUTER (Staff L6/L7 Sandbox)
// Serves pre-computed high-fidelity intelligence for instant onboarding
// without requiring LinkedIn cookies or paid LLM API keys.
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DEMO_DATA_FILE = path.join(__dirname, '..', 'demo', 'sample_analyses.json');

function getDemoJobs() {
    try {
        if (fs.existsSync(DEMO_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DEMO_DATA_FILE, 'utf8'));
        }
    } catch (_) {}
    return [];
}

// 1. Intercept CRM Jobs Query
router.get('/crm/jobs', (req, res) => {
    const jobs = getDemoJobs();
    res.json(jobs);
});

// 2. Intercept Instant Analysis
router.post('/jobs/:id/analyze', (req, res) => {
    const { id } = req.params;
    const jobs = getDemoJobs();
    const found = jobs.find(j => j.id === id) || jobs[0];
    res.json({
        success: true,
        status: 'completed',
        data: found.analysis,
        cached: true,
        source: 'demo_sandbox'
    });
});

// 3. Status Poll in Demo Mode
router.get('/jobs/:id/analyze/status', (req, res) => {
    const { id } = req.params;
    const jobs = getDemoJobs();
    const found = jobs.find(j => j.id === id) || jobs[0];
    res.json({
        status: 'completed',
        result: found.analysis
    });
});

// 4. Intercept Health in Demo Mode
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        demo: true,
        message: 'Running in High-Fidelity Sandbox Demo Mode'
    });
});

// 5. Intercept Auth Status
router.get('/auth/status', (req, res) => {
    res.json({
        authenticated: true,
        connected: true,
        method: 'demo_sandbox',
        demo: true,
        engineReady: true,
        message: 'Sandbox Demo Mode Active (Simulated LinkedIn Connection)'
    });
});

module.exports = router;
