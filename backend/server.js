// ============================================================
// 🧠 NEURAL LINKEDIN BOT — ENTERPRISE ORCHESTRATOR
// Staff Principal Modular Router Entrypoint (<115 lines)
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Enterprise Domain Services
const mcpService = require('./services/mcp_service');
const knowledgeService = require('./services/knowledge_service');
const loggerService = require('./services/logger_service');
const vaultService = require('./services/vault_service');
const vectorEngine = require('./vector_engine');

// Middlewares
const { correlationMiddleware } = require('./middleware/correlation');
const { notFoundHandler, errorHandler } = require('./middleware/error_handler');

// Modular Routers
const systemRoutes = require('./routes/system_routes');
const aiBridgeRoutes = require('./routes/ai_bridge_routes');
const profileRoutes = require('./routes/profile_routes');
const jobRoutes = require('./routes/job_routes');
const { router: autopilotRoutes, startAutopilotDaemon, stopAutopilotDaemon } = require('./routes/autopilot_routes');
const visionRoutes = require('./routes/vision_routes');
const docsRoutes = require('./routes/docs_routes');
const marketRoutes = require('./routes/market_routes');

const app = express();

// Global Middlewares
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(correlationMiddleware);

// Rate Limiting Gate
const { apiLimiter, aiLimiter } = require('./middleware/rate_limiter');
app.use('/api/', apiLimiter);
app.use('/api/ai/analyze', aiLimiter);
app.use('/api/crew/analyze', aiLimiter);

// Automatic Session Vault Migration
try {
    const existingLiAt = process.env.LI_AT;
    if (existingLiAt && !vaultService.getSecret('li_at')) {
        vaultService.storeSecret('li_at', existingLiAt);
        vaultService.storeSecret('linkedin_cookie', `li_at=${existingLiAt}`);
        loggerService.info('vault', 'Auto-migrated legacy environment cookie to AES-256-GCM Vault');
    }
} catch (e) {
    loggerService.warn('vault', 'Vault startup verification: ' + e.message);
}

// Demo Sandbox Interceptor (Mount before live routes)
if (process.env.DEMO_MODE === 'true') {
    app.use('/api', require('./routes/demo_routes'));
}

// Mount Routers
app.use(docsRoutes);
app.use(systemRoutes);
app.use(aiBridgeRoutes);
app.use(profileRoutes);
app.use(jobRoutes);
app.use(autopilotRoutes);
app.use(visionRoutes);
app.use('/api/market', marketRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Server Lifecycle Management
let server = null;
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// [DEPRECATED] setInterval daemon replaced by isolated BullMQ Worker (workers/analysis_worker.js)
// Queue processing is now handled by a dedicated BullMQ Worker with proper concurrency,
// rate limiting, and dead-letter handling — not a polling interval.

async function bootstrap() {
    // 1. Initialize BullMQ Isolated Analysis Worker
    try {
        const { initAnalysisWorker } = require('./workers/analysis_worker');
        initAnalysisWorker();
    } catch (e) {
        loggerService.warn('worker', `Worker init: ${e.message}`);
    }

    mcpService.startLinkedInMCP();
    await knowledgeService.bootstrapKnowledgeBase();
    await knowledgeService.seedCvIntoMemory();
    startAutopilotDaemon(15);

    return new Promise((resolve) => {
        server = app.listen(PORT, HOST, () => {
            loggerService.info('server', `🧠 Neural Engine online at http://${HOST}:${PORT}`);
            console.log(`\n🧠 Neural Engine online at http://${HOST}:${PORT}`);
            console.log(`🤖 Autopilot: ${knowledgeService.knowledgeBase.autopilot?.enabled ? '🟢 ACTIVE' : '🔴 STANDBY'}`);
            resolve(server);
        });
    });
}

function shutdown(signal) {
    console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully closing services...`);
    stopAutopilotDaemon();
    mcpService.stopLinkedInMCP();
    if (server) {
        server.close(() => {
            console.log('[SHUTDOWN] HTTP server closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
    bootstrap().catch((err) => {
        console.error('[FATAL STARTUP ERROR]', err);
        process.exit(1);
    });
}

module.exports = {
    app,
    bootstrap,
    shutdown,
    synthesizeExpertIdentity: (text) => require('./services/ai_service').synthesizeExpertIdentity(text, knowledgeService.knowledgeBase, knowledgeService.saveKB),
    addInformation: vectorEngine.addInformation,
    initVectorEngine: vectorEngine.initVectorEngine
};
