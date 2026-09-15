const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Config
const QDRANT_URL = process.env.QDRANT_HOST ? `http://${process.env.QDRANT_HOST}:6333` : 'http://localhost:6333';
const COLLECTION_NAME = 'job_analyses_cache';
const USE_QDRANT = process.env.USE_QDRANT === 'true';

let genAI = null;
let model = null;

if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "text-embedding-004" }); // Best for semantic search
}

/**
 * Semantic Cache Service
 * Powered by Gemini + Qdrant
 */
const cacheService = {
    /**
     * Initialize Qdrant Collection
     */
    async init() {
        if (!USE_QDRANT) return;
        try {
            console.log('[CACHE] Checking Qdrant collection...');
            const response = await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`).catch(() => null);
            
            if (!response) {
                console.log(`[CACHE] Creating new collection: ${COLLECTION_NAME}`);
                await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
                    vectors: {
                        size: 768, // Gemini text-embedding-004 size
                        distance: 'Cosine'
                    }
                });
                console.log('[CACHE] Collection created ✅');
            }
        } catch (e) {
            console.error('[CACHE ERROR] Qdrant init failed:', e.message);
        }
    },

    /**
     * Get Embedding for text
     */
    async getEmbedding(text) {
        if (!model) return null;
        try {
            // Clean text to avoid huge payloads
            const cleanText = text.substring(0, 5000);
            const result = await model.embedContent(cleanText);
            return result.embedding.values;
        } catch (e) {
            console.error('[CACHE ERROR] Embedding failed:', e.message);
            return null;
        }
    },

    // Fast in-memory cache fallback for local/test environments
    _memoryCache: new Map(),

    /**
     * Search for similar analysis
     */
    async findSimilar(text) {
        if (!USE_QDRANT || !model) {
            const key = (text || '').trim().toLowerCase().substring(0, 100);
            return this._memoryCache.get(key) || null;
        }
        
        try {
            const vector = await this.getEmbedding(text);
            if (!vector) return null;

            const response = await axios.post(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
                vector: vector,
                limit: 1,
                with_payload: true,
                score_threshold: 0.95 // High similarity only
            });

            const match = response.data.result[0];
            if (match) {
                console.log(`[CACHE HIT] Found semantically similar analysis (Score: ${match.score.toFixed(4)})`);
                return match.payload.analysisResult;
            }
            return null;
        } catch (e) {
            console.error('[CACHE ERROR] Search failed:', e.message);
            return null;
        }
    },

    // Alias for contract compatibility
    async findMatch(jobId, text) {
        return this.findSimilar(text);
    },

    /**
     * Store analysis in cache
     */
    async store(jobId, text, analysisResult) {
        // Always store in fast memory fallback
        const key = (text || '').trim().toLowerCase().substring(0, 100);
        this._memoryCache.set(key, analysisResult);

        if (!USE_QDRANT || !model) return;
        
        try {
            const vector = await this.getEmbedding(text);
            if (!vector) return;

            await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
                points: [
                    {
                        id: Buffer.from(jobId).toString('hex').substring(0, 32), // Qdrant needs UUID or hex string
                        vector: vector,
                        payload: {
                            jobId,
                            timestamp: new Date().toISOString(),
                            analysisResult
                        }
                    }
                ]
            });
            console.log(`[CACHE] Stored analysis for ${jobId} in vector engine.`);
        } catch (e) {
            console.error('[CACHE ERROR] Storage failed:', e.message);
        }
    }
};

module.exports = cacheService;
