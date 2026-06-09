/**
 * Database module for the Sales Call Simulator.
 * Manages Postgres connection pool and schema migrations.
 * Adapted from ROC Academy's db.js with graceful degradation
 * for local development without a database.
 */

const fs = require('fs');
const path = require('path');

const { Pool } = require('pg');

const { config } = require('./config');
const logger = require('./utils/logger');

// Connection pool timeout in milliseconds
const CONNECTION_TIMEOUT_MS = 5000;

// Idle connection timeout in milliseconds
const IDLE_TIMEOUT_MS = 30000;

// Maximum connections in the pool
const MAX_POOL_SIZE = 10;

// Slow query warning threshold in milliseconds
const SLOW_QUERY_THRESHOLD_MS = 1000;

// Track whether the database is available
let dbAvailable = false;
let pool = null;

if (config.DATABASE_URL) {
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    // Railway Postgres uses self-signed certs
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
  });
}

/**
 * Execute a parameterized query.
 * Returns the query result from pg.
 * Logs a warning for queries exceeding the slow threshold.
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('Database is not configured');
  }

  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn('Slow query detected', { durationMs: duration, query: text.substring(0, 80) });
  }

  return result;
}

/**
 * Get a client from the pool for transactions.
 * Caller must call client.release() when done.
 */
async function getClient() {
  if (!pool) {
    throw new Error('Database is not configured');
  }
  return pool.connect();
}

/**
 * Run schema migrations from server/migrations/ directory.
 * Reads numbered SQL files and applies them in sorted order.
 * Tracks applied migrations in a migrations table.
 * Throws on failure to prevent server startup with partial schema.
 */
async function migrate() {
  if (!pool) {
    logger.warn('DATABASE_URL not set - skipping migrations');
    return;
  }

  // Create the migrations tracking table if it does not exist
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.info('No migrations directory found. Skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await query('SELECT name FROM migrations');
  const appliedSet = new Set(applied.rows.map(r => r.name));

  // Map renamed files to old names to prevent double-runs
  const MIGRATION_ALIASES = {
    '003_completion_sync.sql': ['002_completion_sync.sql'],
    '004_perception_analysis.sql': ['003_perception_analysis.sql'],
    '005_module_tracking.sql': ['004_module_tracking.sql'],
  };

  const isApplied = (file) => {
    if (appliedSet.has(file)) return true;
    const aliases = MIGRATION_ALIASES[file] || [];
    for (const alias of aliases) {
      if (appliedSet.has(alias)) return true;
    }
    return false;
  };

  for (const file of files) {
    if (isApplied(file)) continue;

    logger.info('Applying database migration', { file });
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info('Database migration applied', { file });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Database migration failed', { file, error: err.message });
      throw err;
    } finally {
      client.release();
    }
  }

  dbAvailable = true;
}

/**
 * Check database connectivity.
 * Returns an object with status and connection time.
 */
async function healthCheck() {
  if (!pool) {
    return { status: 'not_configured' };
  }

  try {
    const result = await query('SELECT NOW() AS time');
    return { status: 'connected', time: result.rows[0].time };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Check whether the database is available and migrated.
 */
function isAvailable() {
  return dbAvailable;
}

module.exports = { query, getClient, migrate, healthCheck, isAvailable, pool };
