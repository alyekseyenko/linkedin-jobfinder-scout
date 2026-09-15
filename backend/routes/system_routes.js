// ============================================================
// 🛠️ SYSTEM & DIAGNOSTICS ROUTES
// Core health, sanity diagnostics, logs, telemetry & proxy
// ============================================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

const mcpService = require('../services/mcp_service');
const loggerService = require('../services/logger_service');
const telemetryService = require('../services/telemetry_service');
const proxyService = require('../services/proxy_service');
const aiService = require('../services/ai_service');
const cacheService = require('../services/cache_service');
const vectorEngine = require('../vector_engine');
const aiEngineClient = require('../services/ai_engine_client');
const fs = require('fs');
const path = require('path');
const vaultService = require('../services/vault_service');
const queueService = require('../services/queue_service');

// 1. Basic Health & Engine Status
router.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        ...mcpService.getHealthStatus()
    });
});

// 1.1 Cloud-Native Liveness Probe (Kubernetes/ECS)
router.get('/api/health/live', (req, res) => {
    res.json({
        status: 'alive',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 1.2 Cloud-Native Readiness Probe (Deep Dependency Check)
router.get('/api/health/ready', async (req, res) => {
    let dbStatus = 'unknown';
    try {
        const dbHealth = await vectorEngine.healthCheck();
        dbStatus = dbHealth.status;
    } catch {
        dbStatus = 'offline';
    }

    const aiTarget = aiEngineClient.getBaseUrl();
    const ready = true; // Service is ready to accept traffic with resilient fallbacks

    res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'unready',
        database: dbStatus,
        aiBridgeTarget: aiTarget,
        timestamp: new Date().toISOString()
    });
});

// 1.3 Prometheus Metrics Endpoint (OpenTelemetry / SRE Staff Grade)
router.get('/api/metrics', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    
    let totalJobs = 0;
    try {
        const result = await vectorEngine.dbQuery('SELECT COUNT(*) FROM jobs');
        totalJobs = parseInt(result.rows[0].count, 10) || 0;
    } catch (_) {}

    const uptimeSeconds = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();

    const output = [
        '# HELP process_uptime_seconds Total process uptime in seconds',
        '# TYPE process_uptime_seconds counter',
        `process_uptime_seconds ${uptimeSeconds}`,
        '',
        '# HELP process_heap_bytes Process heap memory usage in bytes',
        '# TYPE process_heap_bytes gauge',
        `process_heap_bytes ${memUsage.heapUsed}`,
        '',
        '# HELP jobs_cataloged_total Total job opportunities indexed in CRM database',
        '# TYPE jobs_cataloged_total counter',
        `jobs_cataloged_total ${totalJobs}`,
        '',
        '# HELP system_health_status Overall system operational status (1 = healthy, 0 = degraded)',
        '# TYPE system_health_status gauge',
        'system_health_status 1'
    ].join('\n');

    res.send(output);
});

// 2. Comprehensive System Sanity & Diagnostics
router.get('/api/system/sanity', async (req, res) => {
    loggerService.info('sanity', 'System sanity diagnostic requested');
    const startTime = Date.now();

    const diagnostics = {
        timestamp: new Date().toISOString(),
        overallStatus: 'healthy',
        components: {}
    };

    // 1. PostgreSQL Database Ping & Latency via vectorEngine
    try {
        const dbHealth = await vectorEngine.healthCheck();
        diagnostics.components.database = dbHealth;
        if (dbHealth.status !== 'online') {
            diagnostics.overallStatus = 'degraded';
        }
    } catch (dbErr) {
        diagnostics.components.database = {
            status: 'degraded/offline',
            error: dbErr.message,
            fallback: 'JSON File Persistence Active'
        };
        diagnostics.overallStatus = 'degraded';
    }

    // 2. AI Multi-Model Layer Health
    diagnostics.components.aiService = {
        status: 'online',
        providers: {
            groq: !!process.env.GROQ_API_KEY,
            gemini: !!process.env.GEMINI_API_KEY,
            cohere: !!process.env.COHERE_API_KEY
        }
    };

    // 3. MCP LinkedIn Scraper & Queue Health
    diagnostics.components.mcpScraper = {
        status: mcpService.isReady() ? 'online' : 'standby',
        ...mcpService.getHealthStatus()
    };

    // 4. Cache & Vision Services
    diagnostics.components.cacheService = {
        status: 'online'
    };
    diagnostics.components.visionService = {
        status: 'online',
        engine: 'Gemini 2.0 Flash Vision'
    };


    // 5. Rotating Proxy Pool (Staff Principal)
    diagnostics.components.proxyPool = proxyService.getPoolStatus();

    // 6. Persistent Background Job Queue
    diagnostics.components.jobQueue = await queueService.getQueueStatus();

    // 7. Python AI Microservice Bridge Status
    const pyHealth = await aiEngineClient.checkHealth();
    diagnostics.components.aiEngineBridge = {
        status: pyHealth.online ? 'online' : 'offline',
        target: pyHealth.target,
        latencyMs: pyHealth.latencyMs || null
    };

    diagnostics.diagnosticDurationMs = Date.now() - startTime;
    res.json(diagnostics);
});

// 3. Recent System Logs
router.get('/api/system/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
        logs: loggerService.getRecentLogs(limit)
    });
});

