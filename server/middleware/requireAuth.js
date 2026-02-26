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

  // Verify session is still active (single session enforcement)
  const session = await db.query(
    'SELECT id FROM sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
    [payload.userId, payload.sessionHash]
  );

  if (session.rows.length === 0) {
    return res.status(401).json({ error: 'Session expired or invalidated' });
  }

  // Verify user is still active
  const user = await db.query(
    'SELECT id, role, must_change_password FROM users WHERE id = $1 AND is_active = TRUE',
    [payload.userId]
  );

  if (user.rows.length === 0) {
    return res.status(401).json({ error: 'Account deactivated' });
  }

  req.user = {
    id: payload.userId,
    role: user.rows[0].role,
    mustChangePassword: user.rows[0].must_change_password
  };

  next();
}

module.exports = requireAuth;
