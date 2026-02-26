-- ROC Academy: Initial Schema
-- Tables: users, teams, manager_teams, sessions, pathways, pathway_modules,
--         progress, scores, checklist_items, audit_log

-- Pathways (created first for FK reference)
CREATE TABLE IF NOT EXISTS pathways (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('superuser', 'manager', 'rep')),
  team_id INT REFERENCES teams(id) ON DELETE SET NULL,
  pathway_id INT REFERENCES pathways(id) ON DELETE SET NULL,
  must_change_password BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Manager-to-team assignments
CREATE TABLE IF NOT EXISTS manager_teams (
  manager_id INT REFERENCES users(id) ON DELETE CASCADE,
  team_id INT REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (manager_id, team_id)
);

-- Sessions (single session enforcement)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pathway-module mapping
CREATE TABLE IF NOT EXISTS pathway_modules (
  pathway_id INT REFERENCES pathways(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (pathway_id, module_id)
);

-- User progress per module activity
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('video', 'doc', 'game', 'apply')),
  status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
  completed_at TIMESTAMP,
  UNIQUE (user_id, module_id, activity_type)
);

-- Scores (quiz and game results)
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL,
  activity_id VARCHAR(50) NOT NULL,
  score INT NOT NULL,
  max_score INT NOT NULL,
  details JSONB,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Checklist items (Apply/Master section toggles)
CREATE TABLE IF NOT EXISTS checklist_items (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,
  item_index INT NOT NULL,
  checked BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, module_id, item_index)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_id INT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_activity ON scores(activity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Seed default pathway
INSERT INTO pathways (name, description)
VALUES ('New Rep Onboarding', '90-day sales ramp program for new representatives')
ON CONFLICT DO NOTHING;
