const { describe, it } = require('node:test');
const assert = require('node:assert');
const { correlationMiddleware } = require('../../middleware/correlation');

describe('Correlation Telemetry Middleware', () => {
    it('propagates incoming x-correlation-id header', () => {
        const req = {
            headers: { 'x-correlation-id': 'custom-cid-12345' }
        };
        const headersSet = {};
        const res = {
            setHeader: (k, v) => { headersSet[k] = v; }
        };
        let nextCalled = false;

        correlationMiddleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(req.correlationId, 'custom-cid-12345');
        assert.strictEqual(headersSet['X-Correlation-ID'], 'custom-cid-12345');
        assert.strictEqual(nextCalled, true);
    });

    it('generates a new correlation UUID if header is missing', () => {
        const req = { headers: {} };
        const headersSet = {};
        const res = {
            setHeader: (k, v) => { headersSet[k] = v; }
        };
        let nextCalled = false;

        correlationMiddleware(req, res, () => { nextCalled = true; });

        assert.ok(req.correlationId);
        assert.strictEqual(typeof req.correlationId, 'string');
        assert.ok(req.correlationId.length > 10);
        assert.strictEqual(headersSet['X-Correlation-ID'], req.correlationId);
        assert.strictEqual(nextCalled, true);
    });
});
