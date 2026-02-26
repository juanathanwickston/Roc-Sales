-- ============================================
-- Migration 002: CMS Content Tables
-- Moves training content from hardcoded JS into
-- database for admin editing via CMS.
-- ============================================

-- Module definitions
CREATE TABLE IF NOT EXISTS cms_modules (
  id          VARCHAR(50) PRIMARY KEY,       -- e.g. 'm1', 'm2'
  phase       INT NOT NULL DEFAULT 1,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  icon        VARCHAR(10),                   -- emoji
  game_id     VARCHAR(50),                   -- maps to game engine in code
  game_title  VARCHAR(200),                  -- display name for game activity
  game_desc   TEXT,                          -- description shown on game card
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by  INT REFERENCES users(id),
  updated_at  TIMESTAMP DEFAULT NOW(),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Video playlist items (one module can have many videos)
CREATE TABLE IF NOT EXISTS cms_videos (
  id          SERIAL PRIMARY KEY,
  module_id   VARCHAR(50) NOT NULL REFERENCES cms_modules(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  url         TEXT,                          -- YouTube embed URL, NULL = "coming soon"
  description TEXT,
  icon        VARCHAR(10),                   -- emoji for playlist display
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Document sections (one module can have many sections)
CREATE TABLE IF NOT EXISTS cms_doc_sections (
  id          SERIAL PRIMARY KEY,
  module_id   VARCHAR(50) NOT NULL REFERENCES cms_modules(id) ON DELETE CASCADE,
  heading     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Apply / checklist items (one module can have many items)
CREATE TABLE IF NOT EXISTS cms_apply_items (
  id          SERIAL PRIMARY KEY,
  module_id   VARCHAR(50) NOT NULL REFERENCES cms_modules(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  item_type   VARCHAR(20) DEFAULT 'text',    -- 'text', 'chatbot', 'link'
  url         TEXT,                          -- for 'link' type
  icon        VARCHAR(10),                   -- emoji
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Quiz questions (pool-based: 'productIQ', 'compIQ', 'certification')
CREATE TABLE IF NOT EXISTS cms_quiz_questions (
  id              SERIAL PRIMARY KEY,
  pool            VARCHAR(30) NOT NULL,       -- pool name (maps to game engine)
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,             -- array of option strings
  correct_index   INT NOT NULL,               -- 0-based index into options
  explanation     TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cms_videos_module ON cms_videos(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_docs_module ON cms_doc_sections(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_apply_module ON cms_apply_items(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_quiz_pool ON cms_quiz_questions(pool, is_active);
