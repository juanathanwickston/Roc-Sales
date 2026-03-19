module.exports = {
    insert: `INSERT INTO transcripts (session_id, role, content, turn_number)
             VALUES ($1, $2, $3, $4) RETURNING *`,
    getBySession: `SELECT * FROM transcripts WHERE session_id = $1
                   ORDER BY turn_number ASC`
};
