/**
 * Session Management Routes
 * Tracks simulation sessions with explicit lifecycle statuses.
 * Updated for 2-module course redesign with per-persona progress tracking.
 */

const express = require('express');

const db = require('../db');
const { requireAuth, requireAnyRole } = require('../middleware/auth');
const { tavusFetch } = require('../services/tavusClient');
const { extractTranscript, extractConversationMeta } = require('../services/tavusNormalizer');
const { processSession, generateCoachingAnalysis, scoreTranscript } = require('../services/postCallProcessor');
const { COURSE_MODULES, PERSONA_DISPLAY_NAMES, PERSONA_FIRST_NAMES } = require('../modules');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { getScenario, SCENARIOS_DIR } = require('../services/scenarioLoader');

const router = express.Router();

const fs = require('fs');
const path = require('path');


async function checkSessionOwnership(req, res, sessionId) {
  if (!req.user || !req.user.userId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (req.user.role === 'admin') {
    return { ok: true };
  }

  const session = await db.query(
    'SELECT external_user_id FROM simulation_sessions WHERE id = $1',
    [sessionId]
  );

  if (session.rows.length === 0) {
    return { ok: false, status: 404, error: 'Session not found' };
  }

  const sessionOwnerId = session.rows[0].external_user_id;

  if (sessionOwnerId !== req.user.userId) {
    if (req.user.role === 'manager') {
      return { ok: false, status: 403, error: 'Access denied: cohort scoping is pending integration.' };
    }
    return { ok: false, status: 403, error: 'Access denied: session belongs to another user.' };
  }

  return { ok: true };
}



// Fetch retry constants shared with postCallProcessor.js
// Both files have independent transcript fetch paths that need these values.
const { TRANSCRIPT_RETRY_DELAY_MS } = require('../services/tavusNormalizer');

// MAX_TRANSCRIPT_ATTEMPTS is capped low here because this route is a direct fetch
// utility, not the main processing pipeline. The pipeline (postCallProcessor) handles
// retries over a longer window internally. Keeping this short prevents long HTTP holds.
const MAX_TRANSCRIPT_ATTEMPTS = 3;

// Valid session statuses and their allowed transitions
const STATUS_TRANSITIONS = {
  created: ['active', 'failed'],
  active: ['ended', 'failed'],
  ended: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: [],
};

// Maximum sessions returned per request
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

/**
 * GET /api/sessions - List sessions with optional filters.
 * Query: ?userId, ?scenarioId, ?status, ?limit (max 50), ?offset
 * Returns sessions with joined score data, newest first.
 */
router.get('/', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = parseInt(req.query.offset, 10) || 0;

    // Build WHERE clauses from optional filters
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by user: regular users/managers can only see their own sessions.
    // Managers are blocked from cross-user lists until scoping is integrated.
    let userId = req.user.userId;

    if (req.user.role === 'admin') {
      userId = req.query.userId || null;
    } else if (req.query.userId && req.query.userId !== req.user.userId) {
      return sendError(res, req, 403, req.user.role === 'manager'
        ? 'Access denied: cohort scoping is pending integration.'
        : 'Access denied: cannot query sessions of other users.'
      );
    }

    if (userId) {
      conditions.push(`s.external_user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (req.query.scenarioId) {
      conditions.push(`s.scenario_id = $${paramIndex}`);
      params.push(req.query.scenarioId);
      paramIndex++;
    }

    if (req.query.status) {
      conditions.push(`s.status = $${paramIndex}`);
      params.push(req.query.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count only scored sessions (prevents ghost pages from unscored/abandoned calls)
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Global aggregate stats across ALL scored sessions (not per-page)
    const statsResult = await db.query(
      `SELECT
         MAX(sc.overall_score) AS best_score,
         ROUND(AVG(sc.overall_score)) AS avg_score,
         COUNT(*) FILTER (WHERE sc.overall_verdict = 'pass') AS pass_count,
         COUNT(*) AS scored_total
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       ${whereClause}`,
      params
    );
    const stats = statsResult.rows[0] || {};

    // Fetch paginated sessions (only scored)
    const result = await db.query(
      `SELECT s.id, s.scenario_id, s.module_id, s.persona_id, s.status, s.duration_seconds,
              s.created_at, s.updated_at,
              sc.overall_score, sc.overall_verdict
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const dataPayload = {
      sessions: result.rows,
      stats: {
        best_score: parseInt(stats.best_score, 10) || 0,
        avg_score: parseInt(stats.avg_score, 10) || 0,
        pass_count: parseInt(stats.pass_count, 10) || 0,
        scored_total: parseInt(stats.scored_total, 10) || 0,
      },
    };

    const paginationMeta = {
      type: 'offset',
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    };

    return sendSuccess(res, dataPayload, 200, paginationMeta);
  } catch (err) {
    logger.error('List sessions error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve sessions.');
  }
});

/**
 * POST /api/sessions - Create a new simulation session.
 * Body: { scenarioId, moduleId?, personaId? }
 * For Module 5 sessions, validates Module 4 mastery and retrieves relationship summary.
 * Returns the created session record.
 */
router.post('/', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const { scenarioId } = req.body;

    if (!scenarioId) {
      return sendError(res, req, 400, 'scenarioId is required');
    }

    let scenario = getScenario(scenarioId);
    let isArchived = false;

    if (!scenario) {
      const sanitizedScenarioId = scenarioId.replace(/[^a-zA-Z0-9_-]/g, '');
      const archivePath = path.join(SCENARIOS_DIR, 'archive', `${sanitizedScenarioId}.json`);
      const resolved = path.resolve(archivePath);
      if (!resolved.startsWith(path.resolve(SCENARIOS_DIR))) {
        return sendError(res, req, 400, 'Invalid scenario ID');
      }
      if (fs.existsSync(archivePath)) {
        isArchived = true;
      } else {
        return sendError(res, req, 404, 'Scenario not found');
      }
    }

    if (isArchived || scenarioId.startsWith('archive/') || (scenario && scenario.status && scenario.status === 'archived')) {
      return sendError(res, req, 403, 'Cannot launch an archived scenario.');
    }

    const moduleId = scenario.module_id;
    const personaId = scenario.persona_id;
    const externalUserId = req.user.userId;

    let relationshipSummary = null;
    let relationshipSummaryJson = null;

    // Module 5 prerequisite checks
    if (moduleId === 'module5' && personaId) {
      // Check mastery of Module 4 for this persona
      const masteryResult = await db.query(
        `SELECT mastery_score FROM module_masteries
         WHERE external_user_id = $1 AND module_id = 'module4' AND persona_id = $2`,
         [externalUserId, personaId]
      );

      if (masteryResult.rows.length === 0) {
        return sendError(res, req, 403, 'Module 4 mastery required before starting Module 5 for this persona.');
      }

      // Retrieve the most recent passing Module 4 session's relationship summary
      const summaryResult = await db.query(
        `SELECT s.relationship_summary, s.relationship_summary_json
         FROM simulation_sessions s
         INNER JOIN session_scores sc ON sc.session_id = s.id
         WHERE s.external_user_id = $1
           AND s.module_id = 'module4'
           AND s.persona_id = $2
           AND s.status = 'completed'
           AND s.relationship_summary IS NOT NULL
           AND s.relationship_summary != ''
           AND sc.final_score >= 80
           AND sc.overall_verdict = 'pass'
         ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
         LIMIT 1`,
         [externalUserId, personaId]
      );

      if (summaryResult.rows.length === 0) {
        return sendError(res, req, 422, 'No relationship summary found from a passing Module 4 session for this persona.');
      }

      relationshipSummary = summaryResult.rows[0].relationship_summary;
      relationshipSummaryJson = summaryResult.rows[0].relationship_summary_json;
    }

    const result = await db.query(
      `INSERT INTO simulation_sessions (scenario_id, external_user_id, status, module_id, persona_id)
       VALUES ($1, $2, 'created', $3, $4)
       RETURNING id, scenario_id, external_user_id, module_id, persona_id, status, created_at, updated_at`,
      [scenarioId, externalUserId, moduleId || null, personaId || null]
    );

    const session = result.rows[0];

    // Attach relationship context for Module 5 sessions
    if (relationshipSummary) {
      session.relationship_context = {
        summary: relationshipSummary,
        summary_json: relationshipSummaryJson,
      };
    }

    logger.info('Created session', { sessionId: session.id, scenarioId, moduleId, personaId });
    return sendSuccess(res, session, 201);
  } catch (err) {
    logger.error('Create session error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to create session. Please try again.');
  }
});

