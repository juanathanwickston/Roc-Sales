/**
 * Post-Call Processor
 * Backend service that orchestrates the full post-call pipeline:
 * fetch transcript -> score -> persist results -> mastery check -> summary generation -> send completion callback -> update session status.
 *
 * This runs entirely server-side. The frontend triggers it via
 * POST /api/sessions/:id/process and polls for completion.
 */

const db = require('../db');
const fs = require('fs');
const path = require('path');
const { tavusFetch } = require('./tavusClient');
const {
  extractTranscript,
  extractPerceptionAnalysis,
  TRANSCRIPT_INITIAL_DELAY_MS,
  TRANSCRIPT_RETRY_DELAY_MS,
  TRANSCRIPT_MAX_WAIT_MS,
} = require('./tavusNormalizer');
const { sendCompletionCallback } = require('./academySync');
const { config } = require('../config');
const logger = require('../utils/logger');
const { getScenario } = require('./scenarioLoader');
const { PERSONA_FIRST_NAMES } = require('../modules');

// Timeout for OpenAI API requests (milliseconds)
const OPENAI_TIMEOUT_MS = 60000;

/**
 * Call OpenAI Chat Completions API with a timeout guard.
 * Returns the raw content string from the response, or throws on failure.
 */
async function callOpenAI(messages, temperature) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeoutId);
  }
}


/**
 * Process a completed call session.
 * Fetches transcript, scores it, persists everything, and updates session status.
 * This is the main entry point called by the route handler.
 */
