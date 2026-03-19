const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const TRACKING_TABLE = '_migrations';

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Create tracking table if it does not exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
                id SERIAL PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        // Get already-applied migrations
        const applied = await pool.query(`SELECT filename FROM ${TRACKING_TABLE} ORDER BY id`);
        const appliedSet = new Set(applied.rows.map(row => row.filename));

        // Read migration files in order
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        let count = 0;
        for (const file of files) {
            if (appliedSet.has(file)) {
                continue;
            }
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await pool.query(sql);
            await pool.query(
                `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`,
                [file]
            );
            console.log(`[migrate] Applied: ${file}`);
            count++;
        }

        if (count === 0) {
            console.log('[migrate] No new migrations to apply');
        } else {
            console.log(`[migrate] Applied ${count} migration(s)`);
        }
    } catch (err) {
        console.error(`[migrate] Migration failed: ${err.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
