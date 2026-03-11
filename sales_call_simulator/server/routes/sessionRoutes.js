/**
 * Session Management Routes
 * Tracks simulation sessions with explicit lifecycle statuses.
 */

const express = require('express');

const db = require('../db');
const { tavusFetch } = require('../services/tavusClient');

const router = express.Router();

// Tavus needs time to finalize the transcript after a call ends
const TRANSCRIPT_RETRY_DELAY_MS = 3000;
const MAX_TRANSCRIPT_ATTEMPTS = 4;
const MIN_TRANSCRIPT_LENGTH = 20;

// Valid session statuses and their allowed transitions
const STATUS_TRANSITIONS = {
  created: ['active', 'failed'],
  active: ['ended', 'failed'],
  ended: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: [],
};

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

        // Tavus may return transcript under different field names
        const text = data.transcript
          || data.conversation_transcript
          || data.call_transcript
          || (data.properties && data.properties.transcript)
          || null;

        if (text && typeof text === 'string' && text.length > MIN_TRANSCRIPT_LENGTH) {
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

module.exports = router;
