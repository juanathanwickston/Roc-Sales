/**
 * Session Management Routes
 * Tracks simulation sessions with explicit lifecycle statuses.
 */

const express = require('express');

const db = require('../db');

const router = express.Router();

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

module.exports = router;
