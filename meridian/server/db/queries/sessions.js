module.exports = {
    create: `INSERT INTO sessions (status) VALUES ('waiting') RETURNING *`,
    getById: `SELECT * FROM sessions WHERE id = $1`,
    updateStatus: `UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *`,
    start: `UPDATE sessions SET status = 'active', started_at = now() WHERE id = $1 RETURNING *`,
    end: `UPDATE sessions SET status = 'ended', ended_at = now(), duration_seconds = $1 WHERE id = $2 RETURNING *`
};
