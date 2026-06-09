/**
 * Tavus CVI API Proxy Routes
 * All Tavus API calls go through the server to keep the API key secure.
 * Responses are normalized into internal shapes before reaching the frontend.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { config } = require('../config');

const { tavusFetch } = require('../services/tavusClient');
const { extractConversationMeta } = require('../services/tavusNormalizer');

const router = express.Router();

// --- Personas ---

/**
 * GET /api/tavus/personas - List available personas.
 * Persona data is passed through without normalization because
 * persona config is authored by us, not by the Tavus runtime.
 */
router.get('/personas', async (req, res) => {
  try {
    const data = await tavusFetch('/personas');
    res.json(data);
  } catch (err) {
    console.error('[Tavus] List personas error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to load personas. Please try again.' });
  }
});

/**
 * GET /api/tavus/personas/:id - Get specific persona.
 * Persona data is passed through (see note above).
 */
router.get('/personas/:id', async (req, res) => {
  try {
    const data = await tavusFetch(`/personas/${req.params.id}`);
    res.json(data);
  } catch (err) {
    console.error('[Tavus] Get persona error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to load persona details.' });
  }
});

// --- Conversations ---

/**
 * POST /api/tavus/conversations - Start a new call session.
 * Body: { persona_id, conversation_name?, conversational_context?, properties? }
 * Returns normalized conversation data with stable internal field names.
 */
router.post('/conversations', async (req, res) => {
  try {
    const {
      sessionId,
      persona_id,
      replica_id,
      conversation_name,
      conversational_context,
      custom_greeting,
      properties,
      require_auth,
    } = req.body;

    const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');

    function loadScenarioConfig(scenarioId) {
      try {
        const files = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const scenario = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, file), 'utf8'));
          if (scenario.id === scenarioId) {
            return scenario;
          }
        }
      } catch (err) {
        console.warn(`[Tavus] Could not load scenario config for ${scenarioId}:`, err.message);
      }
      return null;
    }

    let personaId = persona_id;
    let replicaId = replica_id;
    let name = conversation_name;
    let context = conversational_context;
    let greeting = custom_greeting;
    let props = properties;
    let reqAuth = require_auth;

    if (sessionId) {
      if (!db.isAvailable()) {
        return res.status(503).json({ error: 'Database not available' });
      }

      // Load session from DB
      const sessionResult = await db.query(
        'SELECT * FROM simulation_sessions WHERE id = $1',
        [sessionId]
      );
      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = sessionResult.rows[0];

      // Validate ownership (if user authenticated)
      if (req.user && req.user.userId && session.external_user_id && session.external_user_id !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied: Session belongs to another user.' });
      }

      // Load scenario config
      const scenario = loadScenarioConfig(session.scenario_id);
      if (!scenario) {
        return res.status(404).json({ error: 'Scenario configuration not found.' });
      }

      personaId = scenario.persona_id_tavus || scenario.persona_id;
      replicaId = scenario.replica_id || null;

      const cfg = scenario.conversation_config || {};
      name = cfg.conversation_name || null;
      context = cfg.conversational_context || '';
      greeting = cfg.custom_greeting || null;
      props = cfg.properties || {};
      reqAuth = cfg.require_auth !== undefined ? cfg.require_auth : null;

      // Handle Module 2 continuity (retrieve and append relationship summary)
      if (session.module_id === 'module2' && session.persona_id) {
        const summaryResult = await db.query(
          `SELECT relationship_summary FROM simulation_sessions
           WHERE external_user_id = $1
             AND module_id = 'module1'
             AND persona_id = $2
             AND status = 'completed'
             AND relationship_summary IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1`,
          [session.external_user_id, session.persona_id]
        );

        if (summaryResult.rows.length > 0 && summaryResult.rows[0].relationship_summary) {
          const summaryText = summaryResult.rows[0].relationship_summary;
          context += `\n\n[CONTINUITY CONTEXT - PRIOR MEETING NOTES]:\nYou are continuing a conversation from a prior call. The following facts were established during Module 1. Do not contradict them and acknowledge them if referenced by the representative:\n${summaryText}\n[END PRIOR MEETING NOTES]`;
          console.log(`[Tavus] Continuity summary injected server-side for session ${sessionId}`);
        }
      }
    }

    if (!personaId) {
      return res.status(400).json({ error: 'persona_id (or sessionId) is required' });
    }

    // Fail-fast guard for placeholder Tavus IDs outside of local development
    if (config.NODE_ENV !== 'development' && personaId.startsWith('TAVUS_PERSONA_')) {
      return res.status(403).json({
        error: 'Simulation disabled: Scenario is using a placeholder Tavus Persona ID.',
        details: { persona_id: personaId }
      });
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
      },
    };

    const data = await tavusFetch('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // M7: User attribution logging
    const userId = req.user?.userId || 'unknown';
    const username = req.user?.username || 'anonymous';
    console.log(`[Tavus] Conversation created: ${data.conversation_id} by user ${username} (${userId})`);

    // Normalize before sending to frontend
    const meta = extractConversationMeta(data);
    res.json({
      conversationId: meta.conversationId,
      conversationUrl: data.conversation_url || null,
    });
  } catch (err) {
    console.error('[Tavus] Create conversation error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to create conversation. Please try again.' });
  }
});

/**
 * GET /api/tavus/conversations/:id - Get conversation status.
 * Returns normalized conversation metadata.
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const data = await tavusFetch(`/conversations/${req.params.id}`);
    const meta = extractConversationMeta(data);
    res.json(meta);
  } catch (err) {
    console.error('[Tavus] Get conversation error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to retrieve conversation.' });
  }
});

/**
 * DELETE /api/tavus/conversations/:id - End a conversation.
 * Returns our own status shape (Tavus DELETE has no body).
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    await tavusFetch(`/conversations/${req.params.id}`, { method: 'DELETE' });
    const userId = req.user?.userId || 'unknown';
    console.log(`[Tavus] Conversation ended: ${req.params.id} by user ${userId}`);
    res.json({ status: 'ended' });
  } catch (err) {
    console.error('[Tavus] End conversation error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to end conversation.' });
  }
});

module.exports = router;
