/**
 * Tavus CVI API Proxy Routes
 * All Tavus API calls go through the server to keep the API key secure.
 * Pattern adapted from support_chatbot/app/api/chat.py
 */

const express = require('express');
const { config } = require('../config');

const router = express.Router();

/**
 * Internal helper — calls Tavus API with server-side API key.
 */
async function tavusFetch(path, options = {}) {
  const url = `${config.TAVUS_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.TAVUS_API_KEY,
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data.message || data.error || `Tavus API error: ${res.status}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── PERSONAS ───

/**
 * GET /api/tavus/personas — List available personas
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
 * GET /api/tavus/personas/:id — Get specific persona
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

// ─── CONVERSATIONS ───

/**
 * POST /api/tavus/conversations — Start a new call session
 * Body: { persona_id, conversation_name?, conversational_context?, properties? }
 */
router.post('/conversations', async (req, res) => {
  try {
    const {
      persona_id,
      replica_id,
      conversation_name,
      conversational_context,
      custom_greeting,
      properties,
      require_auth,
    } = req.body;

    if (!persona_id) {
      return res.status(400).json({ error: 'persona_id is required' });
    }

    const payload = {
      persona_id,
      ...(replica_id && { replica_id }),
      ...(conversation_name && { conversation_name }),
      ...(conversational_context && { conversational_context }),
      ...(custom_greeting && { custom_greeting }),
      ...(require_auth !== undefined && { require_auth }),
      properties: {
        max_call_duration: 1200, // 20 min default for training
        participant_left_timeout: 30,
        participant_absent_timeout: 120,
        enable_closed_captions: true,
        ...(properties || {}),
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
    res.json(data);
  } catch (err) {
    console.error('[Tavus] Create conversation error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to create conversation. Please try again.' });
  }
});

/**
 * GET /api/tavus/conversations/:id — Get conversation status
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const data = await tavusFetch(`/conversations/${req.params.id}`);
    res.json(data);
  } catch (err) {
    console.error('[Tavus] Get conversation error:', err.message);
    res.status(err.status || 500).json({ error: 'Unable to retrieve conversation.' });
  }
});

/**
 * DELETE /api/tavus/conversations/:id — End a conversation
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
