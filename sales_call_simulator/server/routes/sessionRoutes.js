/**
 * Session Management Routes
 * Tracks simulation sessions with explicit lifecycle statuses.
 * Updated for 2-module course redesign with per-persona progress tracking.
 */

const express = require('express');

const db = require('../db');
const { requireAuth, requireAnyRole } = require('../middleware/auth');
const { tavusFetch } = require('../services/tavusClient');
const { extractTranscript } = require('../services/tavusNormalizer');
const { processSession, generateCoachingAnalysis, scoreTranscript } = require('../services/postCallProcessor');
const { COURSE_MODULES, PERSONA_DISPLAY_NAMES } = require('../modules');

const router = express.Router();

// Fetch retry constants shared with postCallProcessor.js
// Both files have independent transcript fetch paths that need these values.
const { TRANSCRIPT_RETRY_DELAY_MS } = require('../services/tavusNormalizer');

// MAX_TRANSCRIPT_ATTEMPTS is defined locally because the main pipeline
// (postCallProcessor) uses a time-based ceiling instead of fixed attempts.
// This endpoint uses a simpler fixed-attempt approach for direct fetches.
const MAX_TRANSCRIPT_ATTEMPTS = 10;

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
router.get('/', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = parseInt(req.query.offset, 10) || 0;

    // Build WHERE clauses from optional filters
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by user: explicit query param, or fall back to JWT user
    const userId = req.query.userId || (req.user && req.user.userId) || null;
    if (userId) {
      conditions.push(`s.external_user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else {
      conditions.push(`s.external_user_id IS NULL`);
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

    res.json({
      sessions: result.rows,
      total,
      limit,
      offset,
      stats: {
        best_score: parseInt(stats.best_score, 10) || 0,
        avg_score: parseInt(stats.avg_score, 10) || 0,
        pass_count: parseInt(stats.pass_count, 10) || 0,
        scored_total: parseInt(stats.scored_total, 10) || 0,
      },
    });
  } catch (err) {
    console.error('[Sessions] List error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve sessions.' });
  }
});

/**
 * POST /api/sessions - Create a new simulation session.
 * Body: { scenarioId, moduleId?, personaId? }
 * For Module 2 sessions, validates Module 1 mastery and retrieves relationship summary.
 * Returns the created session record.
 */
router.post('/', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { scenarioId, moduleId, personaId } = req.body;

    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required' });
    }

    // Use external user ID from JWT if available
    const externalUserId = req.user ? req.user.userId : null;

    let relationshipSummary = null;
    let relationshipSummaryJson = null;

    // Module 2 prerequisite checks
    if (moduleId === 'module2' && personaId) {
      // Check mastery of Module 1 for this persona
      const masteryResult = await db.query(
        `SELECT mastery_score FROM module_masteries
         WHERE external_user_id = $1 AND module_id = 'module1' AND persona_id = $2`,
        [externalUserId, personaId]
      );

      if (masteryResult.rows.length === 0) {
        return res.status(403).json({
          error: 'Module 1 mastery required before starting Module 2 for this persona.',
          details: { moduleId: 'module1', personaId },
        });
      }

      // Retrieve the most recent passing Module 1 session's relationship summary
      const summaryResult = await db.query(
        `SELECT relationship_summary, relationship_summary_json
         FROM simulation_sessions
         WHERE external_user_id = $1
           AND module_id = 'module1'
           AND persona_id = $2
           AND status = 'completed'
           AND relationship_summary IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT 1`,
        [externalUserId, personaId]
      );

      if (summaryResult.rows.length === 0) {
        return res.status(422).json({
          error: 'No relationship summary found from a passing Module 1 session for this persona.',
          details: { moduleId: 'module1', personaId },
        });
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

    // Attach relationship context for Module 2 sessions (used by frontend to inject into Tavus config)
    if (relationshipSummary) {
      session.relationship_context = {
        summary: relationshipSummary,
        summary_json: relationshipSummaryJson,
      };
    }

    console.log(`[Sessions] Created session ${session.id} for scenario ${scenarioId} (module: ${moduleId || 'none'}, persona: ${personaId || 'none'})`);

    res.status(201).json(session);
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: 'Unable to create session. Please try again.' });
  }
});

/**
 * GET /api/sessions/progress - Per-module, per-persona progress for the current user.
 * Computes attempts, scores, mastery status, and rolling averages.
 * Excludes legacy sessions from calculations.
 * Must be defined before /:id to prevent 'progress' matching as a session ID.
 */
router.get('/progress', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const userId = req.query.userId || (req.user && req.user.userId) || null;

    if (!userId) {
      return res.json({
        modules: {},
        certificate: { unlocked: false },
      });
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

    // Build mastery lookup: { "module1:sam_patel": { mastery_score: 85 } }
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

    // Certificate unlocked when ALL personas in ALL modules are mastered
    let allMastered = true;
    for (const mod of COURSE_MODULES) {
      for (const personaId of mod.personas) {
        const key = `${mod.id}:${personaId}`;
        if (!masteryLookup[key]) {
          allMastered = false;
          break;
        }
      }
      if (!allMastered) break;
    }

    res.json({
      modules,
      certificate: { unlocked: allMastered },
    });
  } catch (err) {
    console.error('[Sessions] Progress error:', err.message);
    res.status(500).json({ error: 'Unable to compute progress.' });
  }
});

/**
 * GET /api/sessions/:id - Get a session by ID.
 * Returns the full session record.
 */
router.get('/:id', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Sessions] Get error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve session.' });
  }
});

/**
 * PATCH /api/sessions/:id/status - Update session status.
 * Body: { status, tavusConversationId?, durationSeconds? }
 * Validates that the status transition is allowed.
 * Returns the updated session record.
 */
router.patch('/:id/status', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { status, tavusConversationId, durationSeconds } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    // Fetch current session to validate transition
    const current = await db.query(
      'SELECT id, status FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const currentStatus = current.rows[0].status;
    const allowedNext = STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || !allowedNext.includes(status)) {
      return res.status(422).json({
        error: `Cannot transition from '${currentStatus}' to '${status}'`,
      });
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

    console.log(`[Sessions] Session ${req.params.id}: ${currentStatus} -> ${status}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Sessions] Status update error:', err.message);
    res.status(500).json({ error: 'Unable to update session status.' });
  }
});