/**
 * GET /api/sessions/continuity - Retrieve relationship summary for a persona.
 * Query: ?personaId=...
 * Protected by requireAuth.
 */
router.get('/continuity', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const { personaId } = req.query;
    const externalUserId = req.user.userId;

    if (!personaId) {
      return sendError(res, req, 400, 'personaId is required');
    }

    // Allowlist validation
    const allowedPersonas = Object.keys(PERSONA_DISPLAY_NAMES);
    if (!allowedPersonas.includes(personaId)) {
      return sendError(res, req, 400, 'Invalid personaId');
    }

    // Retrieve latest passing Module 4 session's summary (final_score >= 80, pass)
    const result = await db.query(
      `SELECT s.relationship_summary, s.relationship_summary_json, sc.final_score
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       WHERE s.external_user_id = $1
         AND s.module_id = 'module4'
         AND s.persona_id = $2
         AND s.status = 'completed'
         AND s.relationship_summary IS NOT NULL
         AND s.relationship_summary != ''
         AND sc.final_score >= 80
         AND sc.overall_verdict = 'pass'
       ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
       LIMIT 1`,
      [externalUserId, personaId]
    );

    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'No passing Module 4 summary found for this persona.');
    }

    const payload = {
      relationship_summary: result.rows[0].relationship_summary,
      relationship_summary_json: result.rows[0].relationship_summary_json,
    };

    return sendSuccess(res, payload);
  } catch (err) {
    logger.error('Continuity retrieval error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve continuity data.');
  }
});

