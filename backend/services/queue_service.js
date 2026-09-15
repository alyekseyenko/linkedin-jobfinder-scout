// ============================================================
// ⚡ TRANSACTIONAL PERSISTENT QUEUE SERVICE
// Zero data-loss background worker queue with Idempotency,
// Exponential Backoff, Jitter & Quota Quarantine (Senior/Staff 2026)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vectorEngine = require('../vector_engine');
const loggerService = require('./logger_service');

const OFFLINE_QUEUE_PATH = path.join(__dirname, '..', 'vault', 'job_queue_fallback.json');

class QueueService {
    constructor() {
        this.fallbackQueue = [];
        this.initialized = false;
        this.loadOfflineFallback();
    }

    loadOfflineFallback() {
        try {
            if (fs.existsSync(OFFLINE_QUEUE_PATH)) {
                const data = fs.readFileSync(OFFLINE_QUEUE_PATH, 'utf8');
                this.fallbackQueue = JSON.parse(data);
            }
        } catch (e) {
            this.fallbackQueue = [];
        }
    }

    saveOfflineFallback() {
        try {
            const dir = path.dirname(OFFLINE_QUEUE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(OFFLINE_QUEUE_PATH, JSON.stringify(this.fallbackQueue, null, 2));
        } catch (e) {
            loggerService.error('queue', 'Failed to save offline queue fallback: ' + e.message);
        }
    }

    async init() {
        if (this.initialized) return;
        try {
            await vectorEngine.dbQuery(`
                CREATE TABLE IF NOT EXISTS job_queue (
                    id VARCHAR(64) PRIMARY KEY,
                    type VARCHAR(64) NOT NULL,
                    payload JSONB NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'pending',
                    idempotency_key VARCHAR(128) UNIQUE,
                    attempts INT NOT NULL DEFAULT 0,
                    max_attempts INT NOT NULL DEFAULT 3,
                    next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    error_message TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_job_queue_status_next_run 
                ON job_queue (status, next_run_at);
            `);
            this.initialized = true;
            loggerService.info('queue', 'Persistent transactional PostgreSQL queue initialized ✅');
        } catch (err) {
            loggerService.warn('queue', 'PostgreSQL queue unavailable, active in resilient file-backed mode: ' + err.message);
            this.initialized = true;
        }
    }

    /**
     * Enqueue a new background task with idempotency protection.
     */
    async enqueue(type, payload, options = {}) {
        await this.init();
        const id = crypto.randomUUID();
        const idempotencyKey = options.idempotencyKey || null;
        const maxAttempts = options.maxAttempts || 3;
        const delayMs = options.delayMs || 0;
        const nextRunAt = new Date(Date.now() + delayMs);

        // 1. Try PostgreSQL transactional insert
        try {
            const query = `
                INSERT INTO job_queue (id, type, payload, status, idempotency_key, attempts, max_attempts, next_run_at)
                VALUES ($1, $2, $3, 'pending', $4, 0, $5, $6)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING *
            `;
            const { rows } = await vectorEngine.dbQuery(query, [
                id,
                type,
                JSON.stringify(payload),
                idempotencyKey,
                maxAttempts,
                nextRunAt.toISOString()
            ]);

            if (rows && rows.length > 0) {
                loggerService.info('queue', `Job [${type}:${id}] enqueued (idempotency: ${idempotencyKey || 'none'})`);
                return { success: true, job: rows[0], isDuplicate: false };
            } else {
                loggerService.info('queue', `Idempotent duplicate avoided for key: ${idempotencyKey}`);
                return { success: true, isDuplicate: true, message: 'Duplicate job skipped via idempotency key.' };
            }
        } catch (dbErr) {
            // 2. Resilient Fallback to offline store
            if (idempotencyKey && this.fallbackQueue.some(j => j.idempotency_key === idempotencyKey && j.status !== 'completed')) {
                return { success: true, isDuplicate: true, message: 'Duplicate job skipped via offline idempotency.' };
            }

            const fallbackJob = {
                id,
                type,
                payload,
                status: 'pending',
                idempotency_key: idempotencyKey,
                attempts: 0,
                max_attempts: maxAttempts,
                next_run_at: nextRunAt.toISOString(),
                error_message: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            this.fallbackQueue.push(fallbackJob);
            this.saveOfflineFallback();
            loggerService.info('queue', `Job [${type}:${id}] enqueued in offline fallback store`);
            return { success: true, job: fallbackJob, isDuplicate: false };
        }
    }

    /**
     * Atomically pop the next available job ready for processing.
     */
    async getNextJob(type = null) {
        await this.init();
        const now = new Date().toISOString();

        try {
            let query = `
                UPDATE job_queue
                SET status = 'active', attempts = attempts + 1, updated_at = NOW()
                WHERE id = (
                    SELECT id FROM job_queue
                    WHERE status = 'pending'
                      AND next_run_at <= NOW()
                      ${type ? 'AND type = $1' : ''}
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING *
            `;
            const params = type ? [type] : [];
            const { rows } = await vectorEngine.dbQuery(query, params);

            if (rows && rows.length > 0) {
                return rows[0];
            }
        } catch (dbErr) {
            // Offline fallback dequeue
            const idx = this.fallbackQueue.findIndex(j => 
                j.status === 'pending' && 
                new Date(j.next_run_at) <= new Date() &&
                (!type || j.type === type)
            );

            if (idx !== -1) {
                const job = this.fallbackQueue[idx];
                job.status = 'active';
                job.attempts += 1;
                job.updated_at = new Date().toISOString();
                this.saveOfflineFallback();
                return job;
            }
        }

        return null;
    }

    /**
     * Mark job successfully completed.
     */
    async completeJob(id, result = {}) {
        await this.init();
        try {
            await vectorEngine.dbQuery(
                `UPDATE job_queue SET status = 'completed', updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } catch (dbErr) {
            const job = this.fallbackQueue.find(j => j.id === id);
            if (job) {
                job.status = 'completed';
                job.updated_at = new Date().toISOString();
                this.saveOfflineFallback();
            }
        }
        loggerService.info('queue', `Job [${id}] marked as COMPLETED`);
    }

    /**
     * Mark job as failed, with Exponential Backoff + Jitter retry or Quarantine.
     */
    async failJob(id, error, isRateLimit = false) {
        await this.init();
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown queue worker error');

        let attempts = 1;
        let maxAttempts = 3;

        try {
            const { rows } = await vectorEngine.dbQuery(`SELECT attempts, max_attempts FROM job_queue WHERE id = $1`, [id]);
            if (rows && rows.length > 0) {
                attempts = rows[0].attempts;
                maxAttempts = rows[0].max_attempts;
            }
        } catch (e) {
            const job = this.fallbackQueue.find(j => j.id === id);
            if (job) {
                attempts = job.attempts;
                maxAttempts = job.max_attempts;
            }
        }

        // Exponential backoff with jitter: 2^attempts * 2000ms + random(500-1500ms)
        const jitter = Math.floor(Math.random() * 1000) + 500;
        const baseDelay = Math.pow(2, attempts) * 2000;
        const totalDelayMs = isRateLimit ? Math.max(baseDelay, 120000) + jitter : baseDelay + jitter; // Min 2 mins on 429
        const nextRunAt = new Date(Date.now() + totalDelayMs);

        const newStatus = isRateLimit 
            ? 'quarantined' 
            : (attempts >= maxAttempts ? 'failed' : 'pending');

        try {
            await vectorEngine.dbQuery(
                `UPDATE job_queue 
                 SET status = $1, error_message = $2, next_run_at = $3, updated_at = NOW()
                 WHERE id = $4`,
                [newStatus, errorMessage, nextRunAt.toISOString(), id]
            );
        } catch (dbErr) {
            const job = this.fallbackQueue.find(j => j.id === id);
            if (job) {
                job.status = newStatus;
                job.error_message = errorMessage;
                job.next_run_at = nextRunAt.toISOString();
                job.updated_at = new Date().toISOString();
                this.saveOfflineFallback();
            }
        }

        loggerService.warn('queue', `Job [${id}] ${newStatus} (Attempts: ${attempts}/${maxAttempts}). Next retry in: ${Math.round(totalDelayMs / 1000)}s`);
        return { status: newStatus, nextRetryInMs: totalDelayMs };
    }

    /**
     * Retrieve status summary across all jobs.
     */
    async getQueueStatus() {
        await this.init();
        try {
            const { rows } = await vectorEngine.dbQuery(`
                SELECT status, count(*) as count 
                FROM job_queue 
                GROUP BY status
            `);
            const statusMap = { pending: 0, active: 0, completed: 0, failed: 0, quarantined: 0 };
            rows.forEach(r => { statusMap[r.status] = parseInt(r.count, 10); });
            return statusMap;
        } catch (dbErr) {
            const statusMap = { pending: 0, active: 0, completed: 0, failed: 0, quarantined: 0 };
            this.fallbackQueue.forEach(j => {
                if (statusMap[j.status] !== undefined) statusMap[j.status]++;
            });
            return statusMap;
        }
    }
}

const queueService = new QueueService();
module.exports = queueService;