async function processSession(sessionId) {
  logger.info(`[PostCall] Processing session ${sessionId}`);

  // Idempotency: check if already scored
  const existingScore = await db.query(
    'SELECT session_id FROM session_scores WHERE session_id = $1',
    [sessionId]
  );
  if (existingScore.rows.length > 0) {
    logger.info(`[PostCall] Session ${sessionId} already scored, skipping.`);
    return { status: 'completed', scored: true, skipped: true };
  }

  // Transition to processing
  await updateStatus(sessionId, 'processing');

  try {
    // 1. Load session metadata (needed for persona name in transcript labeling)
    const session = await db.query(
      'SELECT scenario_id, module_id, persona_id, external_user_id FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    const scenarioId = session.rows[0]?.scenario_id || 'unknown';
    const moduleId = session.rows[0]?.module_id || null;
    const personaId = session.rows[0]?.persona_id || null;
    const userId = session.rows[0]?.external_user_id || null;
    const personaName = PERSONA_FIRST_NAMES[personaId] || null;

    // 2. Fetch transcript (also stores raw conversation for perception extraction)
    const { transcript, rawConversationData } = await fetchAndStoreTranscript(sessionId, personaName);

    if (!transcript) {
      logger.warn(`[PostCall] No transcript available for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 3. Extract and persist perception analysis (non-blocking)
    await persistPerceptionAnalysis(sessionId, rawConversationData);

    // 4. Load scenario config (for auto-fail triggers)
    const scenarioConfig = getScenario(scenarioId) || {};

    // 5. Score the transcript
    const scorecard = await scoreTranscript(transcript, scenarioId);

    if (!scorecard) {
      logger.warn(`[PostCall] Scoring unavailable for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 6. Generate Coaching Analysis based on Scorecard
    const coachingAnalysis = await generateCoachingAnalysis({ transcript, scenarioId, scorecard });
    if (coachingAnalysis) {
      scorecard.coaching_analysis = coachingAnalysis;
    }

    // 7. Persist scoring results + mastery calculation in a transaction
    await persistScoreAndMastery(sessionId, scorecard, { moduleId, personaId, userId });

    // 8. Generate relationship summary if passing score and no auto-fails
    if (scorecard.final_score >= 80 && scorecard.overall_verdict === 'pass' &&
        (!scorecard.automatic_fails_triggered || scorecard.automatic_fails_triggered.length === 0)) {
      await generateAndPersistRelationshipSummary(sessionId, transcript, scenarioId, scenarioConfig);
    }

    // 9. Send completion callback (fire-and-forget)
    sendCompletionCallback({ sessionId, scorecard, scenarioId, userId }).catch(() => {});

    // 10. Mark session as completed
    await updateStatus(sessionId, 'completed');

    // Log metadata only - no PII, no transcripts, no summary text
    logger.info(`[PostCall] Session ${sessionId} fully processed (module: ${moduleId}, persona: ${personaId}, raw: ${scorecard.raw_score}, final: ${scorecard.final_score})`);
    return { status: 'completed', scored: true, overallScore: scorecard.final_score };
  } catch (err) {
    logger.error(`[PostCall] Processing failed for session ${sessionId}:`, err.message);
    await updateStatus(sessionId, 'failed').catch(() => {});
    return { status: 'failed', error: err.message };
  }
}

/**
 * Fetch transcript from Tavus and store in session_transcripts.
 * Returns the normalized transcript text, or null if unavailable.
 */
async function fetchAndStoreTranscript(sessionId, personaName) {
  // Check if transcript already exists
  const existing = await db.query(
    'SELECT normalized_transcript FROM session_transcripts WHERE session_id = $1',
    [sessionId]
  );

  if (existing.rows.length > 0 && existing.rows[0].normalized_transcript) {
    logger.info(`[PostCall] Transcript already stored for session ${sessionId}`);
    return { transcript: existing.rows[0].normalized_transcript, rawConversationData: null };
  }

  // Get the Tavus conversation ID from the session
  const session = await db.query(
    'SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1',
    [sessionId]
  );

  const conversationId = session.rows[0]?.tavus_conversation_id;
  if (!conversationId) {
    logger.warn(`[PostCall] No Tavus conversation ID for session ${sessionId}`);
    return { transcript: null, rawConversationData: null };
  }

  // Fetch from Tavus with retry loop (verbose=true for perception analysis data)
  // No fixed attempt limit - polls until data arrives or 5-minute ceiling
  let transcript = null;
  let rawResponse = null;
  let rawConversationData = null;

  // Initial delay: give Tavus a moment to finalize after call ends
  logger.info(`[PostCall] Waiting ${TRANSCRIPT_INITIAL_DELAY_MS / 1000}s before first transcript fetch...`);
  await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_INITIAL_DELAY_MS));

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < TRANSCRIPT_MAX_WAIT_MS) {
    attempt++;

    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.info(`[PostCall] Fetching transcript, attempt ${attempt} (${elapsed}s elapsed)`);

    try {
      const data = await tavusFetch(`/conversations/${conversationId}?verbose=true`);
      rawResponse = JSON.stringify(data);
      rawConversationData = data;

      // Use normalizer to extract transcript from vendor-specific fields
      const text = extractTranscript(data, personaName);

      if (text) {
        transcript = text;
        logger.info(`[PostCall] Transcript retrieved (${text.length} chars)`);
        break;
      }

      logger.info(`[PostCall] Transcript not ready yet, attempt ${attempt}`);
    } catch (fetchErr) {
      logger.warn(`[PostCall] Transcript fetch error on attempt ${attempt}:`, fetchErr.message);
    }
  }

  if (!transcript) {
    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    logger.warn(`[PostCall] Transcript unavailable after ${totalElapsed}s (${attempt} attempts)`);
    return { transcript: null, rawConversationData };
  }

  // Store in session_transcripts
  await db.query(
    `INSERT INTO session_transcripts (session_id, raw_transcript, normalized_transcript)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id)
     DO UPDATE SET raw_transcript = $2, normalized_transcript = $3`,
    [sessionId, rawResponse, transcript]
  );

  logger.info(`[PostCall] Transcript stored for session ${sessionId}`);
  return { transcript, rawConversationData };
}

/**
 * Extract and persist Tavus perception analysis data.
 * Non-blocking: failure does not prevent scoring or completion.
 * Sets perception_status to 'ready' on success or 'skipped' on failure/absence.
 */
