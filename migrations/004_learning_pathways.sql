-- ============================================
-- Migration 004: Learning Pathways Foundation
-- Why: Consolidate teams → learning_pathways,
--      add user_pathways junction for multi-pathway,
--      add ld_manager role.
-- ============================================

BEGIN;

-- ─── 1. Add ld_manager to role constraint ───
-- Must drop and recreate the CHECK constraint.
-- Existing roles: superuser, manager, rep → add ld_manager

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superuser', 'ld_manager', 'manager', 'rep'));

-- ─── 2. Create user_pathways junction table ───
-- Replaces the single users.team_id + manager_teams setup.
-- Links any user (rep, manager, ld_manager) to one or more pathways.

CREATE TABLE IF NOT EXISTS user_pathways (
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  pathway_id INT REFERENCES pathways(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, pathway_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pathways_user ON user_pathways(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pathways_pathway ON user_pathways(pathway_id);

-- ─── 3. Migrate existing team_id assignments to user_pathways ───
-- Current model: users.team_id points to teams.id
-- The teams table is conceptually being replaced by pathways.
-- We need to map team_id → pathway_id.
--
-- Strategy: For each team, find or create a matching pathway,
-- then insert user_pathways rows.

-- 3a. Insert pathways for each team that doesn't already have a matching pathway
INSERT INTO pathways (name, description)
SELECT t.name, 'Migrated from team: ' || t.name
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM pathways p WHERE p.name = t.name
);

-- 3b. Migrate rep team assignments → user_pathways
-- Map users.team_id → teams.name → pathways.name → pathways.id
INSERT INTO user_pathways (user_id, pathway_id, assigned_at)
SELECT u.id, p.id, u.created_at
FROM users u
JOIN teams t ON u.team_id = t.id
JOIN pathways p ON p.name = t.name
WHERE u.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_pathways up WHERE up.user_id = u.id AND up.pathway_id = p.id
  );

-- 3c. Migrate manager_teams → user_pathways
-- Managers assigned to teams now become managers assigned to pathways
INSERT INTO user_pathways (user_id, pathway_id, assigned_at)
SELECT mt.manager_id, p.id, NOW()
FROM manager_teams mt
JOIN teams t ON mt.team_id = t.id
JOIN pathways p ON p.name = t.name
WHERE NOT EXISTS (
  SELECT 1 FROM user_pathways up WHERE up.user_id = mt.manager_id AND up.pathway_id = p.id
);

-- ─── 4. Add description to teams if not exists (backward compat) ───
-- We keep the teams table for now but stop using it in new code.
-- It will be dropped in a future migration after verification.

-- ─── 5. Drop the old idx_users_team index ───
-- We'll stop querying by team_id, the junction replaces it.
DROP INDEX IF EXISTS idx_users_team;

COMMIT;
