/**
 * Progress routes: get/save module progress, checklist items.
 * All endpoints scoped to authenticated user's own data.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const VALID_ACTIVITY_TYPES = ['video', 'doc', 'game', 'apply'];
const VALID_STATUSES = ['not_started', 'in_progress', 'done'];

/**
 * GET /api/progress
 * Returns all progress and checklist data for the authenticated user.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const progress = await db.query(
      'SELECT module_id, activity_type, status, completed_at FROM progress WHERE user_id = $1',
      [req.user.id]
    );

    const checklists = await db.query(
      'SELECT module_id, item_index, checked FROM checklist_items WHERE user_id = $1',
      [req.user.id]
    );

    // Transform into the D.modules shape for frontend compatibility
    const modules = {};
    for (const row of progress.rows) {
      if (!modules[row.module_id]) modules[row.module_id] = {};
      modules[row.module_id][row.activity_type] = row.status === 'done';
    }

    // Attach checklist items
    for (const row of checklists.rows) {
      if (!modules[row.module_id]) modules[row.module_id] = {};
      if (!modules[row.module_id].applyItems) modules[row.module_id].applyItems = {};
      modules[row.module_id].applyItems[row.item_index] = row.checked;
    }

    res.json({ modules });
  } catch (err) {
    console.error('[PROGRESS] Get error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/progress
 * Body: { moduleId, activityType, status }
 * Upserts a single module activity status.
 */
router.put('/', requireAuth, async (req, res) => {
  const { moduleId, activityType, status } = req.body;

  if (!moduleId || !activityType || !status) {
    return res.status(400).json({ error: 'moduleId, activityType, and status are required' });
  }

  if (!VALID_ACTIVITY_TYPES.includes(activityType)) {
    return res.status(400).json({ error: 'Invalid activity type' });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const completedAt = status === 'done' ? new Date() : null;

    await db.query(
      `INSERT INTO progress (user_id, module_id, activity_type, status, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, module_id, activity_type)
       DO UPDATE SET status = $4, completed_at = $5`,
      [req.user.id, moduleId, activityType, status, completedAt]
    );

    res.json({ message: 'Progress saved' });
  } catch (err) {
    console.error('[PROGRESS] Save error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/checklist
 * Body: { moduleId, itemIndex, checked }
 * Upserts a single checklist item.
 */
router.put('/checklist', requireAuth, async (req, res) => {
  const { moduleId, itemIndex, checked } = req.body;

  if (!moduleId || itemIndex === undefined || checked === undefined) {
    return res.status(400).json({ error: 'moduleId, itemIndex, and checked are required' });
  }

  if (typeof itemIndex !== 'number' || itemIndex < 0 || itemIndex > 50) {
    return res.status(400).json({ error: 'Invalid item index' });
  }

  try {
    await db.query(
      `INSERT INTO checklist_items (user_id, module_id, item_index, checked)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, module_id, item_index)
       DO UPDATE SET checked = $4`,
      [req.user.id, moduleId, itemIndex, !!checked]
    );

    res.json({ message: 'Checklist updated' });
  } catch (err) {
    console.error('[PROGRESS] Checklist error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
