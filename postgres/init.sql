-- ============================================================
-- 🧠 NEURAL SCOUT — PostgreSQL Local Schema (pgvector)
-- Runs automatically on first docker compose up
-- ============================================================

-- Activate pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLE: jobs
-- Stores all discovered and imported job listings
-- ============================================================
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
  status TEXT DEFAULT 'discovered',   -- discovered | interested | rejected | applied
  matched_skills TEXT[],
  skills_gaps TEXT[],
  analysis JSONB,
  source TEXT DEFAULT 'linkedin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: candidate_memory
-- Stores semantic fragments ABOUT THE CANDIDATE
-- (CV, experience, skills, portfolio, achievements)
-- This is "who I am" — separate from job data
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_memory (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',       -- CV Auto-Seed | CV Upload | Web Study | LinkedIn Profile Sync
  embedding vector(384),              -- all-MiniLM-L6-v2 (384 dims)
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: market_memory
-- Stores semantic fragments ABOUT THE JOB MARKET
-- (imported job descriptions, company intel, market trends)
-- This is "what the market wants" — separate from candidate
-- ============================================================
CREATE TABLE IF NOT EXISTS market_memory (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'job_import',   -- Imported Job | HUNT | Web Forensics
  embedding vector(384),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: user_profiles
-- Stores the synthesized candidate profile & knowledge base
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE DEFAULT 'master_user',
  knowledge_base JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed a default profile row so the backend can always upsert
INSERT INTO user_profiles (user_id, knowledge_base)
VALUES ('master_user', '{}')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================================

-- Search candidate memory: "what have I done that matches this job?"
CREATE OR REPLACE FUNCTION search_candidate_memory(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 8
)
RETURNS TABLE(id INT, content TEXT, source TEXT, similarity FLOAT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    candidate_memory.id,
    candidate_memory.content,
    candidate_memory.source,
    1 - (candidate_memory.embedding <=> query_embedding) AS similarity
  FROM candidate_memory
  WHERE candidate_memory.embedding IS NOT NULL
    AND 1 - (candidate_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY candidate_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Search market memory: "what does the market want?"
CREATE OR REPLACE FUNCTION search_market_memory(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE(id INT, content TEXT, source TEXT, similarity FLOAT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    market_memory.id,
    market_memory.content,
    market_memory.source,
    1 - (market_memory.embedding <=> query_embedding) AS similarity
  FROM market_memory
  WHERE market_memory.embedding IS NOT NULL
    AND 1 - (market_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY market_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Legacy compatibility: match_memories (used by old vector_engine.js)
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE(id INT, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    candidate_memory.id,
    candidate_memory.content,
    jsonb_build_object('source', candidate_memory.source) AS metadata,
    1 - (candidate_memory.embedding <=> query_embedding) AS similarity
  FROM candidate_memory
  WHERE candidate_memory.embedding IS NOT NULL
    AND 1 - (candidate_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY candidate_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- INDEXES for fast vector search
-- ============================================================
CREATE INDEX IF NOT EXISTS candidate_memory_embedding_idx
  ON candidate_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS market_memory_embedding_idx
  ON market_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ============================================================
-- Done! Tables ready.
-- ============================================================
