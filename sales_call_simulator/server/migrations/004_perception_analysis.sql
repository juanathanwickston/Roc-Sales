-- 003_perception_analysis.sql
-- Adds perception analysis storage and tracking.
-- Tavus Raven-1 provides end-of-call visual/behavioral analysis.

-- session_perception_analysis: stores raw and normalized perception data per session
CREATE TABLE session_perception_analysis (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  raw_analysis JSONB,
  normalized_analysis JSONB,
  source VARCHAR(50) DEFAULT 'tavus_raven1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One perception analysis per session
CREATE UNIQUE INDEX idx_session_perception_analysis_session_id
  ON session_perception_analysis (session_id);

-- Add perception_status tracking to simulation_sessions
ALTER TABLE simulation_sessions
  ADD COLUMN IF NOT EXISTS perception_status VARCHAR(50) DEFAULT 'pending';

-- Apply updated_at trigger
CREATE TRIGGER update_session_perception_analysis_updated_at
  BEFORE UPDATE ON session_perception_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
