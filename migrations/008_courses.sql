-- ============================================
-- Migration 008: Courses Layer
-- Why: Add courses as a grouping entity between
--      pathways and modules. Pathways contain courses,
--      courses contain modules.
-- Rollback: DROP TABLE course_modules, pathway_courses, courses;
-- ============================================

-- ─── 1. Create courses table ───
CREATE TABLE IF NOT EXISTS courses (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  icon        VARCHAR(10) DEFAULT '📘',
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── 2. Create pathway_courses junction ───
-- Links pathways to courses (replaces pathway_modules)
CREATE TABLE IF NOT EXISTS pathway_courses (
  pathway_id  INT REFERENCES pathways(id) ON DELETE CASCADE,
  course_id   INT REFERENCES courses(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (pathway_id, course_id)
);

-- ─── 3. Create course_modules junction ───
-- Links courses to modules (modules can appear in multiple courses)
CREATE TABLE IF NOT EXISTS course_modules (
  course_id   INT REFERENCES courses(id) ON DELETE CASCADE,
  module_id   VARCHAR(50) REFERENCES cms_modules(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (course_id, module_id)
);

-- ─── 4. Indexes for common queries ───
CREATE INDEX IF NOT EXISTS idx_pathway_courses_pathway ON pathway_courses(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_courses_course ON pathway_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_module ON course_modules(module_id);

-- ─── 5. Data migration: pathway_modules → courses + course_modules + pathway_courses ───
-- Strategy: For each pathway, group its modules by phase → create one course per phase.
-- Then map pathway → courses and courses → modules.

-- 5a. Create one course per distinct phase found in pathway_modules
INSERT INTO courses (title, description, icon)
SELECT
  CASE MIN(cm.phase)
    WHEN 1 THEN 'Foundation'
    WHEN 2 THEN 'Applied Skill'
    WHEN 3 THEN 'Performance Validation'
    ELSE 'Phase ' || MIN(cm.phase)
  END,
  CASE MIN(cm.phase)
    WHEN 1 THEN 'Build your product knowledge, understand your compensation, and master the sales process.'
    WHEN 2 THEN 'Handle objections, cross-sell effectively, and own your territory.'
    WHEN 3 THEN 'Prove your skills with full simulations, coaching, and final certification.'
    ELSE 'Auto-migrated from phase ' || MIN(cm.phase)
  END,
  CASE MIN(cm.phase)
    WHEN 1 THEN '🟢'
    WHEN 2 THEN '🟠'
    WHEN 3 THEN '🟡'
    ELSE '📘'
  END
FROM pathway_modules pm
JOIN cms_modules cm ON cm.id = pm.module_id
GROUP BY cm.phase
ORDER BY MIN(cm.phase);

-- 5b. Map courses → modules (course_modules junction)
-- Each module goes into the course matching its phase
INSERT INTO course_modules (course_id, module_id, sort_order, is_required)
SELECT DISTINCT
  c.id,
  pm.module_id,
  pm.sort_order,
  COALESCE(pm.is_required, TRUE)
FROM pathway_modules pm
JOIN cms_modules cm ON cm.id = pm.module_id
JOIN courses c ON c.title = CASE cm.phase
    WHEN 1 THEN 'Foundation'
    WHEN 2 THEN 'Applied Skill'
    WHEN 3 THEN 'Performance Validation'
    ELSE 'Phase ' || cm.phase
  END
ON CONFLICT DO NOTHING;

-- 5c. Map pathways → courses (pathway_courses junction)
-- Each pathway gets linked to all courses that contain its modules
INSERT INTO pathway_courses (pathway_id, course_id, sort_order, is_required)
SELECT DISTINCT
  pm.pathway_id,
  c.id,
  c.id - 1,  -- sort by course id (phase order)
  TRUE
FROM pathway_modules pm
JOIN cms_modules cm ON cm.id = pm.module_id
JOIN courses c ON c.title = CASE cm.phase
    WHEN 1 THEN 'Foundation'
    WHEN 2 THEN 'Applied Skill'
    WHEN 3 THEN 'Performance Validation'
    ELSE 'Phase ' || cm.phase
  END
ON CONFLICT DO NOTHING;

-- ─── 6. Keep pathway_modules for now (backward compat) ───
-- Will be dropped in a future migration after full verification.
-- DO NOT DROP pathway_modules YET.
