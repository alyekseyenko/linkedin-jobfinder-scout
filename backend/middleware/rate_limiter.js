// ============================================================
// 🛡️ API RATE LIMITER (In-Memory Sliding Window / Distributed)
// Protects inference endpoints & avoids abuse on scraping / AI calls
// ============================================================

const requestCounts = new Map();

function createLimiter({ windowMs = 60000, max = 30, message = 'Too many requests, please try again later.' } = {}) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const key = `${req.baseUrl || ''}${req.path}:${ip}`;
        const now = Date.now();

        let clientData = requestCounts.get(key);
        if (!clientData || now - clientData.startTime > windowMs) {
            clientData = { count: 1, startTime: now };
            requestCounts.set(key, clientData);
            return next();
        }

        clientData.count++;
        if (clientData.count > max) {
            const retryAfterSec = Math.ceil((clientData.startTime + windowMs - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: message,
                retryAfterSeconds: retryAfterSec
            });
        }

        next();
    };
}

// 1. General API Limiter: 100 requests / 15 minutes
const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: 'Global API rate limit exceeded. Please retry in a few minutes.'
});

// 2. Strict AI Inference Limiter: 15 requests / minute
const aiLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: 'AI inference rate limit reached. Please allow 1 minute between heavy analysis requests.'
});

module.exports = {
    createLimiter,
    apiLimiter,
    aiLimiter
};
