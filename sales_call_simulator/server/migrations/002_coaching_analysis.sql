-- 002_coaching_analysis.sql
-- Add coaching_analysis JSONB column to session_scores for AI coaching narrative.
ALTER TABLE session_scores ADD COLUMN IF NOT EXISTS coaching_analysis JSONB;