async function persistPerceptionAnalysis(sessionId, rawConversationData) {
  try {
    if (!rawConversationData) {
      await updatePerceptionStatus(sessionId, 'skipped');
      return;
    }

    const perception = extractPerceptionAnalysis(rawConversationData);

    if (!perception) {
      logger.info(`[PostCall] No perception analysis data for session ${sessionId}`);
      await updatePerceptionStatus(sessionId, 'skipped');
      return;
    }

    await db.query(
      `INSERT INTO session_perception_analysis (session_id, raw_analysis, normalized_analysis)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id)
       DO UPDATE SET raw_analysis = $2, normalized_analysis = $3`,
      [sessionId, JSON.stringify(perception.raw), JSON.stringify(perception)]
    );

    await updatePerceptionStatus(sessionId, 'ready');
    logger.info(`[PostCall] Perception analysis stored for session ${sessionId}`);
  } catch (err) {
    logger.warn(`[PostCall] Perception analysis failed for session ${sessionId}:`, err.message);
    await updatePerceptionStatus(sessionId, 'skipped').catch(() => {});
  }
}

/**
 * Update the perception_status column on a session.
 */
async function updatePerceptionStatus(sessionId, status) {
  await db.query(
    'UPDATE simulation_sessions SET perception_status = $1 WHERE id = $2',
    [status, sessionId]
  );
}



/**
 * Score a transcript using the OpenAI scoring endpoint.
 * Returns the parsed scorecard object, or null if scoring is unavailable.
 * Includes GPT validation with single retry on malformed response.
 */
async function scoreTranscript(transcript, scenarioId) {
  if (!config.OPENAI_API_KEY) {
    logger.warn('[PostCall] OPENAI_API_KEY not configured - skipping scoring');
    return null;
  }

  // Load scenario rubric and auto-fail triggers from file system
  const scenarioConfig = getScenario(scenarioId) || {};
  const rubric = scenarioConfig.rubric || {};
  const autoFailTriggers = scenarioConfig.auto_fail_triggers || [];

  const prompt = buildScoringPrompt(transcript, rubric, scenarioId, autoFailTriggers);

  let extraction = null;

  // First attempt
  extraction = await callOpenAIForScoring(prompt);

  // Validate response structure
  if (extraction && !validateScoringResponse(extraction, rubric)) {
    logger.warn('[PostCall] Malformed GPT response on first attempt, retrying with correction...');

    // Retry with correction prompt
    const correctionPrompt = buildCorrectionPrompt(extraction, rubric);
    extraction = await callOpenAIForScoring(correctionPrompt);

    if (extraction && !validateScoringResponse(extraction, rubric)) {
      logger.error('[PostCall] Malformed GPT response on retry. Scoring failed.');
      return null;
    }
  }

  if (!extraction) {
    return null;
  }

  const scorecard = calculateMechanicalScore(extraction, rubric, autoFailTriggers);
  logger.info(`[PostCall] Scored scenario ${scenarioId}: raw ${scorecard.raw_score}, final ${scorecard.final_score}`);
  return scorecard;
}

/**
 * Call OpenAI API for scoring extraction.
 * Returns the parsed JSON extraction, or null on failure.
 */
async function callOpenAIForScoring(prompt) {
  try {
    const content = await callOpenAI([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], 0.2);
    return JSON.parse(content);
  } catch (err) {
    logger.error('[PostCall] OpenAI scoring call failed:', err.message);
    return null;
  }
}

/**
 * Validate the GPT scoring response has the expected structure.
 * Returns true if valid, false if malformed.
 */
function validateScoringResponse(extraction, rubric) {
  if (!extraction || typeof extraction !== 'object') return false;
  if (!extraction.checklist || typeof extraction.checklist !== 'object') return false;

  // Check that all behavior IDs from rubric are present in checklist
  for (const [, catData] of Object.entries(rubric)) {
    const behaviors = catData.behaviors || [];
    for (const b of behaviors) {
      if (!extraction.checklist[b.id]) return false;
      if (typeof extraction.checklist[b.id].observed !== 'boolean') return false;
    }
  }

  return true;
}

/**
 * Build a correction prompt for retry when GPT returns malformed JSON.
 */
