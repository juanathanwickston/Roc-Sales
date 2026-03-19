const router = require('express').Router();
const { pool } = require('../db/pool');

router.get('/', async (req, res) => {
    let dbStatus = 'connected';
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        dbStatus = 'disconnected';
    }

    const status = dbStatus === 'connected' ? 'ok' : 'error';
    const statusCode = dbStatus === 'connected' ? 200 : 503;

    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: dbStatus
    });
});

module.exports = router;
