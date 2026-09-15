// ============================================================
// 🧠 NEURAL SCOUT — Vector Engine v2 (Local PostgreSQL + pgvector)
// Two separate memory stores:
//   - candidate_memory: fragments ABOUT THE CANDIDATE (CV, skills, experience)
//   - market_memory:    fragments ABOUT THE JOB MARKET (vacancies, companies)
// ============================================================

const { Pool } = require('pg');
const { pipeline } = require('@xenova/transformers');
require('dotenv').config();

// Singleton embedding extractor (all-MiniLM-L6-v2 -> 384 dimensions)
let embedderPromise = null;
async function getEmbedder() {
    if (!embedderPromise) {
        console.log('[PGVECTOR] Loading local embedding model (Xenova/all-MiniLM-L6-v2)...');
        embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedderPromise;
}

async function generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return null;
    try {
        const pipe = await getEmbedder();
        const output = await pipe(text.trim(), { pooling: 'mean', normalize: true });
        return '[' + Array.from(output.data).join(',') + ']';
    } catch (err) {
        console.warn('[PGVECTOR] Failed to generate vector embedding:', err.message);
        return null;
    }
}

// Local PostgreSQL pool (inside Docker network: postgres:5432)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neural:neural@127.0.0.1:5432/neural_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 1500
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

