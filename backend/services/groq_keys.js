/**
 * Parse Groq API keys from env (primary + comma-separated pool for rate-limit fallback).
 * Order: GROQ_API_KEY first, then GROQ_API_KEYS (deduped).
 */
function getGroqApiKeys() {
    const seen = new Set();
    const ordered = [];

    const primary = (process.env.GROQ_API_KEY || '').trim();
    if (primary) {
        seen.add(primary);
        ordered.push(primary);
    }

    const multi = (process.env.GROQ_API_KEYS || '').trim();
    if (multi) {
        for (const part of multi.split(/[,;\n]+/)) {
            const key = part.trim();
            if (key && !seen.has(key)) {
                seen.add(key);
                ordered.push(key);
            }
        }
    }

    return ordered;
}

function hasGroqApiKeys() {
    return getGroqApiKeys().length > 0;
}

module.exports = { getGroqApiKeys, hasGroqApiKeys };