/**
 * GET /api/sessions/progress - Per-module, per-persona progress for the current user.
 * Computes attempts, scores, mastery status, and rolling averages.
 * Excludes legacy sessions from calculations.
 * Must be defined before /:id to prevent 'progress' matching as a session ID.
 */
router.get('/progress', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    let userId = req.user.userId;

    if (req.user.role === 'admin') {
      userId = req.query.userId || req.user.userId;
    } else if (req.query.userId && req.query.userId !== req.user.userId) {
      return sendError(res, req, 403, req.user.role === 'manager'
        ? 'Access denied: cohort scoping is pending integration.'
        : 'Access denied: cannot query progress of other users.'
      );
    }

    // Fetch all completed, scored sessions excluding legacy
    const sessionsResult = await db.query(
      `SELECT s.id, s.module_id, s.persona_id, s.created_at,
              sc.overall_score, sc.overall_verdict,
              COALESCE(sc.final_score, sc.overall_score) AS effective_score
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       WHERE s.external_user_id = $1
         AND s.status = 'completed'
         AND s.module_id IS NOT NULL
         AND s.module_id != 'legacy'
       ORDER BY s.created_at ASC`,
      [userId]
    );

    const sessions = sessionsResult.rows;

    // Fetch all masteries for this user
    const masteriesResult = await db.query(
      `SELECT module_id, persona_id, mastery_score
       FROM module_masteries
       WHERE external_user_id = $1`,
      [userId]
    );

    // Build mastery lookup: { "module4:sam_patel": { mastery_score: 85 } }
    const masteryLookup = {};
    for (const m of masteriesResult.rows) {
      masteryLookup[`${m.module_id}:${m.persona_id}`] = {
        mastery_score: parseFloat(m.mastery_score),
      };
    }

    // Build per-module, per-persona stats
    const modules = {};
    for (const mod of COURSE_MODULES) {
      const personas = {};

      for (const personaId of mod.personas) {
        const personaSessions = sessions.filter(
          s => s.module_id === mod.id && s.persona_id === personaId
        );

        const attempts = personaSessions.length;
        const scores = personaSessions.map(s => parseFloat(s.effective_score));
        const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const latestScore = scores.length > 0 ? scores[scores.length - 1] : 0;

        // Rolling average of latest 3 scored attempts
        const latest3 = scores.slice(-3);
        const rollingAvg = latest3.length > 0
          ? Math.round(latest3.reduce((a, b) => a + b, 0) / latest3.length)
          : 0;

        const masteryKey = `${mod.id}:${personaId}`;
        const mastery = masteryLookup[masteryKey] || null;

        personas[personaId] = {
          displayName: PERSONA_DISPLAY_NAMES[personaId] || personaId,
          attempts,
          bestScore,
          latestScore,
          rolling_avg: rollingAvg,
          mastered: mastery !== null,
          mastery_score: mastery ? mastery.mastery_score : null,
        };
      }

      modules[mod.id] = {
        name: mod.name,
        shortName: mod.shortName,
        order: mod.order,
        personas,
      };
    }

    // Certificates map (Option A: per persona)
    const certificates = {};
    const allPersonas = [...new Set(COURSE_MODULES.flatMap(m => m.personas))];
    for (const personaId of allPersonas) {
      const m1Key = `module4:${personaId}`;
      const m2Key = `module5:${personaId}`;
      certificates[personaId] = {
        unlocked: !!(masteryLookup[m1Key] && masteryLookup[m2Key])
      };
    }

    // Global course completion: true if ALL certificates are unlocked
    let allMastered = Object.values(certificates).every(c => c.unlocked);

    const progressData = {
      modules,
      certificates,
      certificate: { unlocked: allMastered },
    };

    return sendSuccess(res, progressData);
  } catch (err) {
    logger.error('Progress calculation error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to compute progress.');
  }
});

