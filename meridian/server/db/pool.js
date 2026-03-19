const { Pool } = require('pg');
const config = require('../config');
const logger = require('../lib/logger');

const pool = new Pool({
    connectionString: config.db.connectionString,
    ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
});

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        logger.info('Database connected', { timestamp: result.rows[0].now });
        return true;
    } catch (err) {
        logger.error('Database connection failed', { error: err.message });
        return false;
    }
}

module.exports = { pool, testConnection };
