const { describe, it } = require('node:test');
const assert = require('node:assert');
const cacheService = require('../../services/cache_service');

describe('Semantic Cache Service', () => {
    it('stores and retrieves cached deep analysis payload', async () => {
        const jobId = 'mock_job_123';
        const description = 'Senior Machine Learning and Distributed Systems Architect with Python and Docker experience.';
        const analysis = { score: 92, summary: 'Exceptional match' };

        await cacheService.store(jobId, description, analysis);
        const match = await cacheService.findMatch(jobId, description);

        assert.ok(match, 'Cache should return a match');
        assert.strictEqual(match.score, 92);
        assert.strictEqual(match.summary, 'Exceptional match');
    });

    it('returns null on cache miss for non-existent job', async () => {
        const match = await cacheService.findMatch('job_that_does_not_exist', 'Completely different random prompt text.');
        assert.strictEqual(match, null);
    });
});
