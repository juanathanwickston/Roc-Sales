const express = require('express');
const db = require('../db');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/assignments — list all persona assignments
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT external_user_id, persona_id, assigned_by, created_at, updated_at FROM persona_assignments ORDER BY external_user_id'
    );
    return sendSuccess(res, { assignments: result.rows });
  } catch (err) {
    logger.error('Failed to list assignments', { error: err.message });
    return sendError(res, req, 500, 'Failed to list assignments');
  }
});

// GET /api/assignments/:userId
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId || typeof userId !== 'string') {
    return sendError(res, req, 400, 'userId is required');
  }

  try {
    const result = await db.query(
      'SELECT external_user_id, persona_id, assigned_by, created_at, updated_at FROM persona_assignments WHERE external_user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return sendError(res, req, 404, 'No assignment found for this user');
    }
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    logger.error('Failed to get assignment', { userId, error: err.message });
    return sendError(res, req, 500, 'Failed to get assignment');
  }
});

// PUT /api/assignments/:userId — create or update
router.put('/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { personaId } = req.body;

  if (!userId || typeof userId !== 'string') {
    return sendError(res, req, 400, 'userId is required');
  }
  if (!personaId || typeof personaId !== 'string') {
    return sendError(res, req, 400, 'personaId is required');
  }

  const validPersonas = ['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller'];
  if (!validPersonas.includes(personaId)) {
    return sendError(res, req, 400, 'Invalid personaId. Must be one of: ' + validPersonas.join(', '));
  }

  try {
    const assignedBy = req.user ? req.user.userId : 'system';
    await db.query(
      `INSERT INTO persona_assignments (external_user_id, persona_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (external_user_id)
       DO UPDATE SET persona_id = $2, assigned_by = $3`,
      [userId, personaId, assignedBy]
    );
    logger.info('Persona assigned', { userId, personaId, assignedBy });
    return sendSuccess(res, { userId, personaId });
  } catch (err) {
    logger.error('Failed to assign persona', { userId, error: err.message });
    return sendError(res, req, 500, 'Failed to assign persona');
  }
});

// DELETE /api/assignments/:userId
router.delete('/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId || typeof userId !== 'string') {
    return sendError(res, req, 400, 'userId is required');
  }

  try {
    const result = await db.query(
      'DELETE FROM persona_assignments WHERE external_user_id = $1',
      [userId]
    );
    if (result.rowCount === 0) {
      return sendError(res, req, 404, 'No assignment found for this user');
    }
    logger.info('Persona assignment removed', { userId });
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    logger.error('Failed to delete assignment', { userId, error: err.message });
    return sendError(res, req, 500, 'Failed to delete assignment');
  }
});

module.exports = router;
