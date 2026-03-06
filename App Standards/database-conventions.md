# ROC Academy — Database Conventions

> Every table, column, index, and migration follows the same patterns. Schema drift is a bug.

---

## 1. Migration Standards

### File Naming
```
NNN_short_description.sql
```
- Sequential numbering: `001`, `002`, `003`
- Lowercase, underscore-separated
- Descriptive: `004_learning_pathways.sql`, not `004_update.sql`

### Migration Rules
- Every schema change requires a migration file — never modify the database directly
- Migrations are **additive** by default — prefer `ADD COLUMN`, `CREATE TABLE`
- Destructive changes require explicit `DROP` with a comment explaining why
- Migrations run in a transaction (`BEGIN`/`COMMIT`) — if any statement fails, nothing applies
- Always use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
- Test migration on a fresh database AND an existing database before deploying

### Migration Structure
```sql
-- ============================================
-- Migration NNN: Description of what changes
-- Why: Brief explanation of business reason
-- ============================================

-- New tables
CREATE TABLE IF NOT EXISTS ... ;

-- Column additions
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... ;

-- Data migrations (if needed)
UPDATE ... SET ... WHERE ... ;

-- New indexes
CREATE INDEX IF NOT EXISTS ... ;
```

### Rollback Considerations
- Every migration should have a mental rollback plan documented in comments
- `ADD COLUMN` → rollback is `DROP COLUMN`
- `CREATE TABLE` → rollback is `DROP TABLE`
- Data transforms → document the reverse transform
- Currently no automated rollback — manual intervention required

---

## 2. Table Naming

| Convention | Example |
|-----------|---------|
| Plural nouns | `users`, `learning_pathways`, `modules` |
| snake_case | `user_pathways`, `cms_doc_sections` |
| Junction tables | `{entity1}_{entity2}` — `user_pathways`, `pathway_modules` |
| CMS tables | Prefix with `cms_` — `cms_modules`, `cms_videos` |
| System tables | No prefix — `sessions`, `migrations`, `audit_log` |

---

## 3. Column Naming

| Convention | Example |
|-----------|---------|
| snake_case | `first_name`, `created_at`, `is_active` |
| Foreign keys | `{referenced_table_singular}_id` — `user_id`, `pathway_id` |
| Booleans | Prefix with `is_` or `has_` — `is_active`, `has_completed` |
| Timestamps | Suffix with `_at` — `created_at`, `updated_at`, `completed_at` |
| Counts | Suffix with `_count` — `attempt_count`, `module_count` |

