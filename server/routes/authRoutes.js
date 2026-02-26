/**
 * Auth routes: login, get profile, change password.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');
const requireAuth = require('../middleware/requireAuth');
const { loginLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, password_hash, first_name, last_name, nickname, role, must_change_password, is_active FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      await logAudit(null, 'login_failed', null, { username, reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await logAudit(user.id, 'login_failed', user.id, { reason: 'account_deactivated' });
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const valid = await auth.verifyPassword(password, user.password_hash);
    if (!valid) {
      await logAudit(user.id, 'login_failed', user.id, { reason: 'wrong_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Invalidate existing sessions (single session enforcement)
    await db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

    // Create new session
    const sessionHash = auth.generateSessionHash();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, sessionHash, expiresAt]
    );

    const token = auth.createToken(user.id, user.role, sessionHash);

    await logAudit(user.id, 'login', user.id, null);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        nickname: user.nickname,
        role: user.role,
        mustChangePassword: user.must_change_password
      }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns current user profile with rank.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, first_name, last_name, nickname, email, role,
              team_id, pathway_id, must_change_password
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get team name if assigned
    let teamName = null;
    if (user.team_id) {
      const team = await db.query('SELECT name FROM teams WHERE id = $1', [user.team_id]);
      if (team.rows.length > 0) teamName = team.rows[0].name;
    }

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      teamId: user.team_id,
      teamName,
      pathwayId: user.pathway_id,
      mustChangePassword: user.must_change_password
    });
  } catch (err) {
    console.error('[AUTH] Profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  const passwordError = auth.validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const valid = await auth.verifyPassword(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await auth.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
      [newHash, req.user.id]
    );

    await logAudit(req.user.id, 'password_changed', req.user.id, null);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[AUTH] Password change error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Write to audit log.
 */
async function logAudit(actorId, action, targetId, details) {
  try {
    await db.query(
      'INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, $2, $3, $4)',
      [actorId, action, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT] Log error:', err.message);
  }
}

module.exports = router;
module.exports.logAudit = logAudit;