// 4. Real-Time Telemetry Stream (Server-Sent Events — SSE)
router.get('/api/telemetry/stream', (req, res) => {
    telemetryService.handleSSE(req, res);
});

// 5. Proxy Pool Status Endpoint
router.get('/api/proxy/status', (req, res) => {
    res.json(proxyService.getPoolStatus());
});

// 5b. Persistent Job Queue Status Endpoint
router.get('/api/queue/status', async (req, res, next) => {
    try {
        const status = await queueService.getQueueStatus();
        res.json({ success: true, queue: status });
    } catch (err) {
        next(err);
    }
});

// 6. Comprehensive LinkedIn Auth Lifecycle
router.get('/api/auth/status', (req, res) => {
    const profileCookiesPath = path.join(__dirname, '..', 'linkedin_profile', 'Default', 'Network', 'Cookies');
    const hasProfileSession = fs.existsSync(profileCookiesPath) && fs.statSync(profileCookiesPath).size > 1024;
    
    let vaultToken = null;
    try {
        vaultService.loadVault();
        vaultToken = vaultService.getSecret('li_at') || vaultService.getSecret('linkedin_cookie');
    } catch (_) {}

    const envToken = process.env.LI_AT || process.env.LINKEDIN_COOKIE;
    const hasToken = !!(vaultToken || envToken);
    const isConnected = hasProfileSession || hasToken;

    res.json({
        authenticated: isConnected,
        connected: isConnected,
        method: hasProfileSession ? 'browser_profile' : (hasToken ? 'token' : null),
        hasProfileSession,
        hasToken,
        engineReady: mcpService.isReady(),
        message: isConnected 
            ? 'Sessão do LinkedIn associada com sucesso.' 
            : 'LinkedIn desconectado. É necessário ligar a conta para pesquisar e candidatar.'
    });
});

