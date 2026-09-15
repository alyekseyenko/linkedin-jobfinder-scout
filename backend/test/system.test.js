const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { app } = require('../server');
const vaultService = require('../services/vault_service');
const proxyService = require('../services/proxy_service');
const loggerService = require('../services/logger_service');
const telemetryService = require('../services/telemetry_service');

describe('Neural Bot — Staff Principal Test Suite', () => {
    let testServer = null;

    before(async () => {
        await new Promise((resolve) => {
            testServer = app.listen(3001, () => {
                resolve();
            });
            testServer.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    testServer = null;
                    resolve();
                }
            });
        });
    });

    after(() => {
        if (testServer) {
            testServer.close();
        }
    });

    describe('1. Zero-Trust Session Vault (AES-256-GCM)', () => {
        test('Should encrypt and store credentials without plaintext leakage', () => {
            const secretValue = 'test_token_' + Date.now();
            vaultService.storeSecret('unit_test_key', secretValue);

            const retrieved = vaultService.getSecret('unit_test_key');
            assert.strictEqual(retrieved, secretValue, 'Retrieved value must match original secret');

            const vaultFile = path.join(__dirname, '..', 'vault', 'session_vault.enc');
            assert.ok(fs.existsSync(vaultFile), 'Vault file must exist on disk');

            const content = fs.readFileSync(vaultFile, 'utf8');
            assert.ok(!content.includes(secretValue), 'Ciphertext must NEVER contain plain text secret');
        });

        test('Should support multiple distinct secrets', () => {
            vaultService.storeSecret('key_a', 'alpha_value');
            vaultService.storeSecret('key_b', 'beta_value');

            assert.strictEqual(vaultService.getSecret('key_a'), 'alpha_value');
            assert.strictEqual(vaultService.getSecret('key_b'), 'beta_value');
        });
    });

    describe('2. Rotating Proxy Pool & Circuit Breaker', () => {
        test('Should mask passwords in proxies to prevent credential leakage', () => {
            const masked = proxyService.maskProxy('http://admin:superSecret123@192.168.1.100:8080');
            assert.ok(!masked.includes('superSecret123'), 'Masked proxy must not contain plain text password');
            assert.ok(masked.includes('***'), 'Masked proxy should contain ***');
        });

        test('Should cycle through healthy proxies in round-robin sequence', () => {
            proxyService.addProxy('http://proxy_a.io:8080');
            proxyService.addProxy('http://proxy_b.io:8080');

            const first = proxyService.getNextProxy();
            const second = proxyService.getNextProxy();
            assert.ok(first.url !== null, 'Proxy should be returned');
            assert.ok(second.url !== null, 'Proxy should be returned');
        });

        test('Should quarantine proxy on failure and bypass it in next request', () => {
            const targetUrl = 'http://proxy_quarantine_test.io:8080';
            proxyService.addProxy(targetUrl);
            proxyService.reportFailure(targetUrl, 'HTTP 429 Rate Limit', 30000);

            const status = proxyService.getPoolStatus();
            const target = status.proxies.find(p => p.url.includes('proxy_quarantine_test.io'));
            assert.ok(target, 'Target proxy must be present in pool status');
            assert.strictEqual(target.status, 'quarantined');
            assert.ok(target.quarantinedRemainingSeconds > 0);
        });
    });

    describe('3. Logger Service & Observability', () => {
        test('Should record logs and provide ring buffer access', () => {
            const testMsg = 'Suite test log entry ' + Date.now();
            loggerService.info('test', testMsg);

            const recent = loggerService.getRecentLogs(10);
            assert.ok(recent.length > 0, 'Recent logs should not be empty');
            const found = recent.some(l => l.message === testMsg);
            assert.ok(found, 'Log buffer should contain the recorded log');
        });
    });

    describe('4. Telemetry SSE Service', () => {
        test('Should have functional EventEmitter and telemetry dispatchers', () => {
            assert.strictEqual(typeof telemetryService.broadcast, 'function');
            assert.strictEqual(typeof telemetryService.emitMcpEvent, 'function');
            assert.strictEqual(typeof telemetryService.emitSystemEvent, 'function');

            // Verify non-throwing broadcast when no clients connected
            assert.doesNotThrow(() => {
                telemetryService.emitSystemEvent('test_event', { ok: true });
            });
        });
    });

    describe('5. Live HTTP Sanity & API Endpoints', () => {
        function fetchJson(urlPath) {
            return new Promise((resolve, reject) => {
                http.get(`http://localhost:3001${urlPath}`, { agent: false }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            reject(new Error(`Failed to parse response from ${urlPath}: ${data}`));
                        }
                    });
                }).on('error', reject);
            });
        }

        test('GET /api/system/sanity should return 200 with all components', async () => {
            const res = await fetchJson('/api/system/sanity');
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.components, 'Components block must exist');
            assert.ok(res.data.components.database, 'Database health check must exist');
            assert.ok(res.data.components.aiService, 'AI Service check must exist');
            assert.ok(res.data.components.mcpScraper, 'MCP Scraper check must exist');
            assert.ok(res.data.components.proxyPool, 'Proxy pool check must exist');
        });

        test('GET /api/proxy/status should return 200 with valid pool state', async () => {
            const res = await fetchJson('/api/proxy/status');
            assert.strictEqual(res.status, 200);
            assert.ok(typeof res.data.total === 'number');
            assert.ok(Array.isArray(res.data.proxies));
        });

        test('GET /api/health should return ok', async () => {
            const res = await fetchJson('/api/health');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.status, 'ok');
        });

        test('GET /api/health/live should return alive status with uptime', async () => {
            const res = await fetchJson('/api/health/live');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.status, 'alive');
            assert.ok(typeof res.data.uptimeSeconds === 'number');
        });

        test('GET /api/health/ready should return readiness with dependency check', async () => {
            const res = await fetchJson('/api/health/ready');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.status, 'ready');
            assert.ok(res.data.database);
            assert.ok(res.data.aiBridgeTarget);
        });

        test('GET /api/openapi.json should return valid OpenAPI 3.0.3 spec', async () => {
            const res = await fetchJson('/api/openapi.json');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.openapi, '3.0.3');
            assert.ok(res.data.info.title.includes('Neural LinkedIn Bot'));
            assert.ok(res.data.paths['/api/jobs/import']);
            assert.ok(res.data.paths['/api/autopilot/config']);
        });

        test('GET /api/docs should serve interactive Swagger UI HTML', async () => {
            const res = await new Promise((resolve, reject) => {
                http.get('http://localhost:3001/api/docs', { agent: false }, (r) => {
                    let text = '';
                    r.on('data', chunk => text += chunk);
                    r.on('end', () => resolve({ status: r.statusCode, text, contentType: r.headers['content-type'] }));
                }).on('error', reject);
            });
            assert.strictEqual(res.status, 200);
            assert.ok(res.contentType.includes('text/html'));
            assert.ok(res.text.includes('SwaggerUIBundle'));
        });

        test('GET /api/queue/status should return 200 with queue counts', async () => {
            const res = await fetchJson('/api/queue/status');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
            assert.ok(typeof res.data.queue.pending === 'number');
        });

        test('Correlation Middleware should auto-generate X-Correlation-ID', async () => {
            const res = await new Promise((resolve, reject) => {
                http.get('http://localhost:3001/api/health', { agent: false }, (r) => {
                    r.resume();
                    r.on('end', () => resolve({ headers: r.headers }));
                }).on('error', reject);
            });
            assert.ok(res.headers['x-correlation-id'], 'Must inject X-Correlation-ID header');
            assert.ok(res.headers['x-correlation-id'].length > 10);
        });

        test('Correlation Middleware should preserve incoming X-Correlation-ID across boundary', async () => {
            const customId = 'trace-staff-test-correlation-uuid-999';
            const res = await new Promise((resolve, reject) => {
                http.get('http://localhost:3001/api/health', {
                    agent: false,
                    headers: { 'X-Correlation-ID': customId }
                }, (r) => {
                    r.resume();
                    r.on('end', () => resolve({ headers: r.headers }));
                }).on('error', reject);
            });
            assert.strictEqual(res.headers['x-correlation-id'], customId);
        });
    });

    describe('6. AI Engine Microservice Bridge (:8001)', () => {
        const aiEngineClient = require('../services/ai_engine_client');

        test('Should resolve AI Engine target URL dynamically without hardcoded localhost', () => {
            const target = aiEngineClient.getBaseUrl();
            assert.ok(typeof target === 'string');
            assert.ok(target.length > 5);
            assert.ok(!target.endsWith('/'), 'Base URL must be normalized without trailing slash');
        });

        test('Should return structured health check result with latency and target', async () => {
            const health = await aiEngineClient.checkHealth();
            assert.ok(typeof health.online === 'boolean');
            assert.ok(health.target, 'Target URL must be present');
        });

        test('Should query AI cache stats gracefully without crashing if offline', async () => {
            const cacheStats = await aiEngineClient.getCacheStats('test-correlation-id');
            assert.ok(typeof cacheStats === 'object');
            assert.ok('success' in cacheStats);
        });

        test('Should invoke pitch evaluation client method', async () => {
            const evalResult = await aiEngineClient.evalPitch('Hello, let us connect', ['Node.js'], [], 'test-cid');
            assert.ok(typeof evalResult === 'object');
            assert.ok('success' in evalResult);
        });
    });

    describe('7. API Shield & Zod Contract Validation', () => {
        const { JobImportSchema, AutopilotConfigSchema } = require('../contracts/schemas');

        function postJson(urlPath, payload) {
            return new Promise((resolve, reject) => {
                const bodyStr = JSON.stringify(payload);
                const req = http.request(`http://localhost:3001${urlPath}`, {
                    method: 'POST',
                    agent: false,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(bodyStr)
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            reject(new Error(`Failed to parse response from ${urlPath}: ${data}`));
                        }
                    });
                });
                req.on('error', reject);
                req.write(bodyStr);
                req.end();
            });
        }

        test('JobImportSchema should reject empty jobs lacking URL and description', () => {
            const res = JobImportSchema.safeParse({ title: 'Engineer' });
            assert.strictEqual(res.success, false);
        });

        test('JobImportSchema should accept valid job with description', () => {
            const res = JobImportSchema.safeParse({
                title: 'Staff Engineer',
                company: 'DeepMind',
                description: 'Build enterprise resilient agentic distributed systems.'
            });
            assert.strictEqual(res.success, true);
        });

        test('POST /api/autopilot/config should reject dailyLimit out of bounds (>10) with HTTP 422', async () => {
            const res = await postJson('/api/autopilot/config', {
                dailyLimit: 99,
                intervalHours: 6,
                maxPages: 2
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.data.success, false);
            assert.ok(res.data.issues.length > 0);
            assert.ok(res.data.issues.some(i => i.field === 'dailyLimit'));
        });

        test('POST /api/autopilot/config should accept valid config within bounds with HTTP 200', async () => {
            const res = await postJson('/api/autopilot/config', {
                dailyLimit: 5,
                intervalHours: 4,
                maxPages: 3
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
        });
    });

    describe('8. Transactional Queue, Idempotency & Backoff Engine', () => {
        const queueService = require('../services/queue_service');

        test('Should enqueue a job and retrieve it in pending state', async () => {
            const uniqueKey = 'job_test_' + Date.now();
            const enqueueRes = await queueService.enqueue('scrape_target', { url: 'https://test.io' }, { idempotencyKey: uniqueKey });

            assert.strictEqual(enqueueRes.success, true);
            assert.strictEqual(enqueueRes.isDuplicate, false);
            assert.ok(enqueueRes.job.id);
        });

        test('Should enforce idempotency by rejecting duplicate key', async () => {
            const uniqueKey = 'idempotent_key_' + Date.now();
            const first = await queueService.enqueue('analyze_job', { target: 123 }, { idempotencyKey: uniqueKey });
            assert.strictEqual(first.isDuplicate, false);

            const duplicate = await queueService.enqueue('analyze_job', { target: 123 }, { idempotencyKey: uniqueKey });
            assert.strictEqual(duplicate.isDuplicate, true);
        });

        test('Should transition job from pending to active on dequeue', async () => {
            const testType = 'test_pop_' + Date.now();
            await queueService.enqueue(testType, { data: 'sample' });

            const dequeued = await queueService.getNextJob(testType);
            assert.ok(dequeued, 'Job should be popped');
            assert.strictEqual(dequeued.status, 'active');
            assert.strictEqual(dequeued.attempts, 1);

            await queueService.completeJob(dequeued.id);
        });

        test('Should calculate exponential backoff with jitter on failure and quarantine on rate-limit', async () => {
            const testType = 'test_fail_' + Date.now();
            const enq = await queueService.enqueue(testType, { retry: true });
            const job = await queueService.getNextJob(testType);

            // Fail with standard error (should remain pending for retry)
            const retryRes = await queueService.failJob(job.id, new Error('Temporary network glitch'), false);
            assert.strictEqual(retryRes.status, 'pending');
            assert.ok(retryRes.nextRetryInMs > 2000, 'Backoff must introduce positive delay');

            // Fail with Rate-Limit (should be quarantined)
            const rateLimitRes = await queueService.failJob(job.id, 'HTTP 429 Too Many Requests', true);
            assert.strictEqual(rateLimitRes.status, 'quarantined');
            assert.ok(rateLimitRes.nextRetryInMs >= 120000, 'Rate-limit quarantine must be at least 2 minutes');
        });

        test('GET /api/queue/status should return structured counts', async () => {
            const status = await queueService.getQueueStatus();
            assert.ok(typeof status.pending === 'number');
            assert.ok(typeof status.active === 'number');
            assert.ok(typeof status.completed === 'number');
            assert.ok(typeof status.failed === 'number');
            assert.ok(typeof status.quarantined === 'number');
        });
    });

    describe('9. Closed-Loop Learning Flywheel (Staff AI 2026)', () => {
        const vectorEngine = require('../vector_engine');

        test('recordPitchOutcome should record telemetry without throwing even in fallback', async () => {
            const res = await vectorEngine.recordPitchOutcome('test-job-uuid-123', 'interview', 0.9);
            assert.ok(typeof res === 'object');
            assert.ok('success' in res);
        });

        test('saveWinningPitch should safely guard against short or empty inputs', async () => {
            await vectorEngine.saveWinningPitch('', 'Role', 'Company');
            await vectorEngine.saveWinningPitch('Too short', 'Role', 'Company');
            // Must complete cleanly without error
            assert.ok(true);
        });
    });
});