/**
 * POST /api/sessions/:id/fetch-transcript - Fetch transcript from Tavus and store it.
 * The server fetches the transcript with retries (Tavus needs time to finalize).
 * Stores both raw Tavus response and normalized transcript in session_transcripts.
 * Returns the normalized transcript text.
 */
router.post('/:id/fetch-transcript', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Look up the session to get the Tavus conversation ID
    const session = await db.query(
      'SELECT id, tavus_conversation_id, status FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { tavus_conversation_id: conversationId } = session.rows[0];

    if (!conversationId) {
      return res.status(422).json({ error: 'Session has no Tavus conversation ID' });
    }

    // Check if transcript already exists for this session
    const existing = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [req.params.id]
    );

    if (existing.rows.length > 0 && existing.rows[0].normalized_transcript) {
      console.log(`[Sessions] Transcript already stored for session ${req.params.id}`);
      return res.json({ transcript: existing.rows[0].normalized_transcript });
    }

    // Fetch transcript from Tavus with retry loop
    let transcript = null;
    let rawResponse = null;

    for (let attempt = 1; attempt <= MAX_TRANSCRIPT_ATTEMPTS; attempt++) {
      // Tavus needs time to process after call ends
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
      }

      console.log(`[Sessions] Fetching transcript, attempt ${attempt}/${MAX_TRANSCRIPT_ATTEMPTS}`);

      try {
        const data = await tavusFetch(`/conversations/${conversationId}`);
        rawResponse = JSON.stringify(data);

        // Use normalizer to extract transcript from vendor-specific fields
        const text = extractTranscript(data);

        if (text) {
          transcript = text;
          console.log(`[Sessions] Transcript retrieved (${text.length} chars)`);
          break;
        }

        console.log(`[Sessions] Transcript not ready yet, attempt ${attempt}`);
      } catch (fetchErr) {
        console.warn(`[Sessions] Transcript fetch error on attempt ${attempt}:`, fetchErr.message);
      }
    }

    if (!transcript) {
      console.warn(`[Sessions] Transcript unavailable after ${MAX_TRANSCRIPT_ATTEMPTS} attempts`);
      return res.json({ transcript: null });
    }

    // Store in session_transcripts table
    await db.query(
      `INSERT INTO session_transcripts (session_id, raw_transcript, normalized_transcript)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id)
       DO UPDATE SET raw_transcript = $2, normalized_transcript = $3`,
      [req.params.id, rawResponse, transcript]
    );

    console.log(`[Sessions] Transcript stored for session ${req.params.id}`);

    res.json({ transcript });
  } catch (err) {
    console.error('[Sessions] Fetch transcript error:', err.message);
    res.status(500).json({ error: 'Unable to fetch transcript.' });
  }
});