function buildCorrectionPrompt(malformedResponse, rubric) {
  const behaviorIds = [];
  for (const [, catData] of Object.entries(rubric)) {
    for (const b of (catData.behaviors || [])) {
      behaviorIds.push(b.id);
    }
  }

  return {
    system: `Your previous response was malformed. You MUST return a JSON object with a "checklist" property containing entries for ALL of these behavior IDs: ${behaviorIds.join(', ')}. Each entry must have "observed" (boolean) and "evidence" (string) fields. Also include "top_strengths" (array of 2 strings), "critical_improvements" (array of 3 strings), "coaching_tip" (string), and "auto_fail_checks" (object with boolean values for each auto-fail trigger). Fix the response.`,
    user: `Here was your malformed response:\n${JSON.stringify(malformedResponse)}\n\nPlease fix it and return valid JSON.`,
  };
}

/**
 * Build the scoring prompt from transcript and behavioral checklist rubric.
 * GPT-4o only observes YES/NO per behavior with exact transcript quotes.
 * Score calculation happens server-side in calculateMechanicalScore.
 * Also includes auto-fail trigger checks.
 */
function buildScoringPrompt(transcript, rubric, scenarioId, autoFailTriggers) {
  // Build behavior list from rubric
  const behaviorList = [];
  for (const [catName, catData] of Object.entries(rubric)) {
    const behaviors = catData.behaviors || [];
    for (const b of behaviors) {
      behaviorList.push(`- ${b.id}: ${b.description}`);
    }
  }
  const behaviorText = behaviorList.join('\n');

  // Build auto-fail trigger list
  const autoFailText = autoFailTriggers.length > 0
    ? autoFailTriggers.map(af => `- ${af.check}: ${af.description}`).join('\n')
    : 'None';

  return {
    system: `You are an expert sales call evaluator. Your ONLY job is to determine whether specific behaviors were observed in the transcript.

RULES:
1. For each behavior, determine if it was OBSERVED or NOT OBSERVED in the transcript.
2. If OBSERVED, provide the EXACT quote from the transcript as evidence. Copy the words verbatim.
3. If NOT OBSERVED, set evidence to "NOT OBSERVED". Do not infer or assume.
4. Do NOT paraphrase. Do NOT summarize. Only use exact words from the transcript.
5. A behavior is only OBSERVED if there is a direct, literal quote that proves it.
6. Also provide top_strengths (2 items) and critical_improvements (3 items) based ONLY on observed evidence.
7. Provide a single coaching_tip with one actionable recommendation.
8. For each auto-fail trigger, determine if it was triggered (true) or not (false).

Return a JSON object with this exact structure:
{
  "checklist": {
    "<behavior_id>": {
      "observed": true|false,
      "evidence": "<exact transcript quote or NOT OBSERVED>"
    }
  },
  "auto_fail_checks": {
    "<trigger_check_id>": true|false
  },
  "top_strengths": ["<strength based on observed evidence>", "<strength based on observed evidence>"],
  "critical_improvements": ["<improvement based on missing behaviors>", "<improvement>", "<improvement>"],
  "coaching_tip": "<one actionable tip>"
}`,

    user: `SCENARIO: ${scenarioId || 'Sales Call Simulation'}

BEHAVIORS TO EVALUATE:
${behaviorText}

AUTO-FAIL TRIGGERS TO CHECK:
${autoFailText}

CALL TRANSCRIPT:
${transcript}

Evaluate each behavior and auto-fail trigger. Return JSON only.`,
  };
}

/**
 * Calculate mechanical score from GPT-4o checklist extraction and rubric behaviors.
 * Computes raw_score from behaviors, checks auto-fail triggers.
 * If any auto-fail is triggered, final_score = 0 and overall_verdict = 'fail'.
 * Returns a backward-compatible scorecard object.
 */
