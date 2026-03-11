/**
 * Post-Call Processor
 * Backend service that orchestrates the full post-call pipeline:
 * fetch transcript -> score -> persist results -> update session status.
 *
 * This runs entirely server-side. The frontend triggers it via
 * POST /api/sessions/:id/process and polls for completion.
 */

const db = require('../db');
const { tavusFetch } = require('./tavusClient');
const { extractTranscript } = require('./tavusNormalizer');
const { config } = require('../config');

// Tavus needs time to finalize the transcript after a call ends
const TRANSCRIPT_RETRY_DELAY_MS = 3000;
const MAX_TRANSCRIPT_ATTEMPTS = 4;

/**
 * Process a completed call session.
 * Fetches transcript, scores it, persists everything, and updates session status.
 * This is the main entry point called by the route handler.
 */
async function processSession(sessionId) {
  console.log(`[PostCall] Processing session ${sessionId}`);

  // Transition to processing
  await updateStatus(sessionId, 'processing');

  try {
    // 1. Fetch transcript
    const transcript = await fetchAndStoreTranscript(sessionId);

    if (!transcript) {
      console.warn(`[PostCall] No transcript available for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 2. Load session to get scenario info
    const session = await db.query(
      'SELECT scenario_id FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    const scenarioId = session.rows[0]?.scenario_id || 'unknown';

    // 3. Score the transcript
    const scorecard = await scoreTranscript(transcript, scenarioId);

    if (!scorecard) {
      console.warn(`[PostCall] Scoring unavailable for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 4. Persist scoring results
    await persistScore(sessionId, scorecard);

    // 5. Mark session as completed
    await updateStatus(sessionId, 'completed');

    console.log(`[PostCall] Session ${sessionId} fully processed (score: ${scorecard.overall_score})`);
    return { status: 'completed', scored: true, overallScore: scorecard.overall_score };
  } catch (err) {
    console.error(`[PostCall] Processing failed for session ${sessionId}:`, err.message);
    await updateStatus(sessionId, 'failed').catch(() => {});
    return { status: 'failed', error: err.message };
  }
}

/**
 * Fetch transcript from Tavus and store in session_transcripts.
 * Returns the normalized transcript text, or null if unavailable.
 */
async function fetchAndStoreTranscript(sessionId) {
  // Check if transcript already exists
  const existing = await db.query(
    'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
    [sessionId]
  );

  if (existing.rows.length > 0 && existing.rows[0].normalized_transcript) {
    console.log(`[PostCall] Transcript already stored for session ${sessionId}`);
    return existing.rows[0].normalized_transcript;
  }

  // Get the Tavus conversation ID from the session
  const session = await db.query(
    'SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1',
    [sessionId]
  );

  const conversationId = session.rows[0]?.tavus_conversation_id;
  if (!conversationId) {
    console.warn(`[PostCall] No Tavus conversation ID for session ${sessionId}`);
    return null;
  }

  // Fetch from Tavus with retry loop
  let transcript = null;
  let rawResponse = null;

  for (let attempt = 1; attempt <= MAX_TRANSCRIPT_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
    }

    console.log(`[PostCall] Fetching transcript, attempt ${attempt}/${MAX_TRANSCRIPT_ATTEMPTS}`);

    try {
      const data = await tavusFetch(`/conversations/${conversationId}`);
      rawResponse = JSON.stringify(data);

      // Use normalizer to extract transcript from vendor-specific fields
      const text = extractTranscript(data);

      if (text) {
        transcript = text;
        console.log(`[PostCall] Transcript retrieved (${text.length} chars)`);
        break;
      }

      console.log(`[PostCall] Transcript not ready yet, attempt ${attempt}`);
    } catch (fetchErr) {
      console.warn(`[PostCall] Transcript fetch error on attempt ${attempt}:`, fetchErr.message);
    }
  }

  if (!transcript) {
    console.warn(`[PostCall] Transcript unavailable after ${MAX_TRANSCRIPT_ATTEMPTS} attempts`);
    return null;
  }

  // Store in session_transcripts
  await db.query(
    `INSERT INTO session_transcripts (session_id, raw_transcript, normalized_transcript)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id)
     DO UPDATE SET raw_transcript = $2, normalized_transcript = $3`,
    [sessionId, rawResponse, transcript]
  );

  console.log(`[PostCall] Transcript stored for session ${sessionId}`);
  return transcript;
}

/**
 * Score a transcript using the OpenAI scoring endpoint.
 * Returns the parsed scorecard object, or null if scoring is unavailable.
 */
async function scoreTranscript(transcript, scenarioId) {
  if (!config.OPENAI_API_KEY) {
    console.warn('[PostCall] OPENAI_API_KEY not configured - skipping scoring');
    return null;
  }

  // Load scenario rubric from file system
  const rubric = loadScenarioRubric(scenarioId);

  const prompt = buildScoringPrompt(transcript, rubric, scenarioId);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();

  try {
    const scorecard = JSON.parse(data.choices[0].message.content);
    console.log(`[PostCall] Scored scenario ${scenarioId}: overall ${scorecard.overall_score}/100`);
    return scorecard;
  } catch (parseErr) {
    console.error('[PostCall] Failed to parse OpenAI response:', parseErr.message);
    return null;
  }
}

/**
 * Load scenario rubric from the scenarios directory.
 * Returns the rubric object, or an empty object if not found.
 */
function loadScenarioRubric(scenarioId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const scenariosDir = path.join(__dirname, '..', 'scenarios');
    const files = fs.readdirSync(scenariosDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const scenario = JSON.parse(fs.readFileSync(path.join(scenariosDir, file), 'utf8'));
      if (scenario.id === scenarioId) {
        return scenario.rubric || {};
      }
    }
  } catch (err) {
    console.warn(`[PostCall] Could not load rubric for scenario ${scenarioId}:`, err.message);
  }

  return {};
}

