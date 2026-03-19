const { pool } = require('../db/pool');
const queries = require('../db/queries/sessions');
const daily = require('./daily');
const logger = require('../lib/logger');
const { NotFoundError } = require('../lib/errors');

async function create() {
    const room = await daily.createRoom();
    const token = await daily.generateToken(room.name);

    const result = await pool.query(queries.create, [room.url, room.name]);
    const session = result.rows[0];

    logger.info('Session created', {
        sessionId: session.id,
        roomName: room.name
    });

    return {
        id: session.id,
        roomUrl: room.url,
        token: token.token,
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

module.exports = { create, getById, end };