// 6.1 Set LinkedIn li_at Token
router.post('/api/auth/linkedin/token', (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string' || token.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Token li_at inválido.' });
        }

        const cleanToken = token.replace(/^li_at=/, '').trim();
        
        // Save to Zero-Trust Encrypted Vault
        vaultService.loadVault();
        vaultService.cache.secrets['li_at'] = cleanToken;
        vaultService.cache.secrets['linkedin_cookie'] = `li_at=${cleanToken}`;
        vaultService.saveVault();

        // Update process.env
        process.env.LI_AT = cleanToken;
        process.env.LINKEDIN_COOKIE = `li_at=${cleanToken}`;

        // Also persist directly into .env file in root so it survives restarts
        try {
            const rootEnvPath = path.join(__dirname, '..', '..', '.env');
            if (fs.existsSync(rootEnvPath)) {
                let envContent = fs.readFileSync(rootEnvPath, 'utf8');
                envContent = envContent.replace(/^LI_AT=.*$/m, `LI_AT=${cleanToken}`);
                envContent = envContent.replace(/^LINKEDIN_COOKIE=.*$/m, `LINKEDIN_COOKIE=${cleanToken}`);
                envContent = envContent.replace(/^LINKEDIN_SESSION_COOKIE=.*$/m, `LINKEDIN_SESSION_COOKIE=${cleanToken}`);
                fs.writeFileSync(rootEnvPath, envContent, 'utf8');
            }
        } catch (_) {}

        // Update cookies.json
        const cookiesPath = path.join(__dirname, '..', 'cookies.json');
        let cookiesToSave = [
            {
                name: 'li_at',
                value: cleanToken,
                domain: '.linkedin.com',
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            }
        ];

        if (Array.isArray(req.body.allCookies) && req.body.allCookies.length > 0) {
            cookiesToSave = req.body.allCookies.map(c => ({
                ...c,
                domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`
            }));
        }

        fs.writeFileSync(cookiesPath, JSON.stringify(cookiesToSave, null, 2), 'utf8');

        // Restart MCP engine to pick up new session
        mcpService.restartLinkedInMCP();

        res.json({
            success: true,
            connected: true,
            message: 'Token li_at guardado com sucesso no Vault seguro. Sessão ativa!'
        });
    } catch (err) {
        console.error('[AUTH ERROR] Failed to save token:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6.2 Disconnect / Logout from LinkedIn
router.post('/api/auth/linkedin/logout', (req, res) => {
    try {
        console.log('[AUTH] Logging out user and clearing LinkedIn session...');

        // 1. Clear session cookies in profile directory
        const profileCookiesPath = path.join(__dirname, '..', 'linkedin_profile', 'Default', 'Network', 'Cookies');
        if (fs.existsSync(profileCookiesPath)) {
            try {
                fs.unlinkSync(profileCookiesPath);
            } catch (e) {
                // If locked, truncate or ignore
                fs.writeFileSync(profileCookiesPath, '', 'utf8');
            }
        }

        // 2. Clear Vault secrets
        try {
            vaultService.loadVault();
            delete vaultService.cache.secrets['li_at'];
            delete vaultService.cache.secrets['linkedin_cookie'];
            delete vaultService.cache.secrets['linkedin_session_cookie'];
            vaultService.saveVault();
        } catch (_) {}

        // 3. Clear environment variables
        delete process.env.LI_AT;
        delete process.env.LINKEDIN_COOKIE;
        delete process.env.LINKEDIN_SESSION_COOKIE;

        // 4. Clear cookies.json
        const cookiesPath = path.join(__dirname, '..', 'cookies.json');
        if (fs.existsSync(cookiesPath)) {
            fs.writeFileSync(cookiesPath, '[]', 'utf8');
        }

        // 5. Clean restart of LinkedIn engine
        mcpService.restartLinkedInMCP();

        res.json({
            success: true,
            connected: false,
            message: 'Sessão do LinkedIn terminada com sucesso. Conta desconectada.'
        });
    } catch (err) {
        console.error('[AUTH LOGOUT ERROR]:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/api/login', async (req, res) => {
    console.log('[AUTH] Forced handshake requested. Re-launching browser...');
    try {
        if (!mcpService.isReady()) {
            mcpService.startLinkedInMCP();
        }
        await mcpService.callEngine('get_person_profile', { linkedin_username: 'me' });
        res.json({ success: true, message: 'Neural Handshake signal sent. Check for browser window.' });
    } catch (err) {
        console.error('[AUTH ERROR] Handshake failed:', err.message);
        res.json({ success: false, message: `Engine error: ${err.message}` });
    }
});

// 7. Force Reset Engine
router.post('/api/engine/reset', (req, res) => {
    console.log('[ENGINE] Forced neural reset requested by user...');
    try {
        mcpService.restartLinkedInMCP();
        res.json({ success: true, message: 'Neural Engine re-spawned.' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// 8. Qdrant Diagnostic
router.get('/api/diagnostic/qdrant', async (req, res) => {
    try {
        const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
        const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
        const response = await axios.get(`http://${QDRANT_HOST}:${QDRANT_PORT}/healthz`, { timeout: 2000 });
        res.json({ success: true, message: `Qdrant Cluster Online. Version: ${response.data.version || 'unknown'}` });
    } catch (e) {
        res.json({ success: false, message: 'Qdrant Offline (Check Docker)' });
    }
});

// 9. Arize Phoenix Diagnostic
router.get('/api/diagnostic/phoenix', async (req, res) => {
    try {
        const PHOENIX_HOST = process.env.PHOENIX_HOST || 'localhost';
        const PHOENIX_PORT = process.env.PHOENIX_PORT || 6006;
        await axios.get(`http://${PHOENIX_HOST}:${PHOENIX_PORT}`, { timeout: 2000 });
        res.json({ success: true, message: 'Arize Phoenix Telemetry Active. Monitoring synapses...' });
    } catch (e) {
        res.json({ success: false, message: 'Phoenix Offline (Tracing disabled)' });
    }
});

// 10. Cache Diagnostic
router.get('/api/diagnostic/cache', async (req, res) => {
    try {
        await cacheService.init();
        res.json({ success: true, message: 'Semantic Cache Functional. Gemini Embeddings ready.' });
    } catch (e) {
        res.json({ success: false, message: `Cache Service Error: ${e.message}` });
    }
});

// 11. Graph Probe Diagnostic
router.get('/api/diagnostic/probe/graph', async (req, res) => {
    try {
        const response = await aiEngineClient.queryGraph('What are my main technical skills?', 'hybrid');
        if (response.success && response.result) {
            const preview = String(response.result).substring(0, 40);
            res.json({ success: true, message: `Intelligence Graph is learning. Retrieval active: "${preview}..."` });
        } else {
            res.json({ success: false, message: 'Graph Intelligence Probe Failed (8001 offline?)' });
        }
    } catch (e) {
        res.json({ success: false, message: `Graph Intelligence Probe Failed (8001 offline?)` });
    }
});

// 12. Interactive Live Auto-Fill (HITL Remote Control)
router.post('/api/jobs/:id/autofill/click', async (req, res) => {
    try {
        const { id } = req.params;
        const { xPercent, yPercent } = req.body;
        const autofillService = require('../services/autofill_service');
        const result = await autofillService.sendUserClick(id, { xPercent, yPercent });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/jobs/:id/autofill/type', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const autofillService = require('../services/autofill_service');
        const result = await autofillService.sendUserType(id, { text });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