// ── Initialization ──────────────────────────────────────────
async function initVectorEngine() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TABLE IF NOT EXISTS jobs (
              id SERIAL PRIMARY KEY,
              linkedin_id TEXT UNIQUE NOT NULL,
              title TEXT,
              company TEXT,
              location TEXT,
              description TEXT,
              url TEXT,
              salary TEXT,
              type TEXT DEFAULT 'Full-time',
              match_score INT DEFAULT 0,
              status TEXT DEFAULT 'discovered',
              matched_skills TEXT[],
              skills_gaps TEXT[],
              analysis JSONB,
              source TEXT DEFAULT 'linkedin',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS candidate_memory (
              id SERIAL PRIMARY KEY,
              content TEXT NOT NULL,
              source TEXT DEFAULT 'manual',
              embedding vector(384),
              created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS market_memory (
              id SERIAL PRIMARY KEY,
              content TEXT NOT NULL,
              source TEXT DEFAULT 'job_import',
              embedding vector(384),
              created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS user_profiles (
              id SERIAL PRIMARY KEY,
              user_id TEXT UNIQUE DEFAULT 'master_user',
              knowledge_base JSONB DEFAULT '{}',
              updated_at TIMESTAMP DEFAULT NOW()
            );
            INSERT INTO user_profiles (user_id, knowledge_base)
            VALUES ('master_user', '{}')
            ON CONFLICT (user_id) DO NOTHING;
        `);
        client.release();
        console.log('[DB] PostgreSQL local (pgvector) connected & schemas verified ✅');
        // Backfill any unindexed memories in background
        backfillEmbeddings().catch(e => console.warn('[PGVECTOR] Background backfill error:', e.message));
    } catch (err) {
        console.error('[DB] Connection failed — is postgres container running?', err.message);
    }
}

// ── Lightweight text chunker ─────────────────────────────────
function chunkText(text) {
    return text
        .split(/[\n\.;]/)
        .map(t => t.trim())
        .filter(t => t.length > 10);
}

// ── CANDIDATE MEMORY: "who I am" ─────────────────────────────
// Stores CV, experience bullets, skills — about the candidate with dense vectors
async function addCandidateMemory(text, source = 'Manual') {
    if (!text || text.length < 5) return;
    const chunks = chunkText(text);
    console.log(`[CANDIDATE MEM] Ingesting ${chunks.length} fragments with pgvector from "${source}"...`);
    for (const chunk of chunks) {
        try {
            const vec = await generateEmbedding(chunk);
            if (vec) {
                await pool.query(
                    'INSERT INTO candidate_memory (content, source, embedding) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [chunk, source, vec]
                );
            } else {
                await pool.query(
                    'INSERT INTO candidate_memory (content, source) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [chunk, source]
                );
            }
        } catch (err) {
            console.warn('[CANDIDATE MEM] Chunk insert failed:', err.message);
        }
    }
}

// ── MARKET MEMORY: "what the market wants" ───────────────────
// Stores job descriptions, company intel — about the job market with dense vectors
async function addMarketMemory(text, source = 'Job Import') {
    if (!text || text.length < 5) return;
    const chunks = chunkText(text);
    console.log(`[MARKET MEM] Ingesting ${chunks.length} fragments with pgvector from "${source}"...`);
    for (const chunk of chunks) {
        try {
            const vec = await generateEmbedding(chunk);
            if (vec) {
                await pool.query(
                    'INSERT INTO market_memory (content, source, embedding) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [chunk, source, vec]
                );
            } else {
                await pool.query(
                    'INSERT INTO market_memory (content, source) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [chunk, source]
                );
            }
        } catch (err) {
            console.warn('[MARKET MEM] Chunk insert failed:', err.message);
        }
    }
}

// ── Legacy alias: addInformation → candidate_memory ──────────
// Keeps backwards compatibility with existing server.js calls
async function addInformation(text, source = 'Manual') {
    return addCandidateMemory(text, source);
}

// ── SEARCH: semantic similarity via pgvector ─────────────────
// Returns candidate memory fragments most relevant to a query using cosine distance
async function searchCandidateMemory(query, limit = 8) {
    try {
        const vec = await generateEmbedding(query);
        if (vec) {
            const result = await pool.query(
                `SELECT content, source, 1 - (embedding <=> $1) AS similarity
                 FROM candidate_memory
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1 ASC
                 LIMIT $2`,
                [vec, limit]
            );
            return result.rows.map(r => ({ text: r.content, source: r.source, similarity: Number(r.similarity) }));
        }
        // Graceful fallback to text similarity if embedder is unavailable
        const result = await pool.query(
            `SELECT content, source
             FROM candidate_memory
             ORDER BY SIMILARITY(content, $1) DESC
             LIMIT $2`,
            [query, limit]
        );
        return result.rows.map(r => ({ text: r.content, source: r.source, similarity: 1 }));
    } catch (err) {
        console.warn('[CANDIDATE MEM] Search failed:', err.message);
        return [];
    }
}

// ── SEARCH MARKET MEMORY ─────────────────────────────────────
async function searchMarketMemory(query, limit = 5) {
    try {
        const vec = await generateEmbedding(query);
        if (vec) {
            const result = await pool.query(
                `SELECT content, source, 1 - (embedding <=> $1) AS similarity
                 FROM market_memory
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1 ASC
                 LIMIT $2`,
                [vec, limit]
            );
            return result.rows.map(r => ({ text: r.content, source: r.source, similarity: Number(r.similarity) }));
        }
        return [];
    } catch (err) {
        console.warn('[MARKET MEM] Search failed:', err.message);
        return [];
    }
}

// ── Legacy alias: searchMemory → candidate memory ────────────
async function searchMemory(query, limit = 5) {
    return searchCandidateMemory(query, limit);
}

// ── WINNING PITCH LEARNING FLYWHEEL ───────────────────────────
// Saves approved pitches to candidate_memory so the AI learns past winning styles
async function saveWinningPitch(pitchText, jobTitle, company) {
    if (!pitchText || pitchText.length < 20) return;
    const source = `Winning Pitch: ${jobTitle} @ ${company}`;
    const fullText = `Winning Application Pitch for ${jobTitle} at ${company}:\n${pitchText}`;
    console.log(`[NEURAL FLYWHEEL] 🏆 Saving winning pitch to candidate_memory: ${jobTitle} @ ${company}`);
    try {
        const vec = await generateEmbedding(fullText);
        if (vec) {
            await pool.query(
                'INSERT INTO candidate_memory (content, source, embedding) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [fullText, source, vec]
            );
        } else {
            await pool.query(
                'INSERT INTO candidate_memory (content, source) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [fullText, source]
            );
        }
    } catch (err) {
        console.warn('[NEURAL FLYWHEEL WARNING]', err.message);
    }
}

// ── BACKFILL EMBEDDINGS ───────────────────────────────────────
// Computes and updates dense vectors for existing rows where embedding IS NULL
async function backfillEmbeddings() {
    try {
        const candidateRows = await pool.query(
            'SELECT id, content FROM candidate_memory WHERE embedding IS NULL LIMIT 500'
        );
        if (candidateRows.rows.length > 0) {
            console.log(`[PGVECTOR] ⚡ Backfilling vectors for ${candidateRows.rows.length} candidate memories...`);
            for (const row of candidateRows.rows) {
                try {
                    const vec = await generateEmbedding(row.content);
                    if (vec) {
                        await pool.query('UPDATE candidate_memory SET embedding = $1 WHERE id = $2', [vec, row.id]);
                    }
                } catch (e) {
                    // Continue with other rows
                }
            }
            console.log('[PGVECTOR] ✅ Candidate memory vector backfill completed.');
        }

        const marketRows = await pool.query(
            'SELECT id, content FROM market_memory WHERE embedding IS NULL LIMIT 500'
        );
        if (marketRows.rows.length > 0) {
            console.log(`[PGVECTOR] ⚡ Backfilling vectors for ${marketRows.rows.length} market memories...`);
            for (const row of marketRows.rows) {
                try {
                    const vec = await generateEmbedding(row.content);
                    if (vec) {
                        await pool.query('UPDATE market_memory SET embedding = $1 WHERE id = $2', [vec, row.id]);
                    }
                } catch (e) {
                    // Continue with other rows
                }
            }
            console.log('[PGVECTOR] ✅ Market memory vector backfill completed.');
        }
    } catch (err) {
        console.warn('[PGVECTOR] Backfill check error:', err.message);
    }
}

// Closed-loop outcome tracker (Staff AI 2026: Flywheel Feedback)
async function recordPitchOutcome(jobId, outcome, score = 1.0) {
    try {
        await pool.query(
            `UPDATE jobs SET outcome = $1, outcome_score = $2, outcome_recorded_at = NOW() WHERE linkedin_id = $3 OR id::text = $3`,
            [outcome, score, jobId]
        );

        // Auto-Reinforcement Learning Flywheel (Milestone 5)
        // If candidate gets traction (applied, interviewing, offered), feed back into profile memory
        if (['applied', 'interviewing', 'offered', 'accepted'].includes(outcome.toLowerCase())) {
            const { rows } = await pool.query(
                `SELECT title, company, description, deep_intelligence_pack FROM jobs WHERE linkedin_id = $1 OR id::text = $1`,
                [jobId]
            );
            if (rows && rows[0]) {
                const job = rows[0];
                const feedbackText = `🏆 POSITIVE TRACTION PROFILE EVENT:\nPosition: ${job.title} at ${job.company}.\nThis target profile matches our optimal market fit. Keywords and tech stack in this description are confirmed high-match vectors:\n${job.description.substring(0, 1500)}`;
                
                console.log(`[NEURAL FLYWHEEL] 🔄 Auto-reinforcing optimal match vector from job: ${job.title} @ ${job.company}`);
                await addCandidateMemory(feedbackText, `Flywheel Auto-Reinforcement: ${jobId}`);
            }
        }

        return { success: true, outcome, score };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ── DB raw query (for server.js direct use) ──────────────────
let dbStatusCheckedAt = 0;
let dbIsOnline = null;

async function dbQuery(sql, params = []) {
    if (dbIsOnline === false && (Date.now() - dbStatusCheckedAt < 15000)) {
        throw new Error('PostgreSQL database circuit breaker open (offline)');
    }
    try {
        const res = await pool.query(sql, params);
        dbIsOnline = true;
        return res;
    } catch (err) {
        dbIsOnline = false;
        dbStatusCheckedAt = Date.now();
        throw err;
    }
}

// ── USER PROFILE PERSISTENCE (PostgreSQL JSONB) ──────────────
async function getUserProfile(userId = 'master_user') {
    try {
        const result = await pool.query(
            'SELECT knowledge_base FROM user_profiles WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].knowledge_base;
        }
        return null;
    } catch (err) {
        console.error('[DB PROFILE FETCH ERROR]', err.message);
        return null;
    }
}

async function saveUserProfile(knowledgeBaseData, userId = 'master_user') {
    try {
        await pool.query(
            `INSERT INTO user_profiles (user_id, knowledge_base, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET knowledge_base = $2, updated_at = NOW()`,
            [userId, JSON.stringify(knowledgeBaseData)]
        );
        return true;
    } catch (err) {
        console.error('[DB PROFILE SAVE ERROR]', err.message);
        throw err;
    }
}

// ── Health Check ─────────────────────────────────────────────
async function healthCheck() {
    const start = Date.now();
    try {
        await pool.query('SELECT 1');
        return {
            status: 'online',
            latencyMs: Date.now() - start,
            provider: 'PostgreSQL'
        };
    } catch (err) {
        return {
            status: 'degraded/offline',
            error: err.message,
            fallback: 'JSON File Persistence Active'
        };
    }
}

module.exports = {
    pool,
    dbQuery,
    healthCheck,
    initVectorEngine,
    getUserProfile,
    saveUserProfile,
    generateEmbedding,
    backfillEmbeddings,
    addInformation,          // legacy — writes to candidate_memory
    addCandidateMemory,      // "who I am" — CV, skills, experience
    addMarketMemory,         // "what market wants" — job descriptions
    saveWinningPitch,        // self-improving flywheel — stores approved pitches
    recordPitchOutcome,      // closed-loop telemetry feedback
    searchMemory,            // legacy alias
    searchCandidateMemory,   // semantic search of candidate fragments
    searchMarketMemory       // semantic search of market/job fragments
};
