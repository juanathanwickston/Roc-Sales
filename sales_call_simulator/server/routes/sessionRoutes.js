/**
 * Session Management Routes
 * Tracks simulation sessions with explicit lifecycle statuses.
 */

const express = require('express');

const db = require('../db');
const { tavusFetch } = require('../services/tavusClient');
const { extractTranscript } = require('../services/tavusNormalizer');
const { processSession, generateCoachingAnalysis, scoreTranscript } = require('../services/postCallProcessor');

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
      `SELECT s.id, s.scenario_id, s.status, s.duration_seconds,
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
 * Body: { scenarioId }
 * Returns the created session record.
 */
router.post('/', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { scenarioId } = req.body;

    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required' });
    }

    // Use external user ID from JWT if available
    const externalUserId = req.user ? req.user.userId : null;

    const result = await db.query(
      `INSERT INTO simulation_sessions (scenario_id, external_user_id, status)
       VALUES ($1, $2, 'created')
       RETURNING id, scenario_id, external_user_id, status, created_at, updated_at`,
      [scenarioId, externalUserId]
    );

    const session = result.rows[0];
    console.log(`[Sessions] Created session ${session.id} for scenario ${scenarioId}`);

    res.status(201).json(session);
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: 'Unable to create session. Please try again.' });
  }
});

/**
 * GET /api/sessions/progress - Aggregate progress data for the current user.
 * Computes score trends, category progression, streaks, and per-scenario stats.
 * Returns sensible defaults when no sessions exist.
 * Must be defined before /:id to prevent 'progress' matching as a session ID.
 */
router.get('/progress', async (req, res) => {
  if (!db.isAvailable()) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Fetch all completed, scored sessions ordered by date (oldest first for trend)
    const userId = req.query.userId || (req.user && req.user.userId) || null;
    const conditions = ["s.status = 'completed'"];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`s.external_user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else {
      conditions.push(`s.external_user_id IS NULL`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(
      `SELECT s.id, s.scenario_id, s.duration_seconds, s.created_at,
              sc.overall_score, sc.overall_verdict, sc.categories
       FROM simulation_sessions s
       INNER JOIN session_scores sc ON sc.session_id = s.id
       ${whereClause}
       ORDER BY s.created_at ASC`,
      params
    );

    const sessions = result.rows;

    // Empty state
    if (sessions.length === 0) {
      return res.json({
        overall: {
          totalAttempts: 0, scoredAttempts: 0, bestScore: 0, averageScore: 0,
          latestScore: 0, previousScore: 0, passRate: 0, currentStage: 1,
          trend: [],
        },
        categories: {},
        streaks: { currentStreak: 0, bestStreak: 0, consecutivePasses: 0, lastImproved: false },
        perScenario: {},
      });
    }

    // Overall stats
    const scores = sessions.map(s => s.overall_score);
    const latestScore = scores[scores.length - 1];
    const previousScore = scores.length >= 2 ? scores[scores.length - 2] : 0;
    const bestScore = Math.max(...scores);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const passes = sessions.filter(s => s.overall_score >= 80);
    const passRate = Math.round((passes.length / sessions.length) * 100);

    // Trend (chronological)
    const trend = sessions.map(s => ({
      date: s.created_at,
      score: s.overall_score,
      sessionId: s.id,
    }));

    // Category aggregation
    const categories = {};
    for (const session of sessions) {
      const cats = session.categories || {};
      for (const [catName, catData] of Object.entries(cats)) {
        if (!categories[catName]) {
          categories[catName] = { scores: [], latest: 0, best: 0, average: 0 };
        }
        
        let catScore = 0;
        if (typeof catData === 'object' && catData !== null) {
          catScore = catData.score || 0;
        } else {
          catScore = Number(catData) || 0;
        }
        
        // Exclude completely abandoned zero scores so they don't skew historical metrics
        if (catScore > 0) {
          categories[catName].scores.push(catScore);
        }
      }
    }
    for (const [catName, catAgg] of Object.entries(categories)) {
      catAgg.latest = catAgg.scores[catAgg.scores.length - 1] || 0;
      catAgg.best = Math.max(...catAgg.scores);
      catAgg.average = Math.round(catAgg.scores.reduce((a, b) => a + b, 0) / catAgg.scores.length);
      catAgg.trend = catAgg.scores;
    }

    // Streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let consecutivePasses = 0;
    let tempPasses = 0;

    for (let i = 0; i < sessions.length; i++) {
      // Session streak (consecutive sessions)
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;

      // Pass streak
      if (sessions[i].overall_score >= 80) {
        tempPasses++;
        if (tempPasses > consecutivePasses) consecutivePasses = tempPasses;
      } else {
        tempPasses = 0;
      }
    }
    currentStreak = tempStreak;

    const lastImproved = scores.length >= 2 && scores[scores.length - 1] > scores[scores.length - 2];

    // Per-scenario stats
    const perScenario = {};
    for (const session of sessions) {
      const sid = session.scenario_id;
      if (!perScenario[sid]) {
        perScenario[sid] = { attempts: 0, bestScore: 0, latestScore: 0 };
      }
      perScenario[sid].attempts++;
      perScenario[sid].latestScore = session.overall_score;
      if (session.overall_score > perScenario[sid].bestScore) {
        perScenario[sid].bestScore = session.overall_score;
      }
    }

    // Determine current stage: advance past any stage whose scenario has a passing session
    const { SALES_STAGES } = require('../stages');
    let currentStage = 1;
    let attemptedStagesCount = 0;
    let masteryScoreSum = 0;
    let lowestBestScore = 101;
    let weakestStage = null;

    for (const stage of SALES_STAGES) {
      if (!stage.scenarioId) break; // No scenario = can't progress further
      
      const sBest = perScenario[stage.scenarioId] ? perScenario[stage.scenarioId].bestScore : null;
      if (sBest !== null) {
        attemptedStagesCount++;
        masteryScoreSum += sBest;
        
        if (sBest <= lowestBestScore) {
          lowestBestScore = sBest;
          weakestStage = stage.shortName;
        }
      }

      const hasPassed = sessions.some(
        s => s.scenario_id === stage.scenarioId && s.overall_verdict === 'pass'
      );
      if (hasPassed) {
        currentStage = stage.id + 1; // Advance past this stage
      } else {
        break; // Can't skip stages
      }
    }

    const masteryScore = attemptedStagesCount > 0 ? Math.round(masteryScoreSum / attemptedStagesCount) : 0;
    
    // We calculate a simulated 'previous mastery score' using only the `previousScore` variable from the latest session logic to give a general delta idea, but to be strictly accurate we will use previousScore for the entire dashboard shift, or simply compare mastery to a simulated previous block. Since `latestScore` and `previousScore` were single-session oriented, we will map them conceptually to mastery here for the progress ring delta.
    // For simplicity, we'll keep `latestScore` and `previousScore` in the response but provide `masteryScore`.
    const completedStages = currentStage > 1 ? currentStage - 1 : 0;

    res.json({
      overall: {
        totalAttempts: sessions.length,
        scoredAttempts: sessions.length,
        masteryScore,
        completedStages,
        weakestStage,
        bestScore,
        averageScore,
        latestScore,
        previousScore,
        passRate,
        currentStage,
        trend,
      },
      categories,
      streaks: {
        currentStreak,
        bestStreak,
        consecutivePasses,
        lastImproved,
      },
      perScenario,
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
              critical_improvements, coaching_tip, created_at
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
router.post('/renormalize-all', async (req, res) => {
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
router.post('/:id/generate-coaching', async (req, res) => {
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
router.post('/:id/rescore', async (req, res) => {
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

module.exports = router;