/**
 * POST /api/sessions/:id/process - Trigger backend post-call processing.
 * Starts the pipeline (fetch transcript -> score -> persist) asynchronously.
 * Returns immediately so the frontend can poll for completion.
 */
router.post('/:id/process', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Verify session exists and is in the right state
    const session = await db.query(
      'SELECT id, status FROM simulation_sessions WHERE id = $1',
      [req.params.id]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const currentStatus = session.rows[0].status;

    // Only allow processing from 'ended' status
    if (currentStatus !== 'ended') {
      return res.status(422).json({
        error: `Cannot process session in '${currentStatus}' status. Must be 'ended'.`,
      });
    }

    // Fire-and-forget: start processing, respond immediately
    processSession(req.params.id).catch((err) => {
      console.error(`[Sessions] Background processing failed for ${req.params.id}:`, err.message);
    });

    res.json({ status: 'processing', message: 'Post-call processing started' });
  } catch (err) {
    console.error('[Sessions] Process trigger error:', err.message);
    res.status(500).json({ error: 'Unable to start processing.' });
  }
});

/**
 * GET /api/sessions/:id/score - Retrieve stored scorecard.
 * Returns the parsed scorecard from session_scores table.
 */
router.get('/:id/score', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await db.query(
      `SELECT overall_score, overall_verdict, categories, top_strengths,
              critical_improvements, coaching_tip, raw_score, final_score,
              automatic_fails_triggered, created_at
       FROM session_scores WHERE session_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Score not found' });
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

    res.json(scorecard);
  } catch (err) {
    console.error('[Sessions] Get score error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve score.' });
  }
});

/**
 * GET /api/sessions/:id/coaching - Retrieve stored coaching analysis.
 * Returns the coaching_analysis JSONB from session_scores table.
 * 404 if no coaching analysis exists for this session.
 */
router.get('/:id/coaching', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await db.query(
      'SELECT coaching_analysis FROM session_scores WHERE session_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0 || !result.rows[0].coaching_analysis) {
      return res.status(404).json({ error: 'Coaching analysis not found' });
    }

    res.json({
      coaching_analysis: result.rows[0].coaching_analysis,
    });
  } catch (err) {
    console.error('[Sessions] Get coaching error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve coaching analysis.' });
  }
});

/**
 * GET /api/sessions/:id/transcript - Retrieve stored transcript.
 * Returns the normalized transcript text from session_transcripts table.
 * 404 if no transcript exists for this session.
 */
router.get('/:id/transcript', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await db.query(
      'SELECT normalized_transcript, created_at FROM session_transcripts WHERE session_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json({
      transcript: result.rows[0].normalized_transcript,
      createdAt: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('[Sessions] Get transcript error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve transcript.' });
  }
});

/**
 * GET /api/sessions/:id/perception - Returns stored perception analysis.
 * 404 if no perception data exists for this session.
 */
router.get('/:id/perception', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await db.query(
      `SELECT raw_analysis, normalized_analysis, source, created_at
       FROM session_perception_analysis WHERE session_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perception analysis not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Sessions] Get perception error:', err.message);
    res.status(500).json({ error: 'Unable to retrieve perception analysis.' });
  }
});

/**
 * POST /api/sessions/renormalize-all - Re-normalize all stored transcripts.
 * Runs existing raw_transcript data through the updated normalizer to fix
 * duplicates, em dashes, and interleaved text. One-time migration utility.
 */
// Tier 0: requireAuth enforces valid JWT. Tier 1 must add role/service authorization
// before exposing these endpoints beyond trusted operators.
router.post('/renormalize-all', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
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
        console.warn('[Sessions] Re-normalize parse error for session ' + row.session_id + ':', parseErr.message);
        skipped++;
      }
    }

    console.log('[Sessions] Re-normalization complete: ' + updated + ' updated, ' + skipped + ' skipped');
    res.json({ updated, skipped, total: result.rows.length });
  } catch (err) {
    console.error('[Sessions] Re-normalization error:', err.message);
    res.status(500).json({ error: 'Re-normalization failed.' });
  }
});

/**
 * POST /api/sessions/:id/generate-coaching - Generate coaching for an existing scored session.
 * Used to backfill coaching for sessions that were scored before the coaching feature existed.
 */