/**
 * POST /api/sessions/renormalize-all - Re-normalize all stored transcripts.
 * Runs existing raw_transcript data through the updated normalizer.
 * Only accessible to admins.
 */
router.post('/renormalize-all', requireAuth, requireAnyRole('admin'), async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const result = await db.query(
      'SELECT session_id, raw_transcript FROM session_transcripts WHERE raw_transcript IS NOT NULL'
    );

    let updated = 0;
    let skipped = 0;

    for (const row of result.rows) {
      try {
        const rawData = JSON.parse(row.raw_transcript);
        const normalized = extractTranscript(rawData);

        if (normalized) {
          await db.query(
            'UPDATE session_transcripts SET normalized_transcript = $1 WHERE session_id = $2',
            [normalized, row.session_id]
          );
          updated++;
        } else {
          skipped++;
        }
      } catch (parseErr) {
        logger.warn('Re-normalize parse error for session', { sessionId: row.session_id, error: parseErr.message });
        skipped++;
      }
    }

    logger.info('Re-normalization complete', { updated, skipped, total: result.rows.length });
    return sendSuccess(res, { updated, skipped, total: result.rows.length });
  } catch (err) {
    logger.error('Re-normalization error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Re-normalization failed.');
  }
});

/**
 * GET /api/sessions/:id - Get a session by ID.
 * Returns the full session record.
 */
router.get('/:id', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const result = await db.query(
      'SELECT * FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    logger.error('Get session error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve session.');
  }
});

/**
 * GET /api/sessions/:id/tavus-status - Get Tavus conversation status.
 * Protected by requireAuth, ownership checks.
 */
router.get('/:id/tavus-status', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const sessionResult = await db.query(
      'SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (sessionResult.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    const { tavus_conversation_id: conversationId } = sessionResult.rows[0];
    if (!conversationId) {
      return sendError(res, req, 422, 'Session has no Tavus conversation ID');
    }

    const data = await tavusFetch(`/conversations/${conversationId}`);
    const meta = extractConversationMeta(data);
    return sendSuccess(res, meta);
  } catch (err) {
    logger.error('Get Tavus status error', { error: err.message, path: req.path });
    return sendError(res, req, err.status || 500, 'Unable to retrieve conversation status.');
  }
});

/**
 * DELETE /api/sessions/:id/tavus-session - End a Tavus conversation.
 * Protected by requireAuth, ownership checks.
 */
