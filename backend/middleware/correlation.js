// ============================================================
// 🔍 CORRELATION ID MIDDLEWARE (Staff Principal Architecture)
// Traces requests across Frontend -> Express -> FastAPI microservices
// ============================================================

const crypto = require('crypto');

function correlationMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] || 
                          req.headers['x-request-id'] || 
                          crypto.randomUUID();

    req.correlationId = correlationId;
    global.activeCorrelationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
}

module.exports = { correlationMiddleware };
