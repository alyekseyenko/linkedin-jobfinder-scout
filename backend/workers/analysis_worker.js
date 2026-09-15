// ============================================================
// ⚡ ISOLATED BULLMQ ANALYSIS WORKER (Staff L6/L7 Architecture)
// Dedicated Worker Thread for Asynchronous AI Job Intelligence
// ============================================================

const { Worker } = require('bullmq');
const aiEngineClient = require('../services/ai_engine_client');
const jobService = require('../services/job_service');
const aiService = require('../services/ai_service');
const cacheService = require('../services/cache_service');
const vectorEngine = require('../vector_engine');
const loggerService = require('../services/logger_service');

const redisConnection = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null
};

let analysisWorker = null;

function initAnalysisWorker() {
    try {
        analysisWorker = new Worker('deep_analysis_queue', async (job) => {
            const { jobId, description, extractedTitle, finalCompany, kb } = job.data;
            loggerService.info('worker', `Starting isolated BullMQ analysis for Job: ${jobId}`);

            let analysisResult = null;
            try {
                const engineResp = await aiEngineClient.analyzeJob(
                    {
                        title: extractedTitle,
                        company: finalCompany,
                        description: description,
                        location: '',
                        url: `https://www.linkedin.com/jobs/view/${jobId}`
                    },
                    kb?.expertProfile || '',
                    kb?.skills || []
                );
                analysisResult = (engineResp && engineResp.data) ? engineResp.data : (engineResp || { score: 75, summary: 'Local Engine Analysis' });
            } catch (aiErr) {
                loggerService.warn('worker', `AI Engine call fallback for ${jobId}: ${aiErr.message}`);
                analysisResult = { score: 75, summary: 'Local Engine Analysis' };
            }

            // Cache & Enriched reports
            await cacheService.store(jobId, description, analysisResult);

            try {
                const attackStrategy = await aiService.generateAttackStrategy(description, kb?.identity);
                if (attackStrategy) analysisResult.attack_strategy = attackStrategy;
            } catch (_) {}

            try {
                const localReport = await jobService.performDeepAnalysis(description, kb, analysisResult);
                analysisResult.intelligence_report = localReport;
            } catch (_) {}

            // Persist to Database
            await vectorEngine.dbQuery(
                `UPDATE jobs SET deep_intelligence_pack = $1, updated_at = NOW() WHERE linkedin_id = $2`,
                [JSON.stringify(analysisResult), jobId]
            );

            loggerService.info('worker', `✅ BullMQ analysis completed for Job: ${jobId}`);
            return { jobId, status: 'completed' };
        }, {
            connection: redisConnection,
            concurrency: 2,
            limiter: {
                max: 10,
                duration: 60000
            }
        });

        analysisWorker.on('completed', (job) => {
            loggerService.info('worker', `Job ${job.id} completed successfully`);
        });

        analysisWorker.on('failed', (job, err) => {
            loggerService.error('worker', `Job ${job ? job.id : 'unknown'} failed: ${err.message}`);
        });

        loggerService.info('worker', 'Isolated BullMQ Analysis Worker initiated successfully');
    } catch (err) {
        loggerService.warn('worker', `BullMQ worker initialization fallback: ${err.message}`);
    }

    return analysisWorker;
}

module.exports = { initAnalysisWorker };