router.delete('/:id/tavus-session', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const sessionResult = await db.query(
      'SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (sessionResult.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    const { tavus_conversation_id: conversationId } = sessionResult.rows[0];
    if (!conversationId) {
      return sendError(res, req, 422, 'Session has no Tavus conversation ID');
    }

    await tavusFetch(`/conversations/${conversationId}`, { method: 'DELETE' });
    const username = req.user?.username || 'anonymous';
    logger.info('Tavus conversation ended via session route', { sessionId: req.params.id, conversationId, username });

    return sendSuccess(res, { status: 'ended' });
  } catch (err) {
    logger.error('End Tavus conversation error', { error: err.message, path: req.path });
    return sendError(res, req, err.status || 500, 'Unable to end conversation.');
  }
});

/**
 * PATCH /api/sessions/:id/status - Update session status.
 * Body: { status, tavusConversationId?, durationSeconds? }
 * Validates that the status transition is allowed.
 * Returns the updated session record.
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const { status, tavusConversationId, durationSeconds } = req.body;

    if (!status) {
      return sendError(res, req, 400, 'status is required');
    }

    // Fetch current session to validate transition
    const current = await db.query(
      'SELECT id, status FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (current.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    const currentStatus = current.rows[0].status;
    const allowedNext = STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || !allowedNext.includes(status)) {
      return sendError(res, req, 422, `Cannot transition from '${currentStatus}' to '${status}'`);
    }

    // Build the update query dynamically based on provided fields
    const setClauses = ['status = $2'];
    const params = [req.params.id, status];
    let paramIndex = 3;

    if (tavusConversationId !== undefined) {
      setClauses.push(`tavus_conversation_id = $${paramIndex}`);
      params.push(tavusConversationId);
      paramIndex++;
    }

    if (durationSeconds !== undefined) {
      setClauses.push(`duration_seconds = $${paramIndex}`);
      params.push(durationSeconds);
      paramIndex++;
    }

    const result = await db.query(
      `UPDATE simulation_sessions
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    logger.info('Updated session status', { sessionId: req.params.id, from: currentStatus, to: status });

    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    logger.error('Status update error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to update session status.');
  }
});

/**
 * POST /api/sessions/:id/fetch-transcript - Fetch transcript from Tavus and store it.
 * The server fetches the transcript with retries (Tavus needs time to finalize).
 * Stores both raw Tavus response and normalized transcript in session_transcripts.
 * Returns the normalized transcript text.
 */
router.post('/:id/fetch-transcript', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    // Look up the session to get the Tavus conversation ID and persona
    const session = await db.query(
      'SELECT id, tavus_conversation_id, persona_id, status FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (session.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    const { tavus_conversation_id: conversationId, persona_id: personaId } = session.rows[0];
    const personaName = PERSONA_FIRST_NAMES[personaId] || null;

    if (!conversationId) {
      return sendError(res, req, 422, 'Session has no Tavus conversation ID');
    }

    // Check if transcript already exists for this session
    const existing = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [req.params.id]
    );

    if (existing.rows.length > 0 && existing.rows[0].normalized_transcript) {
      logger.info('Transcript already stored', { sessionId: req.params.id });
      return sendSuccess(res, { transcript: existing.rows[0].normalized_transcript });
    }

    // Fetch transcript from Tavus with retry loop
    let transcript = null;
    let rawResponse = null;

    for (let attempt = 1; attempt <= MAX_TRANSCRIPT_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
      }

      logger.info('Fetching transcript', { attempt, maxAttempts: MAX_TRANSCRIPT_ATTEMPTS, sessionId: req.params.id });

      try {
        const data = await tavusFetch(`/conversations/${conversationId}`);
        rawResponse = JSON.stringify(data);

        // Use normalizer to extract transcript from vendor-specific fields
        const text = extractTranscript(data, personaName);

        if (text) {
          transcript = text;
          logger.info('Transcript retrieved', { sessionId: req.params.id, length: text.length });
          break;
        }

        logger.info('Transcript not ready yet', { attempt, sessionId: req.params.id });
      } catch (fetchErr) {
        logger.warn('Transcript fetch error on attempt', { attempt, error: fetchErr.message, sessionId: req.params.id });
      }
    }

    if (!transcript) {
      logger.warn('Transcript unavailable after max attempts', { maxAttempts: MAX_TRANSCRIPT_ATTEMPTS, sessionId: req.params.id });
      return sendSuccess(res, { transcript: null });
    }

    // Store in session_transcripts table
    await db.query(
      `INSERT INTO session_transcripts (session_id, raw_transcript, normalized_transcript)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id)
       DO UPDATE SET raw_transcript = $2, normalized_transcript = $3`,
      [req.params.id, rawResponse, transcript]
    );

    logger.info('Transcript stored', { sessionId: req.params.id });

    return sendSuccess(res, { transcript });
  } catch (err) {
    logger.error('Fetch transcript error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to fetch transcript.');
  }
});

