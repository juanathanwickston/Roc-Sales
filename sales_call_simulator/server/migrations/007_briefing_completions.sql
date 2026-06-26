-- Migration 007: Briefing Completions
-- Tracks when a user completes the pre-call briefing drills for a given module/persona.
-- Used for local completion tracking and to avoid duplicate LTI Outcomes submissions.

CREATE TABLE IF NOT EXISTS briefing_completions (
  id SERIAL PRIMARY KEY,
  external_user_id VARCHAR(255) NOT NULL,
  module_id VARCHAR(50) NOT NULL,
  persona_id VARCHAR(100) NOT NULL,
  score NUMERIC(5,2) DEFAULT 100.00,
  lti_outcome_synced BOOLEAN DEFAULT FALSE,
  lti_outcome_error TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (external_user_id, module_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_completions_user
  ON briefing_completions (external_user_id, module_id, persona_id);