function calculateMechanicalScore(extraction, rubric, autoFailTriggers) {
  const checklist = extraction.checklist || {};
  let totalScore = 0;
  const categories = {};

  for (const [catName, catData] of Object.entries(rubric)) {
    const behaviors = catData.behaviors || [];
    let catEarned = 0;
    let catPossible = 0;
    const observed = [];
    const missed = [];

    for (const b of behaviors) {
      catPossible += b.points;
      const result = checklist[b.id];
      if (result && result.observed === true) {
        catEarned += b.points;
        observed.push(b.id);
      } else {
        missed.push(b.id);
      }
    }

    totalScore += catEarned;
    const catPct = catPossible > 0 ? Math.round((catEarned / catPossible) * 100) : 0;
    const verdict = catPct >= 70 ? 'strong' : (catPct >= 50 ? 'adequate' : 'weak');

    categories[catName] = {
      score: catPct,
      weight: catData.weight,
      earned: catEarned,
      possible: catPossible,
      observed_count: observed.length,
      total_count: behaviors.length,
      verdict: verdict,
      evidence: behaviors.reduce(function(acc, b) {
        if (checklist[b.id]) acc[b.id] = checklist[b.id];
        return acc;
      }, {}),
    };
  }

  // Raw score is the sum of earned behavior points
  const rawScore = totalScore;

  // Check auto-fail triggers
  const autoFailChecks = extraction.auto_fail_checks || {};
  const triggeredFails = [];

  for (const af of autoFailTriggers) {
    if (autoFailChecks[af.check] === true) {
      triggeredFails.push({ id: af.id, check: af.check, description: af.description });
    }
  }

  // If any auto-fail is triggered, final_score = 0 and verdict = fail
  const hasAutoFail = triggeredFails.length > 0;
  const finalScore = hasAutoFail ? 0 : rawScore;
  const overallVerdict = (finalScore >= 80) ? 'pass' : 'fail';

  return {
    overall_score: finalScore,
    overall_verdict: overallVerdict,
    raw_score: rawScore,
    final_score: finalScore,
    automatic_fails_triggered: triggeredFails,
    categories: categories,
    checklist: checklist,
    top_strengths: extraction.top_strengths || [],
    critical_improvements: extraction.critical_improvements || [],
    coaching_tip: extraction.coaching_tip || '',
  };
}

/**
 * Insert or update a score row within an open transaction.
 * Serializes all scorecard fields and runs the INSERT/ON CONFLICT query.
 * Must be called inside a BEGIN/COMMIT block.
 */
async function insertScore(client, sessionId, scorecard) {
  const rawResponse = JSON.stringify(scorecard);
  const categories = JSON.stringify(scorecard.categories || {});
  const topStrengths = JSON.stringify(scorecard.top_strengths || []);
  const criticalImprovements = JSON.stringify(scorecard.critical_improvements || []);
  const coachingAnalysis = scorecard.coaching_analysis ? JSON.stringify(scorecard.coaching_analysis) : null;
  const autoFails = JSON.stringify(scorecard.automatic_fails_triggered || []);

  await client.query(
    `INSERT INTO session_scores
       (session_id, raw_response, overall_score, overall_verdict, categories,
        top_strengths, critical_improvements, coaching_tip, coaching_analysis,
        raw_score, final_score, automatic_fails_triggered, rubric_version, scoring_model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (session_id)
     DO UPDATE SET
       raw_response = $2, overall_score = $3, overall_verdict = $4,
       categories = $5, top_strengths = $6, critical_improvements = $7,
       coaching_tip = $8, coaching_analysis = $9,
       raw_score = $10, final_score = $11, automatic_fails_triggered = $12,
       rubric_version = $13, scoring_model = $14`,
    [
      sessionId,
      rawResponse,
      scorecard.final_score || 0,
      scorecard.overall_verdict || 'unknown',
      categories,
      topStrengths,
      criticalImprovements,
      scorecard.coaching_tip || '',
      coachingAnalysis,
      scorecard.raw_score || 0,
      scorecard.final_score || 0,
      autoFails,
      '1.0',
      'gpt-4o',
    ]
  );
}

/**
 * Calculate rolling average mastery and upsert into module_masteries.
 * Skips if any required ID is missing or if module is 'legacy'.
 * Must be called inside a BEGIN/COMMIT block.
 */
