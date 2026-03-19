const { pool } = require('../db/pool');
const queries = require('../db/queries/sessions');
const logger = require('../lib/logger');
const { NotFoundError } = require('../lib/errors');

async function create() {
    const result = await pool.query(queries.create);
    const session = result.rows[0];

    logger.info('Session created', { sessionId: session.id });

    return {
        id: session.id,
        status: session.status,
        createdAt: session.created_at
    };
}

async function getById(id) {
    const result = await pool.query(queries.getById, [id]);
    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
}

async function start(id) {
    const session = await getById(id);
    if (!session) {
        throw new NotFoundError('Session not found');
    }

    const result = await pool.query(queries.start, [id]);

    logger.info('Session started', { sessionId: id });

    return result.rows[0];
}

async function end(id) {
    const session = await getById(id);
    if (!session) {
        throw new NotFoundError('Session not found');
    }

    let durationSeconds = null;
    if (session.started_at) {
        durationSeconds = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    }

    const result = await pool.query(queries.end, [durationSeconds, id]);

    logger.info('Session ended', {
        sessionId: id,
        durationSeconds
    });

    return result.rows[0];
}

module.exports = { create, getById, start, end };
