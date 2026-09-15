// ============================================================
// 🛡️ VALIDATION MIDDLEWARE (Zod Request Boundary)
// Intercepts and rejects malformed payloads before domain logic
// ============================================================

const logger = require('../services/logger_service');

function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const formattedErrors = result.error.issues.map(issue => ({
                field: issue.path.join('.') || 'body',
                message: issue.message
            }));

            logger.warn('validation', `Schema validation rejected on ${req.method} ${req.path}`, {
                errors: formattedErrors
            });

            return res.status(422).json({
                success: false,
                error: 'Unprocessable Entity: Validation Error',
                issues: formattedErrors
            });
        }

        // Assign sanitized & validated body
        req.validatedBody = result.data;
        next();
    };
}

module.exports = {
    validateBody
};
