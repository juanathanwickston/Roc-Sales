module.exports = {
    create: `INSERT INTO sessions (daily_room_url, daily_room_name) VALUES ($1, $2) RETURNING *`,
    getById: `SELECT * FROM sessions WHERE id = $1`,
    updateStatus: `UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *`,
    end: `UPDATE sessions SET status = 'ended', ended_at = now(), duration_seconds = $1 WHERE id = $2 RETURNING *`
};
