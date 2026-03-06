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

    // ─── Auto Pathway Completion Check ───
    let pathwayCompleted = null;
    if (status === 'done') {
      // Get all pathways this user is enrolled in (not yet completed)
      const userPws = await db.query(
        'SELECT pathway_id FROM user_pathways WHERE user_id = $1 AND completed_at IS NULL',
        [req.user.id]
      );

      for (const pw of userPws.rows) {
        // Get required modules in this pathway (through courses)
        const reqMods = await db.query(
          `SELECT DISTINCT com.module_id FROM pathway_courses pc
           JOIN course_modules com ON com.course_id = pc.course_id
           WHERE pc.pathway_id = $1
             AND COALESCE(pc.is_required, TRUE) = TRUE
             AND COALESCE(com.is_required, TRUE) = TRUE`,
          [pw.pathway_id]
        );
        if (reqMods.rows.length === 0) continue;

        // Check if all required modules have all their assigned activities done
        let allDone = true;
        for (const rm of reqMods.rows) {
          // Get activities assigned to this module (from cms data)
          const modActivities = await db.query(
            `SELECT DISTINCT activity_type FROM progress WHERE user_id = $1 AND module_id = $2 AND status = 'done'`,
            [req.user.id, rm.module_id]
          );
          // Check module has required activities done
          const mod = await db.query(
            `SELECT id,
              (SELECT COUNT(*) FROM cms_videos WHERE module_id = cm.id) > 0 AS has_video,
              (SELECT COUNT(*) FROM cms_doc_sections WHERE module_id = cm.id) > 0 AS has_doc,
              game_id IS NOT NULL AS has_game,
              (SELECT COUNT(*) FROM cms_apply_items WHERE module_id = cm.id) > 0 AS has_apply
            FROM cms_modules cm WHERE cm.id = $1`,
            [rm.module_id]
          );
          if (mod.rows.length === 0) continue;
          const m = mod.rows[0];
          const doneTypes = modActivities.rows.map(r => r.activity_type);
          if (m.has_video && !doneTypes.includes('video')) { allDone = false; break; }
          if (m.has_doc && !doneTypes.includes('doc')) { allDone = false; break; }
          if (m.has_game && !doneTypes.includes('game')) { allDone = false; break; }
          if (m.has_apply && !doneTypes.includes('apply')) { allDone = false; break; }
        }

        if (allDone) {
          await db.query(
            'UPDATE user_pathways SET completed_at = NOW() WHERE user_id = $1 AND pathway_id = $2 AND completed_at IS NULL',
            [req.user.id, pw.pathway_id]
          );
          pathwayCompleted = pw.pathway_id;
        }
      }
    }

    res.json({ message: 'Progress saved', pathwayCompleted });
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
