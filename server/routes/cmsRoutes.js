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

// ─── PUBLIC: Full content tree (pathway-aware, course-grouped) ───

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
          'SELECT id, role FROM users WHERE id = $1',
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
    let pathwayJoin = '';
    let pathwayCols = ', cm.sort_order AS pw_sort_order, TRUE AS is_required';
    let courseCols = '';
    let courseJoin = '';

    // Explicit pathway filter via query param (multi-pathway tab switching)
    const queryPathway = req.query.pathway ? parseInt(req.query.pathway) : null;
    if (queryPathway && !isNaN(queryPathway)) {
      // Join through pathway_courses → course_modules to get modules for this pathway
      pathwayJoin = `JOIN course_modules com ON com.module_id = cm.id
        JOIN pathway_courses pc ON pc.course_id = com.course_id AND pc.pathway_id = $1`;
      pathwayCols = ', com.sort_order AS pw_sort_order, COALESCE(com.is_required, TRUE) AS is_required';
      courseCols = ', pc.course_id, pc.sort_order AS course_sort_order, COALESCE(pc.is_required, TRUE) AS course_is_required';
      courseJoin = '';
      moduleFilter = '';
      filterParams = [queryPathway];
    } else if (userId && (userRole === 'rep' || userRole === 'manager')) {
      // Check if user has any pathway assignments
      const pathwayCheck = await db.query(
        'SELECT pathway_id FROM user_pathways WHERE user_id = $1', [userId]
      );

      if (pathwayCheck.rows.length > 0) {
        // User has pathways — only show modules assigned to those pathways via courses
        const pathwayIds = pathwayCheck.rows.map(r => r.pathway_id);
        moduleFilter = `AND cm.id IN (
          SELECT com.module_id FROM course_modules com
          JOIN pathway_courses pc ON pc.course_id = com.course_id
          WHERE pc.pathway_id = ANY($1)
        )`;
        filterParams = [pathwayIds];
      }
    }
    // Superuser, ld_manager, unauthenticated, or users without pathways → all modules

    const modules = await db.query(
      `SELECT cm.id, cm.phase, cm.title, cm.description, cm.icon, cm.game_id, cm.game_title, cm.game_desc, cm.sort_order, cm.track ${pathwayCols} ${courseCols}
       FROM cms_modules cm ${pathwayJoin} ${courseJoin} WHERE 1=1 ${moduleFilter}
       ORDER BY ${queryPathway ? 'course_sort_order, pw_sort_order' : 'pw_sort_order'}, cm.phase`,
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

    // Build module object helper
    function buildModuleObj(m) {
      return {
        id: m.id,
        phase: m.phase,
        title: m.title,
        desc: m.description,
        icon: m.icon,
        track: m.track || 'onboarding',
        sort_order: m.pw_sort_order,
        isRequired: m.is_required,
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
      };
    }

    // If pathway-specific request, group modules by course
    if (queryPathway && modules.rows.length > 0 && modules.rows[0].course_id) {
      // Load course metadata
      const courseData = await db.query(
        `SELECT c.id, c.title, c.description, c.icon, pc.sort_order, COALESCE(pc.is_required, TRUE) AS is_required
         FROM courses c
         JOIN pathway_courses pc ON pc.course_id = c.id
         WHERE pc.pathway_id = $1
         ORDER BY pc.sort_order`,
        [queryPathway]
      );

      // Group modules by course_id
      const courseMap = {};
      for (const cd of courseData.rows) {
        courseMap[cd.id] = {
          id: cd.id,
          title: cd.title,
          description: cd.description,
          icon: cd.icon,
          sortOrder: cd.sort_order,
          isRequired: cd.is_required,
          modules: []
        };
      }
      for (const m of modules.rows) {
        if (courseMap[m.course_id]) {
          courseMap[m.course_id].modules.push(buildModuleObj(m));
        }
      }

      // Return nested structure: { courses: [...], modules: [...] }
      // courses = nested structure for timeline rendering
      // modules = flat array for backward compatibility (game.js module lookups)
      const courses = Object.values(courseMap).sort((a, b) => a.sortOrder - b.sortOrder);
      const flatModules = modules.rows.map(buildModuleObj);
      res.json({ courses, modules: flatModules });
    } else {
      // No pathway filter or no course data — return flat array (backward compat)
      const result = modules.rows.map(buildModuleObj);
      res.json(result);
    }
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
        'SELECT id, pool, question, options, correct_index, explanation FROM cms_quiz_questions WHERE pool = $1 ORDER BY sort_order',
        [pool]
      );
    } else {
      result = await db.query(
        'SELECT id, pool, question, options, correct_index, explanation FROM cms_quiz_questions ORDER BY pool, sort_order'
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
  const { title, description, icon, phase, game_id, game_title, game_desc, sort_order, track } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const result = await db.query(
      `UPDATE cms_modules SET title=$1, description=$2, icon=$3, phase=$4, game_id=$5, game_title=$6, game_desc=$7, sort_order=$8, updated_by=$9, updated_at=NOW(), track=$11
       WHERE id = $10 RETURNING *`,
      [title.trim(), description, icon, phase, game_id, game_title, game_desc, sort_order, req.user.id, req.params.id, track || 'onboarding']
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Module not found' });

    await auditLog(req.user.id, 'cms_module_update', null, { module_id: req.params.id, changes: req.body });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Module update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create module (ld_manager+)
router.post('/modules', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { id, title, description, icon, phase, game_id, game_title, game_desc, track } = req.body;
  if (!id || !title) return res.status(400).json({ error: 'ID and title are required' });
  if (!/^[a-z0-9_]+$/.test(id)) return res.status(400).json({ error: 'ID must be lowercase alphanumeric with underscores' });
  try {
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM cms_modules');
    const result = await db.query(
      `INSERT INTO cms_modules (id, phase, title, description, icon, game_id, game_title, game_desc, sort_order, updated_by, track)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [id, phase || 1, title.trim(), description, icon, game_id, game_title, game_desc, maxOrder.rows[0].next, req.user.id, track || 'onboarding']
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
    const count = await db.query('SELECT COUNT(*) as cnt FROM cms_quiz_questions WHERE pool = $1', [q.rows[0].pool]);
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

// ─── GAME & CHATBOT LIBRARIES ───

/**
 * GET /api/cms/games
 * Returns all active games for the game library.
 */
router.get('/games', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, title, description, skill_area, icon, created_at FROM cms_games ORDER BY title'
    );
    res.json({ games: result.rows });
  } catch (err) {
    console.error('[CMS] Games list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/cms/chatbots
 * Returns all active chatbots for the chatbot library.
 */
router.get('/chatbots', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, title, description, category, icon, created_at FROM cms_chatbots ORDER BY title'
    );
    res.json({ chatbots: result.rows });
  } catch (err) {
    console.error('[CMS] Chatbots list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── COURSE CRUD (LD Manager+) ───

/**
 * GET /api/cms/courses
 * Returns all courses with module counts and pathway assignments.
 */
router.get('/courses', requireAuth, requireRole('ld_manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.id, c.title, c.description, c.icon, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) AS module_count,
        COALESCE(
          (SELECT json_agg(json_build_object('pathwayId', p.id, 'pathwayName', p.name))
           FROM pathway_courses pc2
           JOIN pathways p ON p.id = pc2.pathway_id
           WHERE pc2.course_id = c.id),
          '[]'::json
        ) AS pathways
      FROM courses c
      ORDER BY c.title
    `);
    res.json({ courses: result.rows.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      moduleCount: parseInt(c.module_count),
      pathways: c.pathways,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }))});
  } catch (err) {
    console.error('[CMS] Courses list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/cms/courses/:id
 * Returns a single course with its assigned modules.
 */
router.get('/courses/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const courseId = parseInt(req.params.id);
  if (isNaN(courseId)) return res.status(400).json({ error: 'Valid course ID is required' });
  try {
    const course = await db.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

    const assigned = await db.query(
      `SELECT cm.id, cm.title, cm.icon, cm.phase, cm.track, com.sort_order, com.is_required,
        (SELECT COUNT(*) FROM cms_videos WHERE module_id = cm.id) AS video_count,
        (SELECT COUNT(*) FROM cms_doc_sections WHERE module_id = cm.id) AS doc_count,
        (SELECT COUNT(*) FROM cms_apply_items WHERE module_id = cm.id) AS apply_count
       FROM course_modules com
       JOIN cms_modules cm ON cm.id = com.module_id
       WHERE com.course_id = $1
       ORDER BY com.sort_order`,
      [courseId]
    );

    const available = await db.query(
      `SELECT cm.id, cm.title, cm.icon, cm.phase, cm.track,
        (SELECT COUNT(*) FROM cms_videos WHERE module_id = cm.id) AS video_count,
        (SELECT COUNT(*) FROM cms_doc_sections WHERE module_id = cm.id) AS doc_count,
        (SELECT COUNT(*) FROM cms_apply_items WHERE module_id = cm.id) AS apply_count
       FROM cms_modules cm
       WHERE cm.id NOT IN (SELECT module_id FROM course_modules WHERE course_id = $1)
       ORDER BY cm.phase, cm.sort_order`,
      [courseId]
    );

    res.json({
      ...course.rows[0],
      assigned: assigned.rows.map(m => ({
        id: m.id, title: m.title, icon: m.icon, phase: m.phase,
        track: m.track || 'onboarding', sortOrder: m.sort_order,
        isRequired: m.is_required !== false,
        activityCount: parseInt(m.video_count) + parseInt(m.doc_count) + parseInt(m.apply_count) + (m.game_id ? 1 : 0)
      })),
      available: available.rows.map(m => ({
        id: m.id, title: m.title, icon: m.icon, phase: m.phase,
        track: m.track || 'onboarding',
        activityCount: parseInt(m.video_count) + parseInt(m.doc_count) + parseInt(m.apply_count)
      }))
    });
  } catch (err) {
    console.error('[CMS] Course fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/cms/courses
 * Create a new course.
 * Body: { title, description, icon }
 */
router.post('/courses', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const { title, description, icon } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Course title is required' });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ error: 'Course title must be 200 characters or less' });
  }
  try {
    const result = await db.query(
      'INSERT INTO courses (title, description, icon, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title.trim(), description?.trim() || null, icon || '📘', req.user.id]
    );
    await auditLog(req.user.id, 'course_created', result.rows[0].id, { title: title.trim() });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Course create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/cms/courses/:id
 * Update course metadata.
 * Body: { title, description, icon }
 */
router.put('/courses/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const courseId = parseInt(req.params.id);
  if (isNaN(courseId)) return res.status(400).json({ error: 'Valid course ID is required' });
  const { title, description, icon } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Course title is required' });
  }
  try {
    const result = await db.query(
      'UPDATE courses SET title = $1, description = $2, icon = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [title.trim(), description?.trim() || null, icon || '📘', courseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    await auditLog(req.user.id, 'course_updated', courseId, { changes: req.body });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CMS] Course update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/cms/courses/:id
 * Deletes a course. Modules survive (cascade removes course_modules junction only).
 */
router.delete('/courses/:id', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const courseId = parseInt(req.params.id);
  if (isNaN(courseId)) return res.status(400).json({ error: 'Valid course ID is required' });
  try {
    const course = await db.query('SELECT id, title FROM courses WHERE id = $1', [courseId]);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

    await db.query('DELETE FROM courses WHERE id = $1', [courseId]);
    await auditLog(req.user.id, 'course_deleted', courseId, { title: course.rows[0].title });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error('[CMS] Course delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/cms/courses/:id/modules
 * Save module assignments for a course.
 * Body: { modules: [{ id: 'm1', isRequired: true }, ...] }
 */
router.put('/courses/:id/modules', requireAuth, requireRole('ld_manager'), async (req, res) => {
  const courseId = parseInt(req.params.id);
  if (isNaN(courseId)) return res.status(400).json({ error: 'Valid course ID is required' });
  const { modules: moduleEntries } = req.body;
  if (!Array.isArray(moduleEntries)) return res.status(400).json({ error: 'modules array is required' });

  try {
    const course = await db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

    // Validate module IDs exist
    const entryIds = moduleEntries.map(e => e.id);
    if (entryIds.length > 0) {
      const valid = await db.query('SELECT id FROM cms_modules WHERE id = ANY($1)', [entryIds]);
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
      await client.query('DELETE FROM course_modules WHERE course_id = $1', [courseId]);
      for (let i = 0; i < moduleEntries.length; i++) {
        await client.query(
          'INSERT INTO course_modules (course_id, module_id, sort_order, is_required) VALUES ($1, $2, $3, $4)',
          [courseId, moduleEntries[i].id, i, moduleEntries[i].isRequired !== false]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await auditLog(req.user.id, 'course_modules_updated', courseId, { moduleIds: entryIds });
    res.json({ message: 'Course modules updated' });
  } catch (err) {
    console.error('[CMS] Course modules update error:', err.message);
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
