/**
 * Tavus Response Normalizer
 * Maps raw Tavus API responses to internal data models.
 * Isolates vendor-specific field names so downstream code uses stable internal shapes.
 * If Tavus changes their API, only this file needs updating.
 */

// Minimum transcript length to be considered valid
const MIN_TRANSCRIPT_LENGTH = 20;

/**
 * Extract the transcript text from a raw Tavus conversation response.
 * Tavus has returned the transcript under different field names across API versions.
 * Returns the transcript string, or null if not available or too short.
 */
function extractTranscript(rawConversation) {
  if (!rawConversation || typeof rawConversation !== 'object') {
    return null;
  }

  const text = rawConversation.transcript
    || rawConversation.conversation_transcript
    || rawConversation.call_transcript
    || (rawConversation.properties && rawConversation.properties.transcript)
    || null;

  if (!text || typeof text !== 'string' || text.length < MIN_TRANSCRIPT_LENGTH) {
    return null;
  }

  return text;
}

/**
 * Extract conversation metadata from a raw Tavus conversation response.
 * Returns a normalized object with stable field names for internal use.
 */
function extractConversationMeta(rawConversation) {
  if (!rawConversation || typeof rawConversation !== 'object') {
    return {};
  }

  return {
    conversationId: rawConversation.conversation_id || null,
    status: rawConversation.status || null,
    createdAt: rawConversation.created_at || null,
    endedAt: rawConversation.ended_at || null,
    participantLeftAt: rawConversation.participant_left_at || null,
    maxDuration: rawConversation.properties?.max_call_duration || null,
  };
}

module.exports = { extractTranscript, extractConversationMeta, MIN_TRANSCRIPT_LENGTH };