async function updateMastery(client, sessionId, scorecard, { moduleId, personaId, userId }) {
  if (!moduleId || !personaId || !userId || moduleId === 'legacy') return;

  const recentSessions = await client.query(
    `SELECT s.id, COALESCE(sc.final_score, sc.overall_score) AS effective_score
     FROM simulation_sessions s
     INNER JOIN session_scores sc ON sc.session_id = s.id
     WHERE s.external_user_id = $1
       AND s.module_id = $2
       AND s.persona_id = $3
       AND s.status = 'completed'
     ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
     LIMIT 3`,
    [userId, moduleId, personaId]
  );

  // Include the current session (it may not yet be marked 'completed')
  const allScores = [];
  const allSessionIds = [];
  let currentIncluded = false;

  for (const row of recentSessions.rows) {
    if (row.id === parseInt(sessionId, 10)) currentIncluded = true;
    allScores.push(parseFloat(row.effective_score));
    allSessionIds.push(row.id);
  }

  if (!currentIncluded) {
    allScores.unshift(scorecard.final_score || 0);
    allSessionIds.unshift(parseInt(sessionId, 10));
    if (allScores.length > 3) {
      allScores.pop();
      allSessionIds.pop();
    }
  }

  if (allScores.length === 0) return;

  const rollingAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  if (rollingAvg < 80) return;

  await client.query(
    `INSERT INTO module_masteries
       (external_user_id, module_id, persona_id, mastery_score, source_session_ids)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (external_user_id, module_id, persona_id)
     DO UPDATE SET
       mastery_score = $4,
       source_session_ids = $5,
       mastered_at = NOW()`,
    [userId, moduleId, personaId, Math.round(rollingAvg * 100) / 100, allSessionIds]
  );

  logger.info(`[PostCall] Mastery updated for ${userId}/${moduleId}/${personaId}: ${Math.round(rollingAvg * 100) / 100}`);
}

/**
 * Persist scoring results and calculate mastery in a single transaction.
 * Uses db.getClient() for transaction boundaries.
 */
