-- ============================================
-- Migration 005: Seed pathway_modules
-- Seeds all active modules into all active pathways.
-- This ensures existing pathways show their modules
-- in the builder and that learner content is filtered
-- correctly by pathway.
-- ============================================

BEGIN;

-- Insert all active modules into each active pathway (if not already assigned)
INSERT INTO pathway_modules (pathway_id, module_id, sort_order)
SELECT p.id, cm.id, cm.sort_order
FROM pathways p
CROSS JOIN cms_modules cm
WHERE p.is_active = TRUE
  AND cm.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pathway_modules pm
    WHERE pm.pathway_id = p.id AND pm.module_id = cm.id
  )
ORDER BY p.id, cm.sort_order;

COMMIT;