/**
 * Build the scoring prompt from transcript and rubric.
 */
function buildScoringPrompt(transcript, rubric, scenarioId) {
  const rubricText = Object.entries(rubric)
    .map(([cat, details]) => {
      const weight = details.weight || 25;
      const criteria = details.criteria || cat;
      return `- ${cat} (${weight}% weight): ${criteria}`;
    })
    .join('\n');

  return {
    system: `You are an expert sales coach evaluating a sales call simulation. You are rigorous but constructive. You evaluate based on observable evidence in the transcript - not assumptions.

Score each rubric category on a scale of 0-100. Provide specific evidence from the transcript for each score. Be honest - a score of 50 means average, 70 means good, 90+ means exceptional.

Return a JSON object with this exact structure:
{
  "overall_score": <number 0-100>,
  "overall_verdict": "<pass|needs_work|fail>",
  "categories": {
    "<category_name>": {
      "score": <number 0-100>,
      "weight": <number>,
      "evidence": "<specific quote or behavior from transcript>",
      "feedback": "<what was done well and what to improve>",
      "verdict": "<strong|adequate|weak>"
    }
  },
  "top_strengths": ["<strength 1>", "<strength 2>"],
  "critical_improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "coaching_tip": "<one actionable tip for next time>"
}

Verdict thresholds: pass >= 70, needs_work 50-69, fail < 50`,

    user: `SCENARIO: ${scenarioId || 'Sales Call Simulation'}

RUBRIC:
${rubricText}

CALL TRANSCRIPT:
${transcript}

Evaluate this call against the rubric. Return JSON only.`,
  };
}

/**
 * Persist scoring results to session_scores table.
 * Maps scorecard fields to the schema defined in 001_core_schema.sql.
 */
async function persistScore(sessionId, scorecard) {
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

  console.log(`[PostCall] Score persisted for session ${sessionId}`);
}

/**
 * Update session status with validation.
 */
async function updateStatus(sessionId, status) {
  await db.query(
    'UPDATE simulation_sessions SET status = $2 WHERE id = $1',
    [sessionId, status]
  );
  console.log(`[PostCall] Session ${sessionId} -> ${status}`);
}

module.exports = { processSession };
