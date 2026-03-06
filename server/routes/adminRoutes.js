/**
 * Admin routes: user CRUD, pathway CRUD, rep progress viewing.
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
 * Returns users with pathway assignments.
 * Superuser/LD Manager: all users. Manager: scoped to shared pathways.
 */
router.get('/users', async (req, res) => {
  try {
    let users;

    if (req.user.role === 'superuser' || req.user.role === 'ld_manager' || req.query.all === '1') {
      users = await db.query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.nickname, u.email,
                u.role, u.created_at, u.last_login, u.must_change_password
         FROM users u
         ORDER BY u.role, u.last_name`
      );
    } else {
      // Manager: only users who share a pathway with them
      users = await db.query(
        `SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, u.nickname, u.email,
                u.role, u.created_at, u.last_login, u.must_change_password
         FROM users u
         JOIN user_pathways up ON up.user_id = u.id
         WHERE up.pathway_id IN (SELECT pathway_id FROM user_pathways WHERE user_id = $1)
         ORDER BY u.last_name`,
        [req.user.id]
      );
    }

    // Batch-load pathway assignments for all returned users
    const userIds = users.rows.map(u => u.id);
    let pathwayMap = {};
    if (userIds.length > 0) {
      const pathways = await db.query(
        `SELECT up.user_id, p.id AS pathway_id, p.name AS pathway_name
         FROM user_pathways up
         JOIN pathways p ON p.id = up.pathway_id
         WHERE up.user_id = ANY($1)
         ORDER BY p.name`,
        [userIds]
      );
      pathways.rows.forEach(row => {
        if (!pathwayMap[row.user_id]) pathwayMap[row.user_id] = [];
        pathwayMap[row.user_id].push({ id: row.pathway_id, name: row.pathway_name });
      });
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
        pathways: pathwayMap[u.id] || [],
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
 * Body: { username, firstName, lastName, email, password, role, pathwayIds }
 * Creates a new user. Managers can only create reps. Superuser/LD Manager can create managers.
 */
router.post('/users', async (req, res) => {
  const { username, firstName, lastName, email, password, role, pathwayIds } = req.body;

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

  // Only superuser/ld_manager can create managers
  if (targetRole === 'manager' && !['superuser', 'ld_manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only superuser or LD Manager can create manager accounts' });
  }

  // Only superuser can create ld_manager accounts
  if (targetRole === 'ld_manager' && req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Only superuser can create LD Manager accounts' });
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

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO users (username, password_hash, first_name, last_name, email, role, must_change_password, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
         RETURNING id`,
        [
          username.toLowerCase().trim(),
          hash,
          firstName.trim(),
          lastName.trim(),
          email ? email.trim().substring(0, 255) : null,
          targetRole,
          req.user.id
        ]
      );

      const newUserId = result.rows[0].id;

      // Assign pathways via junction table
      if (Array.isArray(pathwayIds) && pathwayIds.length > 0) {
        for (const pid of pathwayIds) {
          await client.query(
            'INSERT INTO user_pathways (user_id, pathway_id) VALUES ($1, $2)',
            [newUserId, pid]
          );
        }
      }

      await client.query('COMMIT');

      await logAudit(req.user.id, 'user_created', newUserId, {
        username: username.toLowerCase().trim(),
        role: targetRole,
        pathwayIds
      });

      res.status(201).json({ id: newUserId, message: 'User created' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ADMIN] Create user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Body: { firstName, lastName, email, nickname, pathwayIds }
 */
router.put('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id);
  const { firstName, lastName, email, nickname, pathwayIds, role } = req.body;

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

    const fields = [];
    const values = [];
    let idx = 1;

    if (firstName !== undefined) { fields.push(`first_name = $${idx++}`); values.push(firstName.trim()); }
    if (lastName !== undefined) { fields.push(`last_name = $${idx++}`); values.push(lastName.trim()); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email ? email.trim() : null); }
    if (nickname !== undefined) { fields.push(`nickname = $${idx++}`); values.push(nickname ? nickname.trim() : null); }

    // Role changes: superuser + ld_manager, with safety guards
    if (role !== undefined) {
      const isSuperuser = req.user.role === 'superuser';
      const isLdManager = req.user.role === 'ld_manager';
      if (!isSuperuser && !isLdManager) {
        return res.status(403).json({ error: 'Only superuser or LD manager can change roles' });
      }
      if (target.rows[0].role === 'superuser') {
        return res.status(403).json({ error: 'Cannot change superuser role' });
      }
      if (targetId === req.user.id) {
        return res.status(403).json({ error: 'Cannot change your own role' });
      }
      // LD managers can set rep or manager. Superuser can also set ld_manager.
      const allowedRoles = isSuperuser ? ['rep', 'manager', 'ld_manager'] : ['rep', 'manager'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
      }
      fields.push(`role = $${idx++}`); values.push(role);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (fields.length > 0) {
      values.push(targetId);
      await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    // Update pathway assignments if provided
    if (Array.isArray(pathwayIds)) {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_pathways WHERE user_id = $1', [targetId]);
        for (const pid of pathwayIds) {
          await client.query(
            'INSERT INTO user_pathways (user_id, pathway_id) VALUES ($1, $2)',
            [targetId, pid]
          );
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    }

    await logAudit(req.user.id, 'user_updated', targetId, { fields: Object.keys(req.body) });

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('[ADMIN] Update user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Hard-deletes a user and cascades: sessions, user_pathways, progress, scores.
 * Guardrails: cannot delete self, superuser, or last admin.
 * LD Manager / Superuser only. Audit-logged.
 */
router.delete('/users/:id', requireRole('ld_manager'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  try {
    // Cannot delete yourself
    if (targetId === req.user.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    const target = await db.query('SELECT id, role, username, first_name, last_name FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete superuser
    if (target.rows[0].role === 'superuser') {
      return res.status(403).json({ error: 'Cannot delete superuser account' });
    }

    // Cannot delete if user is the last admin-level user
    if (['ld_manager', 'manager'].includes(target.rows[0].role)) {
      const adminCount = await db.query(
        "SELECT COUNT(*) as cnt FROM users WHERE role IN ('superuser', 'ld_manager', 'manager') AND id != $1",
        [targetId]
      );
      if (parseInt(adminCount.rows[0].cnt) === 0) {
        return res.status(403).json({ error: 'Cannot delete the last admin user' });
      }
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Cascade: remove related data
      await client.query('DELETE FROM sessions WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM user_pathways WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM progress WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM scores WHERE user_id = $1', [targetId]);

      // Delete user
      await client.query('DELETE FROM users WHERE id = $1', [targetId]);

      await client.query('COMMIT');

      await logAudit(req.user.id, 'user_deleted', targetId, {
        username: target.rows[0].username,
        name: `${target.rows[0].first_name} ${target.rows[0].last_name}`,
        role: target.rows[0].role
      });

      res.json({ message: 'User deleted' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ADMIN] Delete user error:', err.message);
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
      'SELECT id, first_name, last_name, nickname FROM users WHERE id = $1',
      [targetId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Manager pathway scoping — can only view users who share a pathway
    if (req.user.role === 'manager') {
      const shared = await db.query(
        `SELECT 1 FROM user_pathways up1
         JOIN user_pathways up2 ON up1.pathway_id = up2.pathway_id
         WHERE up1.user_id = $1 AND up2.user_id = $2
         LIMIT 1`,
        [req.user.id, targetId]
      );
      if (shared.rows.length === 0) {
        return res.status(403).json({ error: 'User is not on your pathway' });
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

// ─── PATHWAY MANAGEMENT (Superuser / LD Manager) ───

/**
 * GET /api/admin/pathways
 */
router.get('/pathways', async (req, res) => {
  try {
    const pathways = await db.query(
      `SELECT p.id, p.name, p.description, p.created_at,
              COUNT(DISTINCT up.user_id) FILTER (
                WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = up.user_id AND u.role = 'rep')
              ) AS rep_count
       FROM pathways p
       LEFT JOIN user_pathways up ON up.pathway_id = p.id
       GROUP BY p.id
       ORDER BY p.name`
    );

    res.json({ pathways: pathways.rows.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      repCount: parseInt(p.rep_count) || 0,
      createdAt: p.created_at
    }))});
  } catch (err) {
    console.error('[ADMIN] List pathways error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/pathways
 * Superuser / LD Manager only.
 * Body: { name, description }
 */
router.post('/pathways', requireRole('ld_manager'), async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Pathway name is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO pathways (name, description) VALUES ($1, $2) RETURNING id',
      [name.trim(), description || null]
    );

    await logAudit(req.user.id, 'pathway_created', result.rows[0].id, { name: name.trim() });

    res.status(201).json({ id: result.rows[0].id, message: 'Pathway created' });
  } catch (err) {
    console.error('[ADMIN] Create pathway error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/pathways/:id
 * Superuser / LD Manager only.
 * Body: { name, description }
 */
router.put('/pathways/:id', requireRole('ld_manager'), async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  const { name, description } = req.body;

  if (isNaN(pathwayId) || !name || !name.trim()) {
    return res.status(400).json({ error: 'Valid pathway ID and name are required' });
  }

  try {
    const result = await db.query(
      'UPDATE pathways SET name = $1, description = $2 WHERE id = $3 RETURNING id',
      [name.trim(), description || null, pathwayId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pathway not found' });
    }

    res.json({ message: 'Pathway updated' });
    await logAudit(req.user.id, 'pathway_updated', pathwayId, { name: name.trim() });
  } catch (err) {
    console.error('[ADMIN] Update pathway error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/user-pathways
 * Superuser / LD Manager only.
 * Body: { userId, pathwayIds: [1, 2, 3] }
 */
router.put('/user-pathways', requireRole('ld_manager'), async (req, res) => {
  const { userId, pathwayIds } = req.body;

  if (!userId || !Array.isArray(pathwayIds)) {
    return res.status(400).json({ error: 'userId and pathwayIds array are required' });
  }

  try {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_pathways WHERE user_id = $1', [userId]);

      for (const pathwayId of pathwayIds) {
        await client.query(
          'INSERT INTO user_pathways (user_id, pathway_id) VALUES ($1, $2)',
          [userId, pathwayId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'user_pathways_updated', userId, { pathwayIds });

    res.json({ message: 'User pathway assignments updated' });
  } catch (err) {
    console.error('[ADMIN] User pathways error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATHWAY MODULE MANAGEMENT ───

/**
 * GET /api/admin/pathways/:id/modules
 * Returns assigned modules (ordered) and available modules for pathway builder.
 * LD Manager / Superuser only.
 */
router.get('/pathways/:id/modules', requireRole('ld_manager'), async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  if (isNaN(pathwayId)) {
    return res.status(400).json({ error: 'Valid pathway ID is required' });
  }

  try {
    // Verify pathway exists
    const pathway = await db.query('SELECT id, name FROM pathways WHERE id = $1', [pathwayId]);
    if (pathway.rows.length === 0) {
      return res.status(404).json({ error: 'Pathway not found' });
    }

    // Assigned courses — ordered by sort_order
    const assigned = await db.query(
      `SELECT c.id, c.title, c.description, c.icon, pc.sort_order AS sort_order, pc.is_required,
        (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) AS module_count
       FROM pathway_courses pc
       JOIN courses c ON c.id = pc.course_id
       WHERE pc.pathway_id = $1
       ORDER BY pc.sort_order`,
      [pathwayId]
    );

    // Available courses — courses NOT assigned to this pathway
    const available = await db.query(
      `SELECT c.id, c.title, c.description, c.icon,
        (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) AS module_count
       FROM courses c
       WHERE c.id NOT IN (SELECT course_id FROM pathway_courses WHERE pathway_id = $1)
       ORDER BY c.title`,
      [pathwayId]
    );

    res.json({
      pathwayId,
      pathwayName: pathway.rows[0].name,
      assigned: assigned.rows.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sort_order,
        isRequired: c.is_required !== false,
        moduleCount: parseInt(c.module_count)
      })),
      available: available.rows.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        icon: c.icon,
        moduleCount: parseInt(c.module_count)
      }))
    });
  } catch (err) {
    console.error('[ADMIN] Get pathway modules error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/pathways/:id/modules
 * Replace all module assignments for a pathway.
 * Body: { modules: [{id:'m1', isRequired:true}, {id:'m3', isRequired:false}] }
 *   OR: { moduleIds: ['m1', 'm3', 'm5'] } (backwards compat — all required)
 * Array order = sort_order.
 * LD Manager / Superuser only. Transactional + audit-logged.
 */
router.put('/pathways/:id/modules', requireRole('ld_manager'), async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  const { moduleIds, modules } = req.body;

  // Support both old format (string array) and new format (object array)
  let moduleEntries;
  if (Array.isArray(modules)) {
    moduleEntries = modules.map(m => ({ id: m.id, isRequired: m.isRequired !== false }));
  } else if (Array.isArray(moduleIds)) {
    moduleEntries = moduleIds.map(id => ({ id, isRequired: true }));
  } else {
    return res.status(400).json({ error: 'modules (array of objects) or moduleIds (array of strings) is required' });
  }

  if (isNaN(pathwayId)) {
    return res.status(400).json({ error: 'Valid pathway ID is required' });
  }

  try {
    // Verify pathway exists
    const pathway = await db.query('SELECT id FROM pathways WHERE id = $1', [pathwayId]);
    if (pathway.rows.length === 0) {
      return res.status(404).json({ error: 'Pathway not found' });
    }

    // Validate all course IDs exist
    const entryIds = moduleEntries.map(e => e.id);
    if (entryIds.length > 0) {
      const valid = await db.query(
        'SELECT id FROM courses WHERE id = ANY($1)',
        [entryIds]
      );
      const validIds = new Set(valid.rows.map(r => r.id));
      const invalid = entryIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid course IDs: ${invalid.join(', ')}` });
      }
    }

    // Transaction: delete all → re-insert in order
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM pathway_courses WHERE pathway_id = $1', [pathwayId]);

      for (let i = 0; i < moduleEntries.length; i++) {
        await client.query(
          'INSERT INTO pathway_courses (pathway_id, course_id, sort_order, is_required) VALUES ($1, $2, $3, $4)',
          [pathwayId, moduleEntries[i].id, i, moduleEntries[i].isRequired !== false]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'pathway_courses_updated', pathwayId, { courseIds: entryIds });

    res.json({ message: 'Pathway courses updated' });
  } catch (err) {
    console.error('[ADMIN] Update pathway courses error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE PATHWAY ───

/**
 * DELETE /api/admin/pathways/:id
 * Hard-deletes a pathway and unassigns all users.
 * LD Manager / Superuser only. Audit-logged.
 */
router.delete('/pathways/:id', requireRole('ld_manager'), async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  if (isNaN(pathwayId)) {
    return res.status(400).json({ error: 'Valid pathway ID is required' });
  }

  try {
    const pathway = await db.query('SELECT id, name FROM pathways WHERE id = $1', [pathwayId]);
    if (pathway.rows.length === 0) {
      return res.status(404).json({ error: 'Pathway not found' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Unassign all users from this pathway
      const unassigned = await client.query(
        'DELETE FROM user_pathways WHERE pathway_id = $1 RETURNING user_id',
        [pathwayId]
      );

      // Remove course assignments
      await client.query('DELETE FROM pathway_courses WHERE pathway_id = $1', [pathwayId]);

      // Hard delete the pathway
      await client.query('DELETE FROM pathways WHERE id = $1', [pathwayId]);

      await client.query('COMMIT');

      await logAudit(req.user.id, 'pathway_deleted', pathwayId, {
        name: pathway.rows[0].name,
        usersUnassigned: unassigned.rows.length
      });

      res.json({
        message: 'Pathway deleted',
        usersUnassigned: unassigned.rows.length
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ADMIN] Delete pathway error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DUPLICATE PATHWAY ───

/**
 * POST /api/admin/pathways/:id/duplicate
 * Clones a pathway (name + " (Copy)", description) and copies all module assignments.
 * LD Manager / Superuser only. Audit-logged.
 */
router.post('/pathways/:id/duplicate', requireRole('ld_manager'), async (req, res) => {
  const sourceId = parseInt(req.params.id);
  if (isNaN(sourceId)) {
    return res.status(400).json({ error: 'Valid pathway ID is required' });
  }

  try {
    const source = await db.query('SELECT * FROM pathways WHERE id = $1', [sourceId]);
    if (source.rows.length === 0) {
      return res.status(404).json({ error: 'Source pathway not found' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Create new pathway
      const newPathway = await client.query(
        `INSERT INTO pathways (name, description)
         VALUES ($1, $2) RETURNING id, name`,
        [source.rows[0].name + ' (Copy)', source.rows[0].description]
      );
      const newId = newPathway.rows[0].id;

      // Copy course assignments (including is_required)
      await client.query(
        `INSERT INTO pathway_courses (pathway_id, course_id, sort_order, is_required)
         SELECT $1, course_id, sort_order, is_required
         FROM pathway_courses WHERE pathway_id = $2`,
        [newId, sourceId]
      );

      await client.query('COMMIT');

      await logAudit(req.user.id, 'pathway_duplicated', newId, {
        sourceId,
        sourceName: source.rows[0].name,
        newName: newPathway.rows[0].name
      });

      res.status(201).json({
        id: newId,
        name: newPathway.rows[0].name,
        message: 'Pathway duplicated'
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ADMIN] Duplicate pathway error:', err.message);
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

// ─── PATHWAY PROGRESS VIEW ───

/**
 * GET /api/admin/pathways/:id/progress
 * Returns per-user completion data for a pathway.
 * Manager: scoped to shared pathways. LD Manager+: all.
 */
router.get('/pathways/:id/progress', async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  if (isNaN(pathwayId)) {
    return res.status(400).json({ error: 'Valid pathway ID is required' });
  }

  try {
    // Verify pathway exists
    const pathway = await db.query('SELECT id, name FROM pathways WHERE id = $1', [pathwayId]);
    if (pathway.rows.length === 0) {
      return res.status(404).json({ error: 'Pathway not found' });
    }

    // Manager scoping: must share this pathway
    if (req.user.role === 'manager') {
      const shared = await db.query(
        'SELECT 1 FROM user_pathways WHERE user_id = $1 AND pathway_id = $2 LIMIT 1',
        [req.user.id, pathwayId]
      );
      if (shared.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized for this pathway' });
      }
    }

    // Get required modules in this pathway (through courses)
    const reqMods = await db.query(
      `SELECT DISTINCT com.module_id, cm.title
       FROM pathway_courses pc
       JOIN course_modules com ON com.course_id = pc.course_id
       JOIN cms_modules cm ON cm.id = com.module_id
       WHERE pc.pathway_id = $1
         AND COALESCE(pc.is_required, TRUE) = TRUE
         AND COALESCE(com.is_required, TRUE) = TRUE
       ORDER BY cm.title`,
      [pathwayId]
    );
    const totalModules = reqMods.rows.length;

    // Get all users enrolled in this pathway
    const enrolled = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.nickname,
              up.assigned_at, up.started_at, up.completed_at
       FROM user_pathways up
       JOIN users u ON u.id = up.user_id
       WHERE up.pathway_id = $1
       ORDER BY u.last_name`,
      [pathwayId]
    );

    // Batch-load progress for all enrolled users
    const userIds = enrolled.rows.map(u => u.id);
    let progressMap = {};
    if (userIds.length > 0) {
      const prog = await db.query(
        `SELECT user_id, module_id, activity_type, status FROM progress
         WHERE user_id = ANY($1) AND status = 'done'`,
        [userIds]
      );
      prog.rows.forEach(r => {
        if (!progressMap[r.user_id]) progressMap[r.user_id] = {};
        if (!progressMap[r.user_id][r.module_id]) progressMap[r.user_id][r.module_id] = new Set();
        progressMap[r.user_id][r.module_id].add(r.activity_type);
      });
    }

    // Count completed modules per user (module = all assigned activities done)
    // For simplicity, a module is "complete" if at least one activity is marked done
    // (matching the frontend isModDone check)
    const users = enrolled.rows.map(u => {
      const userProg = progressMap[u.id] || {};
      let modulesComplete = 0;
      for (const rm of reqMods.rows) {
        if (userProg[rm.module_id] && userProg[rm.module_id].size > 0) {
          // Count as complete if all assigned activities done (simplified: has any done)
          modulesComplete++;
        }
      }
      return {
        userId: u.id,
        name: u.nickname || (u.first_name + ' ' + u.last_name),
        modulesComplete,
        totalModules,
        pct: totalModules > 0 ? Math.round(modulesComplete / totalModules * 100) : 0,
        startedAt: u.started_at || u.assigned_at,
        completedAt: u.completed_at
      };
    });

    const completedUsers = users.filter(u => u.completedAt !== null).length;

    res.json({
      pathway: { id: pathwayId, name: pathway.rows[0].name, totalModules },
      users,
      summary: { totalUsers: users.length, completedUsers }
    });
  } catch (err) {
    console.error('[ADMIN] Pathway progress error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── FORCE UNLOCK MODULE ───

/**
 * POST /api/admin/progress/force-unlock
 * Body: { userId, moduleId }
 * LD Manager+ only. Marks all activities as done for a user's module.
 * Audit-logged per security standards.
 */
router.post('/progress/force-unlock', requireRole('ld_manager'), async (req, res) => {
  const { userId, moduleId } = req.body;

  if (!userId || !moduleId) {
    return res.status(400).json({ error: 'userId and moduleId are required' });
  }

  const targetId = parseInt(userId);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Verify user exists
    const user = await db.query('SELECT id, first_name, last_name FROM users WHERE id = $1', [targetId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify module exists and get its activities
    const mod = await db.query(
      `SELECT id,
        (SELECT COUNT(*) FROM cms_videos WHERE module_id = cm.id) > 0 AS has_video,
        (SELECT COUNT(*) FROM cms_doc_sections WHERE module_id = cm.id) > 0 AS has_doc,
        game_id IS NOT NULL AS has_game,
        (SELECT COUNT(*) FROM cms_apply_items WHERE module_id = cm.id) > 0 AS has_apply
      FROM cms_modules cm WHERE cm.id = $1`,
      [moduleId]
    );
    if (mod.rows.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const m = mod.rows[0];
    const activities = [];
    if (m.has_video) activities.push('video');
    if (m.has_doc) activities.push('doc');
    if (m.has_game) activities.push('game');
    if (m.has_apply) activities.push('apply');

    // Mark all activities as done
    for (const actType of activities) {
      await db.query(
        `INSERT INTO progress (user_id, module_id, activity_type, status, completed_at)
         VALUES ($1, $2, $3, 'done', NOW())
         ON CONFLICT (user_id, module_id, activity_type)
         DO UPDATE SET status = 'done', completed_at = NOW()`,
        [targetId, moduleId, actType]
      );
    }

    await logAudit(req.user.id, 'module_force_unlocked', targetId, {
      moduleId,
      activitiesMarked: activities
    });

    res.json({ message: 'Module force-unlocked', activitiesMarked: activities.length });
  } catch (err) {
    console.error('[ADMIN] Force unlock error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
