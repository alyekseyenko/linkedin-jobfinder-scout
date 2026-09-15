// ============================================================
// 🧠 AI ENGINE CLIENT — Microservice Bridge & Circuit Breaker
// Resilient communication between Express and Python FastAPI (:8001)
// ============================================================

const axios = require('axios');
const logger = require('./logger_service');

class AiEngineClient {
    constructor() {
        this.baseUrl = (process.env.AI_ENGINE_URL || 'http://localhost:8001').replace(/\/$/, '');
        this.timeout = parseInt(process.env.AI_ENGINE_TIMEOUT_MS, 10) || 300000; // 300s (5 min) default for local LLMs/LangGraph
        this.isOnline = null;
        this.lastHealthCheck = 0;
        logger.info('ai_engine', `AI Engine Bridge initialized targeting: ${this.baseUrl}`);
    }

    getBaseUrl() {
        return (process.env.AI_ENGINE_URL || 'http://localhost:8001').replace(/\/$/, '');
    }

    async checkHealth(correlationId = null) {
        const url = `${this.getBaseUrl()}/health`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const start = Date.now();
            const res = await axios.get(url, { headers, timeout: 3000 });
            this.isOnline = true;
            this.lastHealthCheck = Date.now();
            return {
                online: true,
                latencyMs: Date.now() - start,
                data: res.data,
                target: this.getBaseUrl(),
                correlationId: res.headers['x-correlation-id'] || correlationId
            };
        } catch (err) {
            this.isOnline = false;
            this.lastHealthCheck = Date.now();
            return {
                online: false,
                target: this.getBaseUrl(),
                error: err.message,
                reason: `FastAPI service offline at ${this.getBaseUrl()}`
            };
        }
    }

    async analyzeJob(jobData, candidateProfile, candidateSkills = [], groqKey = null, geminiKey = null, correlationId = null) {
        const url = `${this.getBaseUrl()}/crew/analyze`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            logger.info('ai_engine', `Dispatching job analysis to CrewAI/LangGraph at ${url} [Trace: ${correlationId || 'none'}]`);
            const payload = {
                job_data: jobData,
                candidate_profile: candidateProfile,
                candidate_skills: candidateSkills,
                groq_key: groqKey || process.env.GROQ_API_KEY,
                gemini_key: geminiKey || process.env.GEMINI_API_KEY
            };
            const res = await axios.post(url, payload, { headers, timeout: this.timeout });
            return { success: true, data: res.data, correlationId: res.headers['x-correlation-id'] || correlationId };
        } catch (err) {
            logger.error('ai_engine', `CrewAI analysis failed [Trace: ${correlationId || 'none'}]: ${err.message}`);
            return {
                success: false,
                error: err.message,
                details: err.response?.data?.detail || 'Microservice unavailable'
            };
        }
    }

    async getAllMemories(correlationId = null) {
        const url = `${this.getBaseUrl()}/memory/all`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.get(url, { headers, timeout: 4000 });
            return { success: true, memories: res.data };
        } catch (err) {
            logger.warn('ai_engine', `Failed to query memories from :8001: ${err.message}`);
            return { success: false, memories: [], error: err.message };
        }
    }

    async addMemory(text, metadata = {}, correlationId = null) {
        const url = `${this.getBaseUrl()}/memory/add`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.post(url, { text, metadata }, { headers, timeout: 5000 });
            return { success: true, data: res.data };
        } catch (err) {
            logger.warn('ai_engine', `Failed to add memory: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    async queryGraph(query, mode = 'hybrid', correlationId = null) {
        const url = `${this.getBaseUrl()}/graph/query`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.post(url, { query, mode }, { headers, timeout: this.timeout });
            return { success: true, result: res.data?.result || res.data };
        } catch (err) {
            logger.error('ai_engine', `Graph query failed: ${err.message}`);
            return {
                success: false,
                error: err.message,
                message: `Graph Intelligence Probe Failed (${this.getBaseUrl()} offline?)`
            };
        }
    }

    async ingestGraph(text, correlationId = null) {
        const url = `${this.getBaseUrl()}/graph/ingest`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.post(url, { text }, { headers, timeout: 30000 });
            return { success: true, data: res.data };
        } catch (err) {
            logger.error('ai_engine', `Graph ingest failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    async getCacheStats(correlationId = null) {
        const url = `${this.getBaseUrl()}/ai/cache/stats`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.get(url, { headers, timeout: 5000 });
            return { success: true, stats: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async clearCache(correlationId = null) {
        const url = `${this.getBaseUrl()}/ai/cache/clear`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.post(url, {}, { headers, timeout: 5000 });
            return { success: true, data: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async evalPitch(pitch, candidateSkills = [], jobRequirements = [], correlationId = null) {
        const url = `${this.getBaseUrl()}/ai/eval/pitch`;
        const headers = correlationId ? { 'X-Correlation-ID': correlationId } : {};
        try {
            const res = await axios.post(url, {
                pitch,
                candidate_skills: candidateSkills,
                job_requirements: jobRequirements
            }, { headers, timeout: 5000 });
            return { success: true, evaluation: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

module.exports = new AiEngineClient();
