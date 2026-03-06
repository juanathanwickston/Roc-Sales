-- ============================================
-- Migration 005: Learning Path Enforcement
-- Why: Add tracking columns to user_pathways
--      for pathway completion detection.
-- ============================================

BEGIN;

-- 1. Track when user started a pathway (enrollment date)
ALTER TABLE user_pathways ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW();

-- 2. Track when user completed all required modules
ALTER TABLE user_pathways ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

COMMIT;