/**
 * POST /api/sessions/:id/process - Trigger backend post-call processing.
 * Starts the pipeline (fetch transcript -> score -> persist) asynchronously.
 * Returns immediately so the frontend can poll for completion.
 */
router.post('/:id/process', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    // Atomically claim the session for processing
    const claimResult = await db.query(
      `UPDATE simulation_sessions 
       SET status = 'processing', updated_at = NOW() 
       WHERE id = $1 AND status = 'ended' 
       RETURNING *`,
      [req.params.id]
    );
    if (claimResult.rows.length === 0) {
      // Either doesn't exist, wrong owner, or already processing/completed
      return sendSuccess(res, { status: 'skipped', message: 'Session is not in ended state or is already being processed.' });
    }
    const session = claimResult.rows[0];

    // Fire-and-forget: start processing, respond immediately
    processSession(req.params.id).catch((err) => {
      logger.error('Background processing failed', { sessionId: req.params.id, error: err.message });
    });

    return sendSuccess(res, { status: 'processing', message: 'Post-call processing started' });
  } catch (err) {
    logger.error('Process trigger error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to start processing.');
  }
});

/**
 * GET /api/sessions/:id/score - Retrieve stored scorecard.
 * Returns the parsed scorecard from session_scores table.
 */
router.get('/:id/score', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const result = await db.query(
      `SELECT overall_score, overall_verdict, categories, top_strengths,
              critical_improvements, coaching_tip, raw_score, final_score,
              automatic_fails_triggered, created_at
       FROM session_scores WHERE session_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'Score not found');
    }

    const row = result.rows[0];

    // Reconstruct the scorecard shape the frontend expects
    const scorecard = {
      overall_score: row.overall_score,
      overall_verdict: row.overall_verdict,
      categories: row.categories || {},
      top_strengths: row.top_strengths || [],
      critical_improvements: row.critical_improvements || [],
      coaching_tip: row.coaching_tip || '',
      raw_score: row.raw_score != null ? parseFloat(row.raw_score) : null,
      final_score: row.final_score != null ? parseFloat(row.final_score) : null,
      automatic_fails_triggered: row.automatic_fails_triggered || [],
    };

    return sendSuccess(res, scorecard);
  } catch (err) {
    logger.error('Get score error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve score.');
  }
});

/**
 * GET /api/sessions/:id/coaching - Retrieve stored coaching analysis.
 * Returns the coaching_analysis JSONB from session_scores table.
 * 404 if no coaching analysis exists for this session.
 */
router.get('/:id/coaching', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const result = await db.query(
      'SELECT coaching_analysis FROM session_scores WHERE session_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0 || !result.rows[0].coaching_analysis) {
      return sendError(res, req, 404, 'Coaching analysis not found');
    }

    return sendSuccess(res, {
      coaching_analysis: result.rows[0].coaching_analysis,
    });
  } catch (err) {
    logger.error('Get coaching error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve coaching analysis.');
  }
});

/**
 * GET /api/sessions/:id/transcript - Retrieve stored transcript.
 * Returns the normalized transcript text from session_transcripts table.
 * 404 if no transcript exists for this session.
 */
router.get('/:id/transcript', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const result = await db.query(
      'SELECT normalized_transcript, created_at FROM session_transcripts WHERE session_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'Transcript not found');
    }

    return sendSuccess(res, {
      transcript: result.rows[0].normalized_transcript,
      createdAt: result.rows[0].created_at,
    });
  } catch (err) {
    logger.error('Get transcript error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve transcript.');
  }
});

/**
 * GET /api/sessions/:id/perception - Returns stored perception analysis.
 * 404 if no perception data exists for this session.
 */
router.get('/:id/perception', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const ownership = await checkSessionOwnership(req, res, req.params.id);
    if (!ownership.ok) {
      return sendError(res, req, ownership.status, ownership.error);
    }

    const result = await db.query(
      `SELECT raw_analysis, normalized_analysis, source, created_at
       FROM session_perception_analysis WHERE session_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'Perception analysis not found');
    }

    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    logger.error('Get perception error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to retrieve perception analysis.');
  }
});

