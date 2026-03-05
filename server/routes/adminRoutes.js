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
                u.role, u.is_active, u.created_at, u.last_login, u.must_change_password
         FROM users u
         ORDER BY u.role, u.last_name`
      );
    } else {
      // Manager: only users who share a pathway with them
      users = await db.query(
        `SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, u.nickname, u.email,
                u.role, u.is_active, u.created_at, u.last_login, u.must_change_password
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
 * Body: { firstName, lastName, email, nickname, pathwayIds, isActive }
 */
router.put('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id);
  const { firstName, lastName, email, nickname, pathwayIds, isActive, role } = req.body;

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
    // Note: team_id is no longer used. Pathway assignment handled via junction table below.
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(!!isActive); }

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
      `SELECT p.id, p.name, p.description, p.is_active, p.created_at,
              COUNT(DISTINCT up.user_id) FILTER (
                WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = up.user_id AND u.is_active = TRUE AND u.role = 'rep')
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
      isActive: p.is_active,
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
 * Body: { name, description, isActive }
 */
router.put('/pathways/:id', requireRole('ld_manager'), async (req, res) => {
  const pathwayId = parseInt(req.params.id);
  const { name, description, isActive } = req.body;

  if (isNaN(pathwayId) || !name || !name.trim()) {
    return res.status(400).json({ error: 'Valid pathway ID and name are required' });
  }

  try {
    const result = await db.query(
      'UPDATE pathways SET name = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING id',
      [name.trim(), description || null, isActive !== false, pathwayId]
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

    // Assigned modules — ordered by sort_order
    const assigned = await db.query(
      `SELECT cm.id, cm.title, cm.icon, cm.phase, cm.track, pm.sort_order AS sort_order, pm.is_required
       FROM pathway_modules pm
       JOIN cms_modules cm ON cm.id = pm.module_id
       WHERE pm.pathway_id = $1
       ORDER BY pm.sort_order`,
      [pathwayId]
    );

    // Available modules — active modules NOT assigned to this pathway
    const available = await db.query(
      `SELECT cm.id, cm.title, cm.icon, cm.phase, cm.track
       FROM cms_modules cm
       WHERE cm.is_active = TRUE
         AND cm.id NOT IN (SELECT module_id FROM pathway_modules WHERE pathway_id = $1)
       ORDER BY cm.phase, cm.sort_order`,
      [pathwayId]
    );

    res.json({
      pathwayId,
      pathwayName: pathway.rows[0].name,
      assigned: assigned.rows.map(m => ({
        id: m.id,
        title: m.title,
        icon: m.icon,
        phase: m.phase,
        track: m.track || 'onboarding',
        sortOrder: m.sort_order,
        isRequired: m.is_required !== false
      })),
      available: available.rows.map(m => ({
        id: m.id,
        title: m.title,
        icon: m.icon,
        phase: m.phase,
        track: m.track || 'onboarding'
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

    // Validate all module IDs exist in cms_modules
    const entryIds = moduleEntries.map(e => e.id);
    if (entryIds.length > 0) {
      const valid = await db.query(
        'SELECT id FROM cms_modules WHERE id = ANY($1)',
        [entryIds]
      );
      const validIds = new Set(valid.rows.map(r => r.id));
      const invalid = entryIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid module IDs: ${invalid.join(', ')}` });
      }
    }

    // Transaction: delete all → re-insert in order
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM pathway_modules WHERE pathway_id = $1', [pathwayId]);

      for (let i = 0; i < moduleEntries.length; i++) {
        await client.query(
          'INSERT INTO pathway_modules (pathway_id, module_id, sort_order, is_required) VALUES ($1, $2, $3, $4)',
          [pathwayId, moduleEntries[i].id, i, moduleEntries[i].isRequired]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'pathway_modules_updated', pathwayId, { moduleIds });

    res.json({ message: 'Pathway modules updated' });
  } catch (err) {
    console.error('[ADMIN] Update pathway modules error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE (DEACTIVATE) PATHWAY ───

/**
 * DELETE /api/admin/pathways/:id
 * Soft-deletes a pathway (sets is_active = false) and hard-unassigns all users.
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

      // Hard unassign all users from this pathway
      const unassigned = await client.query(
        'DELETE FROM user_pathways WHERE pathway_id = $1 RETURNING user_id',
        [pathwayId]
      );

      // Soft delete the pathway
      await client.query(
        'UPDATE pathways SET is_active = FALSE WHERE id = $1',
        [pathwayId]
      );

      await client.query('COMMIT');

      await logAudit(req.user.id, 'pathway_deactivated', pathwayId, {
        name: pathway.rows[0].name,
        usersUnassigned: unassigned.rows.length
      });

      res.json({
        message: 'Pathway deactivated',
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
        `INSERT INTO pathways (name, description, is_active)
         VALUES ($1, $2, TRUE) RETURNING id, name`,
        [source.rows[0].name + ' (Copy)', source.rows[0].description]
      );
      const newId = newPathway.rows[0].id;

      // Copy module assignments (including is_required)
      await client.query(
        `INSERT INTO pathway_modules (pathway_id, module_id, sort_order, is_required)
         SELECT $1, module_id, sort_order, is_required
         FROM pathway_modules WHERE pathway_id = $2`,
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

module.exports = router;