router.post('/:id/generate-coaching', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const sessionId = req.params.id;

    // Get transcript
    const txResult = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [sessionId]
    );
    if (txResult.rows.length === 0 || !txResult.rows[0].normalized_transcript) {
      return res.status(404).json({ error: 'Transcript not found for this session.' });
    }

    // Get scorecard
    const scoreResult = await db.query(
      'SELECT overall_score, overall_verdict, categories, top_strengths, critical_improvements, coaching_tip FROM session_scores WHERE session_id = $1',
      [sessionId]
    );
    if (scoreResult.rows.length === 0) {
      return res.status(404).json({ error: 'Score not found for this session.' });
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
      return res.status(500).json({ error: 'Coaching generation failed.' });
    }

    // Persist coaching analysis
    await db.query(
      'UPDATE session_scores SET coaching_analysis = $1 WHERE session_id = $2',
      [JSON.stringify(coaching), sessionId]
    );

    res.json({ success: true, coaching_analysis: coaching });
  } catch (err) {
    console.error('[Sessions] Generate coaching error:', err.message);
    res.status(500).json({ error: 'Unable to generate coaching analysis.' });
  }
});

/**
 * POST /api/sessions/:id/rescore - Re-score an existing session with the current rubric.
 * Used to backfill mechanical scoring for sessions scored with the old subjective rubric.
 */
router.post('/:id/rescore', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const sessionId = req.params.id;

    // Get transcript
    const txResult = await db.query(
      'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
      [sessionId]
    );
    if (txResult.rows.length === 0 || !txResult.rows[0].normalized_transcript) {
      return res.status(404).json({ error: 'Transcript not found for this session.' });
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
      return res.status(500).json({ error: 'Scoring failed.' });
    }

    // Persist new score
    const rawResponse = JSON.stringify(scorecard);
    const categories = JSON.stringify(scorecard.categories || {});
    const topStrengths = JSON.stringify(scorecard.top_strengths || []);
    const criticalImprovements = JSON.stringify(scorecard.critical_improvements || []);

    await db.query(
      `INSERT INTO session_scores
         (session_id, raw_response, overall_score, overall_verdict, categories, top_strengths, critical_improvements, coaching_tip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id)
       DO UPDATE SET
         raw_response = $2, overall_score = $3, overall_verdict = $4,
         categories = $5, top_strengths = $6, critical_improvements = $7, coaching_tip = $8`,
      [
        sessionId,
        rawResponse,
        scorecard.overall_score || 0,
        scorecard.overall_verdict || 'unknown',
        categories,
        topStrengths,
        criticalImprovements,
        scorecard.coaching_tip || '',
      ]
    );

    console.log(`[Sessions] Re-scored session ${sessionId}: ${scorecard.overall_score}/100`);
    res.json({ success: true, scorecard });
  } catch (err) {
    console.error('[Sessions] Rescore error:', err.message);
    res.status(500).json({ error: 'Unable to rescore session.' });
  }
});

/**
 * GET /api/sessions/admin/dashboard - Admin/Manager dashboard.
 * Protected by requireAuth + requireAnyRole('manager', 'admin').
 * Managers see only their cohort. Admins see all users.
 */
router.get('/admin/dashboard', requireAuth, requireAnyRole('manager', 'admin'), async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const isAdmin = req.user.role === 'admin';
    const cohortId = req.user.cohortId || null;

    // Managers must have a cohort. Fail closed if missing.
    if (!isAdmin && !cohortId) {
      return res.json({ users: [], summary: { totalUsers: 0, totalSessions: 0 } });
    }

    // Build user filter based on role
    let userFilter = '';
    const params = [];
    let paramIndex = 1;

    if (!isAdmin) {
      userFilter = `WHERE u.cohort_id = $${paramIndex}`;
      params.push(cohortId);
      paramIndex++;
    }

    // Aggregate per-user progress
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
       ${!isAdmin ? `WHERE s.external_user_id IN (SELECT u.external_id FROM users u WHERE u.cohort_id = $1)` : ''}
       AND s.module_id IS NOT NULL
       AND s.module_id != 'legacy'
       GROUP BY s.external_user_id, s.module_id, s.persona_id
       ORDER BY s.external_user_id`,
      !isAdmin ? [cohortId] : []
    );

    // Fetch masteries
    const masteriesResult = await db.query(
      `SELECT external_user_id, module_id, persona_id, mastery_score
       FROM module_masteries
       ${!isAdmin ? `WHERE external_user_id IN (SELECT u.external_id FROM users u WHERE u.cohort_id = $1)` : ''}`,
      !isAdmin ? [cohortId] : []
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

    res.json({
      users,
      summary: {
        totalUsers: users.length,
        totalSessions: result.rows.reduce((sum, r) => sum + parseInt(r.attempts, 10), 0),
      },
    });
  } catch (err) {
    console.error('[Sessions] Admin dashboard error:', err.message);
    res.status(500).json({ error: 'Unable to load dashboard.' });
  }
});

module.exports = router;