async function persistScoreAndMastery(sessionId, scorecard, { moduleId, personaId, userId }) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await insertScore(client, sessionId, scorecard);
    await updateMastery(client, sessionId, scorecard, { moduleId, personaId, userId });
    await client.query('COMMIT');
    logger.info(`[PostCall] Score persisted for session ${sessionId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`[PostCall] Score/mastery persist failed for session ${sessionId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generate and persist a relationship summary for passing sessions.
 * Extracts only factual business parameters: discovered_facts, operational_pain_points, merchant_confirmed_details.
 * Constrained to max 5 bullet points and under 1500 characters.
 */
async function generateAndPersistRelationshipSummary(sessionId, transcript, scenarioId, scenarioConfig) {
  if (!config.OPENAI_API_KEY) {
    logger.warn('[PostCall] Relationship summary skipped: no OpenAI API key');
    return;
  }

  try {
    const personaName = scenarioConfig.name || scenarioId;
    const product = scenarioConfig.product || 'Payroc solution';

    const prompt = {
      system: `You are a data extraction assistant. Extract ONLY factual business parameters that were explicitly discussed and confirmed by the merchant during this sales call. Do NOT infer, assume, or add information not stated in the transcript.

Return valid JSON with this exact structure:
{
  "discovered_facts": ["<fact 1>", "<fact 2>"],
  "operational_pain_points": ["<pain point 1>", "<pain point 2>"],
  "merchant_confirmed_details": ["<detail 1>", "<detail 2>"]
}

RULES:
- Maximum 5 bullet points total across all three categories.
- Total output must be under 1500 characters.
- Only include facts the merchant explicitly stated or confirmed.
- Do not paraphrase extensively. Use the merchant's language where possible.
- Do not include the rep's assumptions or claims.`,
      user: `SCENARIO: ${personaName}
PRODUCT: ${product}

CALL TRANSCRIPT:
${transcript}

Extract the relationship summary. Return JSON only.`,
    };

    const rawContent = await callOpenAI([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], 0.2);

    let summaryJson;

    try {
      summaryJson = JSON.parse(rawContent);
    } catch (parseErr) {
      logger.error('[PostCall] Failed to parse relationship summary response:', parseErr.message);
      return;
    }

    // Validate structure
    if (!summaryJson.discovered_facts && !summaryJson.operational_pain_points && !summaryJson.merchant_confirmed_details) {
      logger.warn('[PostCall] Relationship summary has no expected fields, skipping.');
      return;
    }

    // Build markdown text summary
    const markdownParts = [];
    if (summaryJson.discovered_facts && summaryJson.discovered_facts.length > 0) {
      markdownParts.push('**Discovered Facts:**');
      summaryJson.discovered_facts.forEach(f => markdownParts.push(`- ${f}`));
    }
    if (summaryJson.operational_pain_points && summaryJson.operational_pain_points.length > 0) {
      markdownParts.push('**Operational Pain Points:**');
      summaryJson.operational_pain_points.forEach(p => markdownParts.push(`- ${p}`));
    }
    if (summaryJson.merchant_confirmed_details && summaryJson.merchant_confirmed_details.length > 0) {
      markdownParts.push('**Merchant Confirmed Details:**');
      summaryJson.merchant_confirmed_details.forEach(d => markdownParts.push(`- ${d}`));
    }
    const markdownSummary = markdownParts.join('\n');

    // Persist to session
    await db.query(
      `UPDATE simulation_sessions
       SET relationship_summary = $1,
           relationship_summary_json = $2,
           completed_at = NOW()
       WHERE id = $3`,
      [markdownSummary, JSON.stringify(summaryJson), sessionId]
    );

    // Log metadata only - no PII or summary text
    logger.info(`[PostCall] Relationship summary persisted for session ${sessionId} (summary_present: true, summary_length: ${markdownSummary.length})`);
  } catch (err) {
    logger.error(`[PostCall] Relationship summary generation failed for session ${sessionId}:`, err.message);
    // Non-blocking: do not throw
  }
}

/**
 * Update session status with validation.
 */
async function updateStatus(sessionId, status) {
  const setClauses = ['status = $2'];
  const params = [sessionId, status];

  // Set completed_at when moving to completed status
  if (status === 'completed') {
    setClauses.push('completed_at = COALESCE(completed_at, NOW())');
  }

  await db.query(
    `UPDATE simulation_sessions SET ${setClauses.join(', ')} WHERE id = $1`,
    params
  );
  logger.info(`[PostCall] Session ${sessionId} -> ${status}`);
}

/**
 * Load curriculum source material for a scenario.
 * Reads the corresponding .md file from the curriculum/ directory.
 * Returns the curriculum text, or a generic fallback if not found.
 */
function loadCurriculum(scenarioId) {
  try {

    const curriculumDir = path.join(__dirname, '..', 'curriculum');

    // Map scenarioId to curriculum filename: module4_identifying_customer -> module4_identifying_customer.md
    const filePath = path.join(curriculumDir, scenarioId + '.md');

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }

    // Fallback: list available files
    logger.warn(`[PostCall] No curriculum found for scenario ${scenarioId}`);
  } catch (err) {
    logger.warn(`[PostCall] Could not load curriculum for scenario ${scenarioId}:`, err.message);
  }

  return 'No specific curriculum available for this module. Evaluate based on general sales best practices.';
}

/**
 * Build the coaching prompt from transcript, curriculum, and scorecard.
 * Produces 5 sections: call_overview, coaches_analysis, playbook, stats, next_call_focus.
 * Strict language constraints: no em dashes, no emojis, no exclamation marks.
 */
function buildCoachingPrompt({ transcript, curriculum, scorecard, scenarioId }) {
  const scoreSummary = `Overall Score: ${scorecard.final_score || scorecard.overall_score}/100 (${scorecard.overall_verdict})
Raw Score: ${scorecard.raw_score || scorecard.overall_score}/100
Top Strengths: ${(scorecard.top_strengths || []).join('; ')}
Critical Improvements: ${(scorecard.critical_improvements || []).join('; ')}
Coaching Tip: ${scorecard.coaching_tip || 'N/A'}
Auto-Fail Triggers: ${(scorecard.automatic_fails_triggered || []).length > 0 ? scorecard.automatic_fails_triggered.map(af => af.description).join('; ') : 'None'}`;

  // Build stats from checklist if available
  let statsContext = '';
  if (scorecard.categories) {
    statsContext = Object.entries(scorecard.categories)
      .map(([name, data]) => `${name}: ${data.observed_count || 0}/${data.total_count || 0} behaviors observed`)
      .join('\n');
  }

  return {
    system: `You are an expert sales coach providing detailed, constructive feedback on a sales call simulation. You have access to the training curriculum and the scorecard results.

LANGUAGE RULES (strict, no exceptions):
- Do NOT use em dashes, en dashes, or double hyphens. Use commas or periods instead.
- Do NOT use emojis or unicode symbols.
- Do NOT use exclamation marks.
- Use professional, direct tone. Like a sharp sales manager in a coaching session.
- Commas and periods only for punctuation.

ANTI-HALLUCINATION RULES (strict, no exceptions):
- Every claim about what the rep did or said MUST include an exact quote from the transcript.
- If a behavior was NOT observed, say so explicitly. Do not infer or assume it happened.
- Do NOT paraphrase the transcript. Use exact words.
- If the rep did not do something, state that they did not do it.

Your coaching analysis must directly reference the curriculum source material:
- Reference specific frameworks (BANT, CHAMP) when relevant.
- Reference the sales funnel stages (Suspect, Lead, Prospect) when relevant.
- Reference the successful outcome criteria from the curriculum.
- Reference customer-focused vs product-focused selling distinctions.

Return valid JSON with this exact structure:
{
  "call_overview": "<2-3 sentences about what happened on the call. Include only facts supported by the transcript.>",
  "coaches_analysis": "<paragraph explaining how the rep's performance maps to the curriculum. Reference specific curriculum concepts. Note what was done well and what was missed.>",
  "playbook": [
    {
      "situation": "<brief label for the moment>",
      "what_you_said": "<exact quote from transcript>",
      "what_to_say": "<scripted alternative the rep can memorize and practice>"
    }
  ],
  "next_call_focus": "<one single priority for the next call. Not two, not three. One.>"
}

Include 3-4 playbook items. For each, use the rep's EXACT words in what_you_said, and provide a ready-to-use script in what_to_say that follows the curriculum's teaching.`,

    user: `SCENARIO: ${scenarioId || 'Sales Call Simulation'}

CURRICULUM SOURCE MATERIAL:
${curriculum}

SCORECARD RESULTS:
${scoreSummary}

BEHAVIOR STATS:
${statsContext}

CALL TRANSCRIPT:
${transcript}

Generate the coaching analysis. Return JSON only.`,
  };
}

/**
 * Generate coaching analysis for a session using GPT-4o.
 * Takes transcript, scenarioId, and scorecard as an options object.
 * Returns the coaching JSON, or null on failure.
 */
async function generateCoachingAnalysis({ transcript, scenarioId, scorecard }) {
  if (!config.OPENAI_API_KEY) {
    logger.warn('[PostCall] Coaching skipped: no OpenAI API key');
    return null;
  }

  if (!transcript) {
    logger.warn('[PostCall] Coaching skipped: no transcript');
    return null;
  }

  try {
    const curriculum = loadCurriculum(scenarioId);
    const prompt = buildCoachingPrompt({ transcript, curriculum, scorecard, scenarioId });

    logger.info(`[PostCall] Generating coaching analysis for scenario ${scenarioId}...`);

    const rawContent = await callOpenAI([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], 0.4);

    try {
      const coaching = JSON.parse(rawContent);
      logger.info(`[PostCall] Coaching analysis generated for scenario ${scenarioId}`);
      return coaching;
    } catch (parseErr) {
      logger.error('[PostCall] Failed to parse coaching response:', parseErr.message);
      return null;
    }
  } catch (err) {
    logger.error('[PostCall] Coaching generation failed:', err.message);
    return null;
  }
}

module.exports = { processSession, generateCoachingAnalysis, scoreTranscript };
