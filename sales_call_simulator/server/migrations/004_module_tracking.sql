-- Migration 004: Course Redesign Schema
ALTER TABLE simulation_sessions
  ADD COLUMN IF NOT EXISTS module_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS persona_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relationship_summary TEXT,
  ADD COLUMN IF NOT EXISTS relationship_summary_json JSONB;

-- Indexing for fast rolling average calculations and user isolation
CREATE INDEX IF NOT EXISTS idx_sessions_user_module_persona_status
  ON simulation_sessions (external_user_id, module_id, persona_id, status, completed_at DESC);

-- Keep legacy session data isolated
UPDATE simulation_sessions 
SET module_id = 'legacy' 
WHERE module_id IS NULL;

-- Persistent masteries tracking with audit capability
CREATE TABLE IF NOT EXISTS module_masteries (
  id SERIAL PRIMARY KEY,
  external_user_id VARCHAR(255) NOT NULL,
  module_id VARCHAR(50) NOT NULL,
  persona_id VARCHAR(100) NOT NULL,
  mastery_score NUMERIC(5,2) NOT NULL,
  source_session_ids INTEGER[] NOT NULL,
  calculation_method VARCHAR(50) DEFAULT 'latest_3_scored_attempts',
  mastered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (external_user_id, module_id, persona_id)
);

-- Store raw vs final scores and auto fails
ALTER TABLE session_scores
  ADD COLUMN IF NOT EXISTS raw_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS final_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS automatic_fails_triggered JSONB,
  ADD COLUMN IF NOT EXISTS rubric_version VARCHAR(50) DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS scoring_model VARCHAR(50) DEFAULT 'gpt-4o';
