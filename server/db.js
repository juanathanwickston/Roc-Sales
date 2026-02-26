/**
 * Database module for ROC Academy.
 * Manages Postgres connection pool and schema migrations.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL is not set. Server cannot start.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres uses self-signed certs — rejectUnauthorized:false is required.
  // This is safe because Railway's internal network is trusted.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 80));
  }
  return result;
}

/**
 * Get a client from the pool (for transactions).
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run schema migrations.
 * Reads numbered SQL files from migrations/ and applies them in order.
 * Tracks applied migrations in a migrations table.
 */
async function migrate() {
  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[DB] No migrations directory found. Skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await query('SELECT name FROM migrations');
  const appliedSet = new Set(applied.rows.map(r => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    console.log(`[DB] Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[DB] Applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[DB] Migration failed: ${file}`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Health check — verify DB connectivity.
 */
async function healthCheck() {
  try {
    const result = await query('SELECT NOW() AS time');
    return { status: 'connected', time: result.rows[0].time };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

module.exports = { query, getClient, migrate, healthCheck, pool };
