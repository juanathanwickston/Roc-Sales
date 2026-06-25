/**
 * Tavus CVI API Proxy Routes
 * All Tavus API calls go through the server to keep the API key secure.
 * Responses are normalized into internal shapes before reaching the frontend.
 */

const express = require('express');
const db = require('../db');
const { config } = require('../config');

const { tavusFetch } = require('../services/tavusClient');
const { extractConversationMeta } = require('../services/tavusNormalizer');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { getScenario } = require('../services/scenarioLoader');

const router = express.Router();



// --- Personas ---

/**
 * GET /api/tavus/personas - List available personas.
 */
router.get('/personas', requireAuth, async (req, res) => {
  try {
    const data = await tavusFetch('/personas');
    return sendSuccess(res, data);
  } catch (err) {
    logger.error('List personas error', { error: err.message, path: req.path });
    return sendError(res, req, err.status || 500, 'Unable to load personas. Please try again.');
  }
});

/**
 * GET /api/tavus/personas/:id - Get specific persona.
 */
router.get('/personas/:id', requireAuth, async (req, res) => {
  try {
    const data = await tavusFetch(`/personas/${req.params.id}`);
    return sendSuccess(res, data);
  } catch (err) {
    logger.error('Get persona error', { error: err.message, path: req.path });
    return sendError(res, req, err.status || 500, 'Unable to load persona details.');
  }
});

// --- Conversations ---

/**
 * POST /api/tavus/conversations - Start a new call session.
 * Body: { sessionId, properties? }
 * Returns normalized conversation data with stable internal field names.
 */
router.post('/conversations', requireAuth, async (req, res) => {
  if (!db.isAvailable()) {
    return sendError(res, req, 503, 'Database not available');
  }

  try {
    const { sessionId, properties } = req.body;

    if (!sessionId) {
      return sendError(res, req, 400, 'sessionId is required');
    }

    // Load session from DB
    const sessionResult = await db.query(
      'SELECT * FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return sendError(res, req, 404, 'Session not found');
    }

    const session = sessionResult.rows[0];

    // Validate ownership
    if (!req.user || !req.user.userId) {
      return sendError(res, req, 401, 'Authentication required');
    }

    if (session.external_user_id !== req.user.userId && req.user.role !== 'admin') {
      if (req.user.role === 'manager') {
        return sendError(res, req, 403, 'Access denied: cohort scoping is pending integration.');
      }
      return sendError(res, req, 403, 'Access denied: Session belongs to another user.');
    }

    // Load scenario config
    const scenario = getScenario(session.scenario_id);
    if (!scenario) {
      return sendError(res, req, 404, 'Scenario configuration not found.');
    }

    // Check if scenario is archived
    if (scenario.id.startsWith('archive/') || (scenario.status && scenario.status === 'archived')) {
      return sendError(res, req, 403, 'Cannot launch an archived scenario.');
    }

    const personaId = scenario.persona_id_tavus || scenario.persona_id;
    const replicaId = scenario.replica_id || null;

    const cfg = scenario.conversation_config || {};
    let name = cfg.conversation_name || null;
    let context = cfg.conversational_context || '';
    let greeting = cfg.custom_greeting || null;
    let props = cfg.properties || {};
    let reqAuth = cfg.require_auth !== undefined ? cfg.require_auth : null;

    // Handle Module 5 continuity (retrieve and append relationship summary)
    if (session.module_id === 'module5' && session.persona_id) {
      const summaryResult = await db.query(
        `SELECT s.relationship_summary FROM simulation_sessions s
         INNER JOIN session_scores sc ON sc.session_id = s.id
         WHERE s.external_user_id = $1
           AND s.module_id = 'module4'
           AND s.persona_id = $2
           AND s.status = 'completed'
           AND s.relationship_summary IS NOT NULL
           AND sc.final_score >= 80
           AND sc.overall_verdict = 'pass'
         ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
         LIMIT 1`,
        [session.external_user_id, session.persona_id]
      );

      if (summaryResult.rows.length > 0 && summaryResult.rows[0].relationship_summary) {
        const summaryText = summaryResult.rows[0].relationship_summary;
        context += `\n\n[CONTINUITY CONTEXT - PRIOR MEETING NOTES]:\nYou are continuing a conversation from a prior call. The following facts were established during Module 4. Do not contradict them and acknowledge them if referenced by the representative:\n${summaryText}\n[END PRIOR MEETING NOTES]`;
        logger.info('Continuity summary injected server-side', { sessionId });
      }
    }

    if (!personaId) {
      return sendError(res, req, 400, 'personaId resolved from scenario config is empty');
    }

    // Fail-fast guard for placeholder Tavus IDs outside of local development
    if (config.NODE_ENV !== 'development' && personaId.startsWith('TAVUS_PERSONA_')) {
      return sendError(res, req, 403, 'Simulation disabled: Scenario is using a placeholder Tavus Persona ID.');
    }

    const payload = {
      persona_id: personaId,
      ...(replicaId && { replica_id: replicaId }),
      ...(name && { conversation_name: name }),
      ...(context && { conversational_context: context }),
      ...(greeting && { custom_greeting: greeting }),
      ...(reqAuth !== null && reqAuth !== undefined && { require_auth: reqAuth }),
      properties: {
        max_call_duration: 600, // 10 min default for training
        participant_left_timeout: 30,
        participant_absent_timeout: 120,
        enable_closed_captions: true,
        ...(props || {}),
        ...(properties || {}), // Accept properties passed from the frontend for WebRTC setup
      },
    };

    const data = await tavusFetch('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const username = req.user.username || 'anonymous';
    logger.info('Tavus conversation created', { conversationId: data.conversation_id, username, userId: req.user.userId });

    // Normalize before sending to frontend
    const meta = extractConversationMeta(data);
    return sendSuccess(res, {
      conversationId: meta.conversationId,
      conversationUrl: data.conversation_url || null,
    });
  } catch (err) {
    logger.error('Create Tavus conversation error', { error: err.message, path: req.path });
    return sendError(res, req, err.status || 500, 'Unable to create conversation. Please try again.');
  }
});

module.exports = router;
