/**
 * CMS Routes — CRUD for training content.
 *
 * Public:    GET /modules (full content tree for frontend)
 * Manager+:  All editing endpoints
 * Superuser: Create/delete modules
 *
 * All edits are audit-logged.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { verifyToken } = require('../auth');

// ─── PUBLIC: Full content tree (pathway-aware) ───

router.get('/modules', async (req, res) => {
  try {
    // Optional auth: if token present, identify user for pathway filtering
    let userId = null;
    let userRole = null;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const payload = verifyToken(header.slice(7));
      if (payload) {
        const userCheck = await db.query(
          'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
          [payload.userId]
        );
        if (userCheck.rows.length > 0) {
          userId = userCheck.rows[0].id;
          userRole = userCheck.rows[0].role;
        }
      }
    }

    // Determine if this user should see pathway-filtered modules
    let moduleFilter = '';
    let filterParams = [];

    if (userId && (userRole === 'rep' || userRole === 'manager')) {
      // Check if user has any pathway assignments
      const pathwayCheck = await db.query(
        'SELECT pathway_id FROM user_pathways WHERE user_id = $1', [userId]
      );

      if (pathwayCheck.rows.length > 0) {
        // User has pathways — only show modules assigned to those pathways
        const pathwayIds = pathwayCheck.rows.map(r => r.pathway_id);
        moduleFilter = `AND cm.id IN (
          SELECT module_id FROM pathway_modules WHERE pathway_id = ANY($1)
        )`;
        filterParams = [pathwayIds];
      }
    }
    // Superuser, ld_manager, unauthenticated, or users without pathways → all modules

    const modules = await db.query(
      `SELECT id, phase, title, description, icon, game_id, game_title, game_desc, sort_order
       FROM cms_modules cm WHERE cm.is_active = TRUE ${moduleFilter}
       ORDER BY sort_order, phase`,
      filterParams
    );

    // Batch-load all child data
    const [videos, docs, applyItems] = await Promise.all([
      db.query('SELECT id, module_id, title, url, description, icon, sort_order FROM cms_videos ORDER BY module_id, sort_order'),
      db.query('SELECT id, module_id, heading, body, sort_order FROM cms_doc_sections ORDER BY module_id, sort_order'),
      db.query('SELECT id, module_id, text, item_type, url, icon, sort_order FROM cms_apply_items ORDER BY module_id, sort_order')
    ]);

    // Group by module_id
    const videosByMod = groupBy(videos.rows, 'module_id');
    const docsByMod = groupBy(docs.rows, 'module_id');
    const applyByMod = groupBy(applyItems.rows, 'module_id');

    // Assemble content tree
    const result = modules.rows.map(m => ({
      id: m.id,
      phase: m.phase,
      title: m.title,
      desc: m.description,
      icon: m.icon,
      video: {
        title: (videosByMod[m.id] || []).length === 1
          ? videosByMod[m.id][0].title
          : m.title,
        playlist: (videosByMod[m.id] || []).length > 1
          ? (videosByMod[m.id] || []).map(v => ({
              title: v.title, icon: v.icon,
              url: v.url || '',
              desc: v.description || ''
            }))
          : undefined,
        url: (videosByMod[m.id] || []).length === 1
          ? (videosByMod[m.id][0].url || '')
          : undefined,
        desc: (videosByMod[m.id] || []).length === 1
          ? (videosByMod[m.id][0].description || '')
          : undefined
      },
      doc: {
        title: m.title,
        sections: (docsByMod[m.id] || []).map(d => ({
          h: d.heading,
          body: d.body
        }))
      },
      game: {
        title: m.game_title || m.title,
        gameId: m.game_id,
        desc: m.game_desc || ''
      },
      apply: {
        title: m.title,
        desc: m.description || '',
        items: (applyByMod[m.id] || []).map(a => {
          if (a.item_type === 'text') return a.text;
          return {
            text: a.text,
            type: a.item_type,
            url: a.url || undefined,
            icon: a.icon || undefined
          };
        })
      }
    }));

    res.json(result);
  } catch (err) {
    console.error('[CMS] Modules fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── QUIZZES ───

router.get('/quizzes', async (req, res) => {
  try {
    const { pool } = req.query;
    let result;
    if (pool) {
      result = await db.query(
        'SELECT id, pool, question, options, correct_index, explanation FROM cms_quiz_questions WHERE pool = $1 AND is_active = TRUE ORDER BY sort_order',
        [pool]
      );
    } else {
      result = await db.query(
        'SELECT id, pool, question, options, correct_index, explanation FROM cms_quiz_questions WHERE is_active = TRUE ORDER BY pool, sort_order'
      );
    }

    // Format to match game engine expectations: { q, opts[], c, exp }
    const formatted = result.rows.map(r => ({
      q: r.question,
      opts: r.options,
      c: r.correct_index,
      exp: r.explanation
    }));

    res.json(formatted);
  } catch (err) {
    console.error('[CMS] Quizzes fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════
// ADMIN ENDPOINTS (Manager+)
// ═══════════════════════════════════

// ─── MODULE CRUD ───

// Get single module with all children (for editing)
router.get('/modules/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const mod = await db.query('SELECT * FROM cms_modules WHERE id = $1', [req.params.id]);
    if (mod.rows.length === 0) return res.status(404).json({ error: 'Module not found' });

    const [videos, docs, applyItems] = await Promise.all([
      db.query('SELECT * FROM cms_videos WHERE module_id = $1 ORDER BY sort_order', [req.params.id]),
      db.query('SELECT * FROM cms_doc_sections WHERE module_id = $1 ORDER BY sort_order', [req.params.id]),
      db.query('SELECT * FROM cms_apply_items WHERE module_id = $1 ORDER BY sort_order', [req.params.id])
    ]);

    res.json({
      ...mod.rows[0],
      videos: videos.rows,
      docs: docs.rows,
      apply_items: applyItems.rows
    });
  } catch (err) {
    console.error('[CMS] Module fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update module metadata
router.put('/modules/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { title, description, icon, phase, game_id, game_title, game_desc, sort_order } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const result = await db.query(
      `UPDATE cms_modules SET title=$1, description=$2, icon=$3, phase=$4, game_id=$5, game_title=$6, game_desc=$7, sort_order=$8, updated_by=$9, updated_at=NOW()
       WHERE id = $10 RETURNING *`,
      [title.trim(), description, icon, phase, game_id, game_title, game_desc, sort_order, req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Module not found' });

    await auditLog(req.user.id, 'cms_module_update', null, { module_id: req.params.id, changes: req.body });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Module update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create module (superuser only)
router.post('/modules', requireAuth, requireRole('superuser'), async (req, res) => {
  const { id, title, description, icon, phase, game_id, game_title, game_desc } = req.body;
  if (!id || !title) return res.status(400).json({ error: 'ID and title are required' });
  if (!/^[a-z0-9_]+$/.test(id)) return res.status(400).json({ error: 'ID must be lowercase alphanumeric with underscores' });
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_modules');
    const result = await db.query(
      `INSERT INTO cms_modules (id, phase, title, description, icon, game_id, game_title, game_desc, sort_order, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, phase || 1, title.trim(), description, icon, game_id, game_title, game_desc, maxOrder.rows[0].next, req.user.id]
    );
    await auditLog(req.user.id, 'cms_module_create', null, { module_id: id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Module ID already exists' });
    console.error('[CMS] Module create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── VIDEO CRUD ───

router.post('/videos', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { module_id, title, url, description, icon } = req.body;
  if (!module_id || !title) return res.status(400).json({ error: 'module_id and title are required' });
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_videos WHERE module_id = $1', [module_id]);
    const result = await db.query(
      `INSERT INTO cms_videos (module_id, title, url, description, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [module_id, title.trim(), url || null, description, icon, maxOrder.rows[0].next]
    );
    await auditLog(req.user.id, 'cms_video_create', null, { module_id, video_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Video create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/videos/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { title, url, description, icon } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    const result = await db.query(
      'UPDATE cms_videos SET title=$1, url=$2, description=$3, icon=$4 WHERE id=$5 RETURNING *',
      [title.trim(), url || null, description, icon, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    await auditLog(req.user.id, 'cms_video_update', null, { video_id: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Video update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/videos/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    // Prevent deleting the last video
    const video = await db.query('SELECT module_id FROM cms_videos WHERE id = $1', [req.params.id]);
    if (video.rows.length === 0) return res.status(404).json({ error: 'Video not found' });

    const count = await db.query('SELECT COUNT(*) as cnt FROM cms_videos WHERE module_id = $1', [video.rows[0].module_id]);
    if (parseInt(count.rows[0].cnt) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last video. Every module must have at least one video.' });
    }

    await db.query('DELETE FROM cms_videos WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'cms_video_delete', null, { video_id: req.params.id, module_id: video.rows[0].module_id });
    res.json({ message: 'Video deleted' });
  } catch (err) {
    console.error('[CMS] Video delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DOC SECTION CRUD ───

router.post('/docs', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { module_id, heading, body } = req.body;
  if (!module_id || !heading || !body) return res.status(400).json({ error: 'module_id, heading, and body are required' });
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_doc_sections WHERE module_id = $1', [module_id]);
    const result = await db.query(
      'INSERT INTO cms_doc_sections (module_id, heading, body, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [module_id, heading.trim(), body, maxOrder.rows[0].next]
    );
    await auditLog(req.user.id, 'cms_doc_create', null, { module_id, doc_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Doc create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/docs/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { heading, body } = req.body;
  if (!heading || !body) return res.status(400).json({ error: 'Heading and body are required' });
  try {
    const result = await db.query(
      'UPDATE cms_doc_sections SET heading=$1, body=$2 WHERE id=$3 RETURNING *',
      [heading.trim(), body, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Doc section not found' });
    await auditLog(req.user.id, 'cms_doc_update', null, { doc_id: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Doc update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/docs/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const doc = await db.query('SELECT module_id FROM cms_doc_sections WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Doc section not found' });

    const count = await db.query('SELECT COUNT(*) as cnt FROM cms_doc_sections WHERE module_id = $1', [doc.rows[0].module_id]);
    if (parseInt(count.rows[0].cnt) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last doc section. Every module must have at least one.' });
    }

    await db.query('DELETE FROM cms_doc_sections WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'cms_doc_delete', null, { doc_id: req.params.id, module_id: doc.rows[0].module_id });
    res.json({ message: 'Doc section deleted' });
  } catch (err) {
    console.error('[CMS] Doc delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── APPLY ITEM CRUD ───

router.post('/apply-items', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { module_id, text, item_type, url, icon } = req.body;
  if (!module_id || !text) return res.status(400).json({ error: 'module_id and text are required' });
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_apply_items WHERE module_id = $1', [module_id]);
    const result = await db.query(
      'INSERT INTO cms_apply_items (module_id, text, item_type, url, icon, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [module_id, text.trim(), item_type || 'text', url || null, icon || null, maxOrder.rows[0].next]
    );
    await auditLog(req.user.id, 'cms_apply_create', null, { module_id, item_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Apply item create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/apply-items/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { text, item_type, url, icon } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const result = await db.query(
      'UPDATE cms_apply_items SET text=$1, item_type=$2, url=$3, icon=$4 WHERE id=$5 RETURNING *',
      [text.trim(), item_type || 'text', url || null, icon || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Apply item not found' });
    await auditLog(req.user.id, 'cms_apply_update', null, { item_id: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Apply item update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/apply-items/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const item = await db.query('SELECT module_id FROM cms_apply_items WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Apply item not found' });

    const count = await db.query('SELECT COUNT(*) as cnt FROM cms_apply_items WHERE module_id = $1', [item.rows[0].module_id]);
    if (parseInt(count.rows[0].cnt) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last apply item. Every module must have at least one.' });
    }

    await db.query('DELETE FROM cms_apply_items WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'cms_apply_delete', null, { item_id: req.params.id, module_id: item.rows[0].module_id });
    res.json({ message: 'Apply item deleted' });
  } catch (err) {
    console.error('[CMS] Apply item delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── QUIZ QUESTION CRUD ───

router.get('/quizzes/admin', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cms_quiz_questions ORDER BY pool, sort_order');
    res.json(result.rows);
  } catch (err) {
    console.error('[CMS] Quiz admin fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/quizzes', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { pool, question, options, correct_index, explanation } = req.body;
  if (!pool || !question || !options || correct_index === undefined || !explanation) {
    return res.status(400).json({ error: 'pool, question, options, correct_index, and explanation are required' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Options must be an array with at least 2 items' });
  }
  if (correct_index < 0 || correct_index >= options.length) {
    return res.status(400).json({ error: 'correct_index must be a valid index into options' });
  }
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_quiz_questions WHERE pool = $1', [pool]);
    const result = await db.query(
      'INSERT INTO cms_quiz_questions (pool, question, options, correct_index, explanation, sort_order) VALUES ($1, $2, $3::jsonb, $4, $5, $6) RETURNING *',
      [pool, question.trim(), JSON.stringify(options), correct_index, explanation, maxOrder.rows[0].next]
    );
    await auditLog(req.user.id, 'cms_quiz_create', null, { pool, question_id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Quiz create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/quizzes/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { question, options, correct_index, explanation } = req.body;
  if (!question || !options || correct_index === undefined || !explanation) {
    return res.status(400).json({ error: 'question, options, correct_index, and explanation are required' });
  }
  try {
    const result = await db.query(
      'UPDATE cms_quiz_questions SET question=$1, options=$2::jsonb, correct_index=$3, explanation=$4 WHERE id=$5 RETURNING *',
      [question.trim(), JSON.stringify(options), correct_index, explanation, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    await auditLog(req.user.id, 'cms_quiz_update', null, { question_id: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Quiz update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/quizzes/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const q = await db.query('SELECT pool FROM cms_quiz_questions WHERE id = $1', [req.params.id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Question not found' });

    // Prevent deleting if pool would have < 4 questions (minimum for quiz to work)
    const count = await db.query('SELECT COUNT(*) as cnt FROM cms_quiz_questions WHERE pool = $1 AND is_active = TRUE', [q.rows[0].pool]);
    if (parseInt(count.rows[0].cnt) <= 4) {
      return res.status(400).json({ error: 'Cannot delete. Quiz pool must have at least 4 questions.' });
    }

    await db.query('DELETE FROM cms_quiz_questions WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'cms_quiz_delete', null, { question_id: req.params.id, pool: q.rows[0].pool });
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error('[CMS] Quiz delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── REORDER ENDPOINTS ───

router.put('/reorder/:type', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { items } = req.body; // array of { id, sort_order }
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

  const tableMap = {
    videos: 'cms_videos',
    docs: 'cms_doc_sections',
    'apply-items': 'cms_apply_items',
    quizzes: 'cms_quiz_questions',
    modules: 'cms_modules'
  };
  const table = tableMap[req.params.type];
  if (!table) return res.status(400).json({ error: 'Invalid type. Use: videos, docs, apply-items, quizzes, modules' });

  try {
    for (const item of items) {
      const idCol = table === 'cms_modules' ? 'id' : 'id';
      await db.query(`UPDATE ${table} SET sort_order = $1 WHERE ${idCol} = $2`, [item.sort_order, item.id]);
    }
    await auditLog(req.user.id, `cms_reorder_${req.params.type}`, null, { count: items.length });
    res.json({ message: 'Reordered' });
  } catch (err) {
    console.error('[CMS] Reorder error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── HELPERS ───

function groupBy(rows, key) {
  const map = {};
  for (const row of rows) {
    const k = row[key];
    if (!map[k]) map[k] = [];
    map[k].push(row);
  }
  return map;
}

async function auditLog(actorId, action, targetId, details) {
  try {
    await db.query(
      'INSERT INTO audit_log (actor_id, action, target_id, details) VALUES ($1, $2, $3, $4)',
      [actorId, action, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    console.warn('[CMS] Audit log failed:', e.message);
  }
}

module.exports = router;
