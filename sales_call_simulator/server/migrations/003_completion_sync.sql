-- 002_completion_sync.sql
-- Tracks completion callback sync status between simulator and ROC Academy.
-- One row per session, logging whether the callback was sent and its outcome.

CREATE TABLE IF NOT EXISTS academy_completion_sync (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payload JSONB,
  response_status INTEGER,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One sync record per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_completion_sync_session_id
  ON academy_completion_sync (session_id);

-- Apply updated_at trigger
CREATE TRIGGER update_academy_completion_sync_updated_at
  BEFORE UPDATE ON academy_completion_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
