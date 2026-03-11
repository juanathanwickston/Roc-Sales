-- 001_core_schema.sql
-- Core tables for the Sales Call Simulator persistence layer.
-- Creates simulation_sessions, session_transcripts, and session_scores.

-- simulation_sessions: one row per call attempt
CREATE TABLE simulation_sessions (
  id SERIAL PRIMARY KEY,
  external_user_id VARCHAR(255),
  scenario_id VARCHAR(100) NOT NULL,
  tavus_conversation_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  transcript_status VARCHAR(50) DEFAULT 'pending',
  scoring_status VARCHAR(50) DEFAULT 'pending',
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying sessions by user
CREATE INDEX idx_simulation_sessions_external_user_id
  ON simulation_sessions (external_user_id);

-- Index for querying sessions by status
CREATE INDEX idx_simulation_sessions_status
  ON simulation_sessions (status);

-- Index for looking up sessions by Tavus conversation ID
CREATE INDEX idx_simulation_sessions_tavus_conversation_id
  ON simulation_sessions (tavus_conversation_id);

-- session_transcripts: raw and normalized transcript per session
CREATE TABLE session_transcripts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  raw_transcript TEXT,
  normalized_transcript TEXT,
  source VARCHAR(50) DEFAULT 'tavus',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One transcript per session
CREATE UNIQUE INDEX idx_session_transcripts_session_id
  ON session_transcripts (session_id);

-- session_scores: scoring results per session
CREATE TABLE session_scores (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  overall_score INTEGER,
  overall_verdict VARCHAR(50),
  categories JSONB,
  top_strengths JSONB,
  critical_improvements JSONB,
  coaching_tip TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One score per session
CREATE UNIQUE INDEX idx_session_scores_session_id
  ON session_scores (session_id);

-- Trigger function to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all three tables
CREATE TRIGGER update_simulation_sessions_updated_at
  BEFORE UPDATE ON simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_transcripts_updated_at
  BEFORE UPDATE ON session_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_scores_updated_at
  BEFORE UPDATE ON session_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
