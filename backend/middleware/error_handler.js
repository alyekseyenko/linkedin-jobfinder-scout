// ============================================================
// 🛡️ ENTERPRISE ERROR HANDLER MIDDLEWARE
// Global catch-all for 404s and 500s with structured telemetry
// ============================================================

const loggerService = require('../services/logger_service');

function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
        correlationId: req.correlationId
    });
}

function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const correlationId = req.correlationId || 'N/A';

    loggerService.error('server', `[${correlationId}] ${req.method} ${req.originalUrl} failed: ${err.message}`, {
        stack: err.stack,
        status
    });

    res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        correlationId,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
