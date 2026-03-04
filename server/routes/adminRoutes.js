/**
 * Admin routes: user CRUD, team CRUD, rep progress viewing.
 * All endpoints require manager or superuser role.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../auth');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { logAudit } = require('./authRoutes');

// All admin routes require authentication and manager+ role
router.use(requireAuth);
router.use(requireRole('manager'));

// ─── USER MANAGEMENT ───

/**
 * GET /api/admin/users
 * Returns users scoped by manager's teams (or all for superuser).
 * Query: ?all=1 (managers can toggle to see all reps)
 */
router.get('/users', async (req, res) => {
  try {
    let users;

    if (req.user.role === 'superuser' || req.query.all === '1') {
      users = await db.query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.nickname, u.email,
                u.role, u.team_id, t.name AS team_name, u.is_active, u.created_at,
                u.last_login, u.must_change_password
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
         ORDER BY u.role, u.last_name`
      );
    } else {
      // Manager: only users on their teams
      users = await db.query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.nickname, u.email,
                u.role, u.team_id, t.name AS team_name, u.is_active, u.created_at,
                u.last_login, u.must_change_password
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
         WHERE u.team_id IN (SELECT team_id FROM manager_teams WHERE manager_id = $1)
         ORDER BY u.last_name`,
        [req.user.id]
      );
    }

    res.json({
      users: users.rows.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        lastName: u.last_name,
        nickname: u.nickname,
        email: u.email,
        role: u.role,
        teamId: u.team_id,
        teamName: u.team_name,
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        mustChangePassword: u.must_change_password
      }))
    });
  } catch (err) {
    console.error('[ADMIN] List users error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users
 * Body: { username, firstName, lastName, email, password, role, teamId }
 * Creates a new user. Managers can only create reps. Superuser can create managers.
 */
router.post('/users', async (req, res) => {
  const { username, firstName, lastName, email, password, role, teamId } = req.body;

  if (!username || !firstName || !lastName || !password) {
    return res.status(400).json({ error: 'username, firstName, lastName, and password are required' });
  }

  const passwordError = auth.validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  // Email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const targetRole = role || 'rep';

  // Managers can only create reps
  if (req.user.role === 'manager' && targetRole !== 'rep') {
    return res.status(403).json({ error: 'Managers can only create rep accounts' });
  }

  // Only superuser can create managers
  if (targetRole === 'manager' && req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Only superuser can create manager accounts' });
  }

  // Cannot create superuser accounts
  if (targetRole === 'superuser') {
    return res.status(403).json({ error: 'Cannot create superuser accounts' });
  }

  try {
    // Check username uniqueness
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hash = await auth.hashPassword(password);

    const result = await db.query(
      `INSERT INTO users (username, password_hash, first_name, last_name, email, role, team_id, must_change_password, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
       RETURNING id`,
      [
        username.toLowerCase().trim(),
        hash,
        firstName.trim(),
        lastName.trim(),
        email ? email.trim().substring(0, 255) : null,
        targetRole,
        teamId || null,
        req.user.id
      ]
    );

    await logAudit(req.user.id, 'user_created', result.rows[0].id, {
      username: username.toLowerCase().trim(),
      role: targetRole
    });

    res.status(201).json({ id: result.rows[0].id, message: 'User created' });
  } catch (err) {
    console.error('[ADMIN] Create user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Body: { firstName, lastName, email, nickname, teamId, isActive }
 */
router.put('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id);
  const { firstName, lastName, email, nickname, teamId, isActive, role } = req.body;

  // Email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Verify target user exists and check permissions
    const target = await db.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Managers cannot edit managers or superusers
    if (req.user.role === 'manager' && target.rows[0].role !== 'rep') {
      return res.status(403).json({ error: 'Insufficient permissions to edit this user' });
    }

    // Prevent deactivating superuser
    if (target.rows[0].role === 'superuser' && isActive === false) {
      return res.status(403).json({ error: 'Cannot deactivate superuser' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (firstName !== undefined) { fields.push(`first_name = $${idx++}`); values.push(firstName.trim()); }
    if (lastName !== undefined) { fields.push(`last_name = $${idx++}`); values.push(lastName.trim()); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email ? email.trim() : null); }
    if (nickname !== undefined) { fields.push(`nickname = $${idx++}`); values.push(nickname ? nickname.trim() : null); }
    if (teamId !== undefined) { fields.push(`team_id = $${idx++}`); values.push(teamId || null); }
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(!!isActive); }

    // Role changes: superuser only, with safety guards
    if (role !== undefined) {
      if (req.user.role !== 'superuser') {
        return res.status(403).json({ error: 'Only superuser can change roles' });
      }
      if (target.rows[0].role === 'superuser') {
        return res.status(403).json({ error: 'Cannot change superuser role' });
      }
      if (targetId === req.user.id) {
        return res.status(403).json({ error: 'Cannot change your own role' });
      }
      if (!['rep', 'manager'].includes(role)) {
        return res.status(400).json({ error: 'Role must be rep or manager' });
      }
      fields.push(`role = $${idx++}`); values.push(role);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(targetId);
    await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    await logAudit(req.user.id, 'user_updated', targetId, { fields: Object.keys(req.body) });

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('[ADMIN] Update user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword }
 * Resets user password and sets must_change_password flag.
 */
router.post('/users/:id/reset-password', async (req, res) => {
  const targetId = parseInt(req.params.id);
  const { newPassword } = req.body;

  if (isNaN(targetId) || !newPassword) {
    return res.status(400).json({ error: 'Valid user ID and newPassword are required' });
  }

  const passwordError = auth.validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const target = await db.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Managers cannot reset manager/superuser passwords
    if (req.user.role === 'manager' && target.rows[0].role !== 'rep') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const hash = await auth.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2',
      [hash, targetId]
    );

    // Invalidate any active sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [targetId]);

    await logAudit(req.user.id, 'password_reset', targetId, null);

    res.json({ message: 'Password reset. User must change on next login.' });
  } catch (err) {
    console.error('[ADMIN] Reset password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users/:id/progress
 * Returns full progress detail for a specific user.
 */
router.get('/users/:id/progress', async (req, res) => {
  const targetId = parseInt(req.params.id);

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Verify target exists
    const target = await db.query(
      'SELECT id, first_name, last_name, nickname, team_id FROM users WHERE id = $1',
      [targetId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Manager team scoping
    if (req.user.role === 'manager') {
      const managed = await db.query(
        'SELECT team_id FROM manager_teams WHERE manager_id = $1',
        [req.user.id]
      );
      const teamIds = managed.rows.map(r => r.team_id);
      if (!teamIds.includes(target.rows[0].team_id)) {
        return res.status(403).json({ error: 'User is not on your team' });
      }
    }

    const progress = await db.query(
      'SELECT module_id, activity_type, status, completed_at FROM progress WHERE user_id = $1',
      [targetId]
    );

    const scores = await db.query(
      'SELECT activity_type, activity_id, score, max_score, submitted_at FROM scores WHERE user_id = $1 ORDER BY submitted_at DESC',
      [targetId]
    );

    res.json({
      user: {
        id: target.rows[0].id,
        firstName: target.rows[0].first_name,
        lastName: target.rows[0].last_name,
        nickname: target.rows[0].nickname
      },
      progress: progress.rows,
      scores: scores.rows
    });
  } catch (err) {
    console.error('[ADMIN] View progress error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── TEAM MANAGEMENT (Superuser Only) ───

/**
 * GET /api/admin/teams
 */
router.get('/teams', async (req, res) => {
  try {
    const teams = await db.query(
      `SELECT t.id, t.name, t.created_at,
              COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = TRUE AND u.role = 'rep') AS rep_count
       FROM teams t
       LEFT JOIN users u ON u.team_id = t.id
       GROUP BY t.id
       ORDER BY t.name`
    );

    res.json({ teams: teams.rows.map(t => ({
      id: t.id,
      name: t.name,
      repCount: parseInt(t.rep_count) || 0,
      createdAt: t.created_at
    }))});
  } catch (err) {
    console.error('[ADMIN] List teams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/teams
 * Superuser only.
 * Body: { name }
 */
router.post('/teams', requireRole('superuser'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id',
      [name.trim(), req.user.id]
    );

    await logAudit(req.user.id, 'team_created', result.rows[0].id, { name: name.trim() });

    res.status(201).json({ id: result.rows[0].id, message: 'Team created' });
  } catch (err) {
    console.error('[ADMIN] Create team error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/teams/:id
 * Superuser only.
 * Body: { name }
 */
router.put('/teams/:id', requireRole('superuser'), async (req, res) => {
  const teamId = parseInt(req.params.id);
  const { name } = req.body;

  if (isNaN(teamId) || !name || !name.trim()) {
    return res.status(400).json({ error: 'Valid team ID and name are required' });
  }

  try {
    const result = await db.query(
      'UPDATE teams SET name = $1 WHERE id = $2 RETURNING id',
      [name.trim(), teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team updated' });
    await logAudit(req.user.id, 'team_updated', teamId, { name: name.trim() });
  } catch (err) {
    console.error('[ADMIN] Update team error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/manager-teams
 * Superuser only.
 * Body: { managerId, teamIds: [1, 2, 3] }
 */
router.put('/manager-teams', requireRole('superuser'), async (req, res) => {
  const { managerId, teamIds } = req.body;

  if (!managerId || !Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'managerId and teamIds array are required' });
  }

  try {
    // Verify target is a manager
    const target = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [managerId]
    );
    if (target.rows.length === 0 || target.rows[0].role !== 'manager') {
      return res.status(400).json({ error: 'Target user is not a manager' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM manager_teams WHERE manager_id = $1', [managerId]);

      for (const teamId of teamIds) {
        await client.query(
          'INSERT INTO manager_teams (manager_id, team_id) VALUES ($1, $2)',
          [managerId, teamId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'manager_teams_updated', managerId, { teamIds });

    res.json({ message: 'Manager team assignments updated' });
  } catch (err) {
    console.error('[ADMIN] Manager teams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── RESET SCORES / PROGRESS (superuser only) ───

/**
 * POST /api/admin/reset-scores
 * Truncates scores, progress, and checklist_items tables.
 * Superuser only. Audit-logged.
 */
router.post('/reset-scores', requireRole('superuser'), async (req, res) => {
  try {
    await db.query('TRUNCATE scores, progress, checklist_items');
    await logAudit(req.user.id, 'scores_reset', null, { action: 'full_reset' });
    console.log('[ADMIN] Scores/progress/checklists reset by user', req.user.id);
    res.json({ message: 'All scores, progress, and checklists have been reset' });
  } catch (err) {
    console.error('[ADMIN] Reset scores error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
