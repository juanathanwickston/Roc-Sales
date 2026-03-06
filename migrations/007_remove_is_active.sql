-- Migration 007: Remove is_active columns
-- Part of deactivate-to-delete migration
-- All entities now use hard DELETE instead of soft-delete via is_active flag

-- Drop is_active from users
ALTER TABLE users DROP COLUMN IF EXISTS is_active;

-- Drop is_active from pathways
ALTER TABLE pathways DROP COLUMN IF EXISTS is_active;

-- Drop is_active from cms_modules
ALTER TABLE cms_modules DROP COLUMN IF EXISTS is_active;

-- Drop is_active from cms_quiz_questions (also drop index that references it)
DROP INDEX IF EXISTS idx_cms_quiz_pool;
ALTER TABLE cms_quiz_questions DROP COLUMN IF EXISTS is_active;
-- Recreate index without is_active
CREATE INDEX IF NOT EXISTS idx_cms_quiz_pool ON cms_quiz_questions(pool);

-- Drop is_active from cms_games
ALTER TABLE cms_games DROP COLUMN IF EXISTS is_active;

-- Drop is_active from cms_chatbots
ALTER TABLE cms_chatbots DROP COLUMN IF EXISTS is_active;