### Column Order Convention
```sql
CREATE TABLE example (
  id SERIAL PRIMARY KEY,          -- 1. Primary key first
  -- 2. Foreign keys
  user_id INT REFERENCES users(id),
  pathway_id INT REFERENCES learning_pathways(id),
  -- 3. Core data columns
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- 4. Status/boolean columns
  is_active BOOLEAN DEFAULT TRUE,
  -- 5. Metadata columns
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. Data Types

| Use Case | Type | Why |
|----------|------|-----|
| Primary key | `SERIAL` | Auto-incrementing integer |
| Short strings (names, titles) | `VARCHAR(N)` | Enforce length limit |
| Long text (descriptions, bodies) | `TEXT` | No length limit needed |
| Module IDs (legacy) | `VARCHAR(50)` | Existing pattern: `'m1'`, `'m2'` |
| Booleans | `BOOLEAN` | Not `INT` or `VARCHAR` |
| Dates | `TIMESTAMP` | Always `TIMESTAMP`, never `DATE` or `VARCHAR` |
| Structured data | `JSONB` | Only when schema is truly dynamic (quiz options, audit details) |
| Money/scores | `INT` | Never `FLOAT` for scores — rounding errors |
| Percentages | `INT` or `NUMERIC(5,2)` | Store as 0-100, never 0.0-1.0 |

### When to Use JSONB vs. Normalized Tables
| Use JSONB | Use Normalized Table |
|-----------|---------------------|
| Quiz answer options (array of strings) | Users, pathways, modules |
| Audit log details (variable structure) | Scores, progress tracking |
| Config/settings (key-value pairs) | Any data you query/filter/sort by |
| Truly schema-less metadata | Any data with foreign key relationships |

> [!WARNING]
> **Never** store data in JSONB that you need to `WHERE`, `JOIN`, or `INDEX`. If you're querying into JSONB regularly, it should be its own column or table.

---

## 5. Constraints & Defaults

### Always Define
- `NOT NULL` on every column that should never be empty
- `DEFAULT` values for booleans (`DEFAULT TRUE/FALSE`), timestamps (`DEFAULT NOW()`), sort orders (`DEFAULT 0`)
- `CHECK` constraints for enumerated values (roles, status, types)
- `UNIQUE` constraints for natural keys (username, email if required)
- `REFERENCES` for every foreign key (with `ON DELETE` behavior)

### ON DELETE Behavior
| Relationship | Strategy | Example |
|-------------|----------|---------|
| User owns sessions | `CASCADE` | Deleting user deletes their sessions |
| User has progress | `CASCADE` | Deleting user deletes their progress |
| Pathway has modules | `CASCADE` | Deleting pathway removes module associations |
| User belongs to pathway | `CASCADE` on junction | Removing user from pathway via junction |
| User created by admin | `SET NULL` | Deleting admin doesn't delete users they created |
| Module references creator | `SET NULL` | Creator deactivated, module persists |

---

## 6. Indexing Strategy

### Always Index
- Foreign keys used in `JOIN` conditions
- Columns used in `WHERE` filters
- Columns used in `ORDER BY`
- Composite columns used together in queries

### Index Naming
```sql
CREATE INDEX IF NOT EXISTS idx_{table}_{columns} ON {table}({columns});

-- Examples
CREATE INDEX IF NOT EXISTS idx_user_pathways_user ON user_pathways(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pathways_pathway ON user_pathways(pathway_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_module ON progress(user_id, module_id);
```

### Don't Over-Index
- Don't index boolean columns alone (low cardinality)
- Don't index TEXT columns (use full-text search if needed)
- Don't index columns only used in rare admin queries
- Every index slows down writes — only index what's queried frequently

---

## 7. Query Patterns

### Parameterized Queries Only
```javascript
// ✅ Always
await db.query('SELECT * FROM users WHERE id = $1 AND role = $2', [id, role]);

// ❌ Never
await db.query(`SELECT * FROM users WHERE id = ${id}`);
```

### Transaction Pattern (Multi-Step Operations)
```javascript
const client = await db.getClient();
try {
  await client.query('BEGIN');
  
  // Step 1
  const pathway = await client.query(
    'INSERT INTO learning_pathways (name) VALUES ($1) RETURNING id', [name]
  );
  
  // Step 2 — depends on step 1
  await client.query(
    'INSERT INTO user_pathways (user_id, pathway_id) VALUES ($1, $2)',
    [userId, pathway.rows[0].id]
  );
  
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### When to Use Transactions
- Creating resources with child records (pathway + modules)
- Deleting resources with cascade side effects
- Any operation that modifies 2+ tables
- Data migrations within a migration file
- Score submissions with progress updates

### Query Performance
- Use `EXPLAIN ANALYZE` on slow queries (>100ms)
- Avoid `SELECT *` — specify columns explicitly
- Use `LIMIT` on list queries (default 50)
- Avoid N+1 queries — batch load related data with `WHERE id IN (...)`

---

## 8. Soft Delete vs. Hard Delete

| Entity | Strategy | Reason |
|--------|----------|--------|
| Users | **Soft delete** (`is_active = FALSE`) | Audit trail, data retention, reactivation |
| Pathways | **Soft delete** (`is_active = FALSE`) | May contain historical progress data |
| Modules | **Soft delete** (`is_active = FALSE`) | Progress records reference module IDs |
| Sections (videos, docs) | **Hard delete** | No progress tracked at section level currently |
| Sessions | **Hard delete** | Ephemeral, no retention needed |
| Scores | **Never delete** | Audit trail, leaderboard integrity |
| Progress | **Never delete** | Learning history |
| Audit log | **Never delete** | Compliance |