/**
 * POST /api/sessions/:id/generate-coaching - Generate coaching for an existing scored session.
 * Only accessible to admins.
 */
router.post('/:id/generate-coaching', requireAuth, requireAnyRole('admin'), async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const sessionId = req.params.id;

    // Get transcript
    const txResult = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [sessionId]
    );
    if (txResult.rows.length === 0 || !txResult.rows[0].normalized_transcript) {
      return sendError(res, req, 404, 'Transcript not found for this session.');
    }

    // Get scorecard
    const scoreResult = await db.query(
      'SELECT overall_score, overall_verdict, categories, top_strengths, critical_improvements, coaching_tip FROM session_scores WHERE session_id = $1',
      [sessionId]
    );
    if (scoreResult.rows.length === 0) {
      return sendError(res, req, 404, 'Score not found for this session.');
    }

    // Get scenario_id
    const sessionResult = await db.query(
      'SELECT scenario_id FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    const scenarioId = sessionResult.rows[0]?.scenario_id || 'unknown';

    const transcript = txResult.rows[0].normalized_transcript;
    const scorecard = {
      overall_score: scoreResult.rows[0].overall_score,
      overall_verdict: scoreResult.rows[0].overall_verdict,
      categories: scoreResult.rows[0].categories || {},
      top_strengths: scoreResult.rows[0].top_strengths || [],
      critical_improvements: scoreResult.rows[0].critical_improvements || [],
      coaching_tip: scoreResult.rows[0].coaching_tip || '',
    };

    const coaching = await generateCoachingAnalysis({ transcript, scenarioId, scorecard });

    if (!coaching) {
      return sendError(res, req, 500, 'Coaching generation failed.');
    }

    // Persist coaching analysis
    await db.query(
      'UPDATE session_scores SET coaching_analysis = $1 WHERE session_id = $2',
      [JSON.stringify(coaching), sessionId]
    );

    return sendSuccess(res, { success: true, coaching_analysis: coaching });
  } catch (err) {
    logger.error('Generate coaching error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to generate coaching analysis.');
  }
});

/**
 * POST /api/sessions/:id/rescore - Re-score an existing session with the current rubric.
 * Only accessible to admins.
 */
