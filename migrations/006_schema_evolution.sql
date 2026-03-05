-- ============================================
-- Migration 006: Schema Evolution for Pathway Builder
-- Adds track + is_required columns, creates cms_games,
-- cms_chatbots, and audit_content_log tables.
-- ============================================

BEGIN;

-- ─── 1. Add track column to cms_modules ───
-- Tracks: 'onboarding' (green) or 'upskilling' (orange)
ALTER TABLE cms_modules
  ADD COLUMN IF NOT EXISTS track VARCHAR(20) DEFAULT 'onboarding';

-- Set Phase 1-3 modules as onboarding (initial state — all existing modules are onboarding)
UPDATE cms_modules SET track = 'onboarding' WHERE track IS NULL;

-- ─── 2. Add is_required column to pathway_modules ───
-- LD managers can mark individual modules as optional within a pathway
ALTER TABLE pathway_modules
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT TRUE;

-- ─── 3. Create cms_games table ───
-- Centralizes game metadata that was previously scattered across
-- cms_modules columns and hardcoded SKILL_MAP in game.js
CREATE TABLE IF NOT EXISTS cms_games (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  skill_area VARCHAR(60),
  icon VARCHAR(10) DEFAULT '🎮',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed existing 8 games from SKILL_MAP + seed_content_data
INSERT INTO cms_games (id, title, description, skill_area, icon) VALUES
  ('salesFloor', 'The Sales Floor', 'Walk through full 6-stage sales conversations with real prospects.', 'salesProcess', '🏪'),
  ('objectionBlitz', 'Objection Blitz', 'Handle real objections under pressure with a 15-second timer.', 'objectionHandling', '⚡'),
  ('territory', 'Territory & Pipeline', 'Make strategic territory and pipeline decisions under real conditions.', 'territoryMgmt', '🧭'),
  ('compIQ', 'Comp & Margin IQ', 'Test whether you really understand how your paycheck works.', 'compMargin', '💰'),
  ('productIQ', 'Product IQ Quiz', 'Test your product knowledge across the entire ROC suite.', 'productKnowledge', '📦'),
  ('featureFactory', 'Feature Factory', 'Sort product features into the right bin. Arrow keys to move!', 'productKnowledge', '🏭'),
  ('coachCorner', 'Coach''s Corner', 'Navigate real coaching conversations and prove you can absorb and apply feedback.', 'coaching', '🏋️'),
  ('certification', 'Certification Assessment', 'Comprehensive assessment pulling from all competency areas.', 'certification', '🏆')
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Create cms_chatbots table ───
-- Library of AI chatbot scenarios available for LD managers to assign to modules
CREATE TABLE IF NOT EXISTS cms_chatbots (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(60),
  icon VARCHAR(10) DEFAULT '🤖',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── 5. Create audit_content_log table ───
-- Tracks all CMS content changes (module edits, video additions, game assignments)
CREATE TABLE IF NOT EXISTS audit_content_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_content_entity ON audit_content_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_content_user ON audit_content_log(user_id);

COMMIT;
