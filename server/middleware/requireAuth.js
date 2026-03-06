/**
 * JWT authentication middleware.
 * Validates token from Authorization header and checks active session.
 */

const { verifyToken } = require('../auth');
const db = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Combined session + user check (single query instead of two)
  const result = await db.query(
    `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.role, u.must_change_password
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()`,
    [payload.userId, payload.sessionHash]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Session expired or account no longer exists' });
  }

  const row = result.rows[0];

  // Sliding window: extend session if >50% through its 8hr lifetime
  const expiresAt = new Date(row.expires_at);
  const remainingMs = expiresAt.getTime() - Date.now();
  const halfWindow = 4 * 60 * 60 * 1000; // 4 hours
  if (remainingMs < halfWindow) {
    const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000);
    db.query('UPDATE sessions SET expires_at = $1 WHERE id = $2', [newExpiry, row.session_id])
      .catch(err => console.error('[AUTH] Session extend error:', err.message));
  }

  req.user = {
    id: payload.userId,
    role: row.role,
    mustChangePassword: row.must_change_password
  };

  next();
}

module.exports = requireAuth;