router.post('/:id/rescore', requireAuth, requireAnyRole('admin'), async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const sessionId = req.params.id;

    // Get transcript
    const txResult = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [sessionId]
    );
    if (txResult.rows.length === 0 || !txResult.rows[0].normalized_transcript) {
      return sendError(res, req, 404, 'Transcript not found for this session.');
    }

    // Get scenario_id
    const sessionResult = await db.query(
      'SELECT scenario_id FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    const scenarioId = sessionResult.rows[0]?.scenario_id || 'unknown';

    const transcript = txResult.rows[0].normalized_transcript;
    const scorecard = await scoreTranscript(transcript, scenarioId);

    if (!scorecard) {
      return sendError(res, req, 500, 'Scoring failed.');
    }

    // Persist new score — write all columns to avoid stale values from original score
    const rawResponse = JSON.stringify(scorecard);
    const categories = JSON.stringify(scorecard.categories || {});
    const topStrengths = JSON.stringify(scorecard.top_strengths || []);
    const criticalImprovements = JSON.stringify(scorecard.critical_improvements || []);
    const coachingAnalysis = scorecard.coaching_analysis ? JSON.stringify(scorecard.coaching_analysis) : null;
    const autoFails = JSON.stringify(scorecard.automatic_fails_triggered || []);

    await db.query(
      `INSERT INTO session_scores
         (session_id, raw_response, overall_score, overall_verdict, categories,
          top_strengths, critical_improvements, coaching_tip, coaching_analysis,
          raw_score, final_score, automatic_fails_triggered, rubric_version, scoring_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (session_id)
       DO UPDATE SET
         raw_response = $2, overall_score = $3, overall_verdict = $4,
         categories = $5, top_strengths = $6, critical_improvements = $7,
         coaching_tip = $8, coaching_analysis = $9,
         raw_score = $10, final_score = $11, automatic_fails_triggered = $12,
         rubric_version = $13, scoring_model = $14`,
      [
        sessionId,
        rawResponse,
        scorecard.final_score || 0,
        scorecard.overall_verdict || 'unknown',
        categories,
        topStrengths,
        criticalImprovements,
        scorecard.coaching_tip || '',
        coachingAnalysis,
        scorecard.raw_score || 0,
        scorecard.final_score || 0,
        autoFails,
        '1.0',
        'gpt-4o',
      ]
    );

    logger.info('Re-scored session', { sessionId, score: scorecard.overall_score });
    return sendSuccess(res, { success: true, scorecard });
  } catch (err) {
    logger.error('Rescore error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to rescore session.');
  }
});

const adminDashboardHandler = async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    // Managers are blocked from access until scoping is integrated
    if (req.user.role === 'manager') {
      return sendError(res, req, 403, 'Access denied: cohort scoping is pending integration.');
    }

    if (req.user.role !== 'admin') {
      return sendError(res, req, 403, 'Insufficient permissions');
    }

    // Aggregate per-user progress for admin (no users table join needed)
    const result = await db.query(
      `SELECT
         s.external_user_id,
         s.module_id,
         s.persona_id,
         COUNT(*) AS attempts,
         MAX(COALESCE(sc.final_score, sc.overall_score)) AS best_score,
         ROUND(AVG(COALESCE(sc.final_score, sc.overall_score))) AS avg_score,
         COUNT(*) FILTER (WHERE sc.overall_verdict = 'pass') AS pass_count
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       WHERE s.module_id IS NOT NULL
         AND s.module_id != 'legacy'
       GROUP BY s.external_user_id, s.module_id, s.persona_id
       ORDER BY s.external_user_id`
    );

    // Fetch masteries for admin
    const masteriesResult = await db.query(
      `SELECT external_user_id, module_id, persona_id, mastery_score
       FROM module_masteries`
    );

    // Group by user
    const userMap = {};
    for (const row of result.rows) {
      if (!userMap[row.external_user_id]) {
        userMap[row.external_user_id] = { modules: {}, masteries: [] };
      }
      const key = `${row.module_id}:${row.persona_id}`;
      userMap[row.external_user_id].modules[key] = {
        module_id: row.module_id,
        persona_id: row.persona_id,
        attempts: parseInt(row.attempts, 10),
        best_score: parseFloat(row.best_score) || 0,
        avg_score: parseFloat(row.avg_score) || 0,
        pass_count: parseInt(row.pass_count, 10),
      };
    }

    for (const m of masteriesResult.rows) {
      if (!userMap[m.external_user_id]) {
        userMap[m.external_user_id] = { modules: {}, masteries: [] };
      }
      userMap[m.external_user_id].masteries.push({
        module_id: m.module_id,
        persona_id: m.persona_id,
        mastery_score: parseFloat(m.mastery_score),
      });
    }

    const users = Object.entries(userMap).map(([userId, data]) => ({
      userId,
      ...data,
    }));

    const payload = {
      users,
      summary: {
        totalUsers: users.length,
        totalSessions: result.rows.reduce((sum, r) => sum + parseInt(r.attempts, 10), 0),
      },
    };

    return sendSuccess(res, payload);
  } catch (err) {
    logger.error('Admin dashboard error', { error: err.message, path: req.path });
    return sendError(res, req, 500, 'Unable to load dashboard.');
  }
};

module.exports = {
  router,
  adminDashboardHandler
};
