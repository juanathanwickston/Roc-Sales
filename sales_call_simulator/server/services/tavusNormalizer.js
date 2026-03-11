/**
 * Tavus Response Normalizer
 * Maps raw Tavus API responses to internal data models.
 * Isolates vendor-specific field names so downstream code uses stable internal shapes.
 * If Tavus changes their API, only this file needs updating.
 */

// Minimum transcript length to be considered valid
const MIN_TRANSCRIPT_LENGTH = 20;

// Tavus needs time to finalize the transcript after a call ends
const TRANSCRIPT_RETRY_DELAY_MS = 3000;
const MAX_TRANSCRIPT_ATTEMPTS = 4;

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

/**
 * Extract perception analysis data from a raw Tavus conversation response.
 * The verbose response includes an application.perception_analysis event
 * containing visual/behavioral analysis from Raven-1.
 * Returns the perception data object, or null if not available.
 */
function extractPerceptionAnalysis(rawConversation) {
  if (!rawConversation || typeof rawConversation !== 'object') {
    return null;
  }

  // Tavus returns perception data under these possible keys (verbose mode)
  const analysis = rawConversation.perception_analysis
    || rawConversation['application.perception_analysis']
    || (rawConversation.properties && rawConversation.properties.perception_analysis)
    || null;

  if (!analysis) {
    return null;
  }

  // Normalize to a consistent shape for downstream consumers
  return {
    raw: analysis,
    // If Tavus returns an array of query responses, map them
    queries: Array.isArray(analysis) ? analysis : [],
    // If Tavus returns a string summary, capture it
    summary: typeof analysis === 'string' ? analysis : null,
  };
}

module.exports = {
  extractTranscript,
  extractConversationMeta,
  extractPerceptionAnalysis,
  MIN_TRANSCRIPT_LENGTH,
  TRANSCRIPT_RETRY_DELAY_MS,
  MAX_TRANSCRIPT_ATTEMPTS,
};
