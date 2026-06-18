/**
 * Tavus Response Normalizer
 * Maps raw Tavus API responses to internal data models.
 * Isolates vendor-specific field names so downstream code uses stable internal shapes.
 * If Tavus changes their API, only this file needs updating.
 */

// Minimum transcript length to be considered valid
const MIN_TRANSCRIPT_LENGTH = 20;

// Tavus needs a brief window to finalize the transcript after a call ends
const TRANSCRIPT_INITIAL_DELAY_MS = 3000;
const TRANSCRIPT_RETRY_DELAY_MS = 5000;
const TRANSCRIPT_MAX_WAIT_MS = 300000; // 5 minutes total ceiling

/**
 * Find event properties in the Tavus verbose response events array.
 * Tavus verbose responses contain an events[] array where each event has:
 *   { event_type, properties, created_at, updated_at, message_type, timestamp }
 * Confirmed via diagnostic logs (commit a215c86).
 * Returns the properties object for the matching event, or null.
 */
function findEventProperties(rawConversation, eventType) {
  if (!rawConversation || !Array.isArray(rawConversation.events)) {
    return null;
  }

  const event = rawConversation.events.find((e) => e.event_type === eventType);
  return (event && event.properties) || null;
}

/**
 * Extract the transcript text from a raw Tavus verbose conversation response.
 * Transcript lives at: events[].properties.transcript
 * where event_type === 'application.transcription_ready'.
 * properties.transcript is an array of {role, content} objects.
 *
 * Tavus returns progressive/incremental entries: each update contains all
 * previous text plus new words. This function deduplicates by keeping only
 * the final (longest) version of consecutive same-role entries.
 *
 * Also strips em dashes and cleans whitespace for readability.
 *
 * Returns the transcript string, or null if not available or too short.
 */
function extractTranscript(rawConversation, personaName) {
  if (!rawConversation || typeof rawConversation !== 'object') {
    return null;
  }

  // Tavus verbose response: transcript is inside the events array
  const props = findEventProperties(rawConversation, 'application.transcription_ready');
  const raw = (props && props.transcript) || null;

  if (!raw) {
    return null;
  }

  let text;

  if (Array.isArray(raw)) {
    // Filter out system messages (Tavus internal instructions)
    const messages = raw.filter(function(msg) {
      return msg && msg.role && msg.role !== 'system' && msg.content;
    });

    // Deduplicate progressive entries:
    // Tavus sends incremental speech-to-text updates. Each update for the same
    // speaker contains all previous words plus new ones, but the raw entries can
    // have garbled/interleaved text at the end. Compare using first 5 words as
    // a fingerprint: if consecutive same-role entries share the same opening words,
    // keep only the longest (most complete) version.
    const deduplicated = [];
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const next = (i + 1 < messages.length) ? messages[i + 1] : null;

      if (next && next.role === current.role) {
        // Compare first 5 words of each entry
        const currentWords = current.content.trim().split(/\s+/).slice(0, 5).join(' ').toLowerCase();
        const nextWords = next.content.trim().split(/\s+/).slice(0, 5).join(' ').toLowerCase();

        if (currentWords === nextWords) {
          // Same opening words, same role - skip the shorter (current) entry
          continue;
        }
      }

      deduplicated.push(current);
    }

    // Map to readable format and clean text
    const lines = deduplicated.map(function(msg) {
      const role = msg.role === 'assistant' ? (personaName || 'Merchant') : 'Rep';
      const content = cleanTranscriptText(msg.content);
      return '[' + role + ']: ' + content;
    });

    text = lines.join('\n');
  } else if (typeof raw === 'string') {
    text = cleanTranscriptText(raw);
  } else {
    return null;
  }

  if (!text || text.length < MIN_TRANSCRIPT_LENGTH) {
    return null;
  }

  return text;
}

/**
 * Clean transcript text by stripping em dashes, collapsing whitespace,
 * and trimming lines. Preserves sentence structure.
 */
function cleanTranscriptText(text) {
  if (!text) return '';
  return text
    .replace(/\u2014/g, ', ')   // em dash
    .replace(/\u2013/g, ', ')   // en dash
    .replace(/---/g, ', ')      // triple hyphen used as em dash
    .replace(/--/g, ', ')       // double hyphen used as em dash
    .replace(/\s{2,}/g, ' ')    // collapse multiple spaces
    .trim();
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
 * Extract perception analysis data from a raw Tavus verbose conversation response.
 * Perception data lives at: events[].properties.analysis
 * where event_type === 'application.perception_analysis'.
 * properties contains a single key: "analysis" (confirmed via diagnostic logs).
 * Returns the perception data object, or null if not available.
 */
function extractPerceptionAnalysis(rawConversation) {
  if (!rawConversation || typeof rawConversation !== 'object') {
    return null;
  }

  // Tavus verbose response: perception is inside the events array
  const props = findEventProperties(rawConversation, 'application.perception_analysis');
  const analysis = (props && props.analysis) || null;

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
  TRANSCRIPT_INITIAL_DELAY_MS,
  TRANSCRIPT_RETRY_DELAY_MS,
  TRANSCRIPT_MAX_WAIT_MS,
};
