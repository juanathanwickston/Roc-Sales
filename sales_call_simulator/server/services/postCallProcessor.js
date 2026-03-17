/**
 * Post-Call Processor
 * Backend service that orchestrates the full post-call pipeline:
 * fetch transcript -> score -> persist results -> notify ROC Academy -> update session status.
 *
 * This runs entirely server-side. The frontend triggers it via
 * POST /api/sessions/:id/process and polls for completion.
 */

const db = require('../db');
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
    // 1. Fetch transcript (also stores raw conversation for perception extraction)
    const { transcript, rawConversationData } = await fetchAndStoreTranscript(sessionId);

    if (!transcript) {
      console.warn(`[PostCall] No transcript available for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 2. Extract and persist perception analysis (non-blocking)
    await persistPerceptionAnalysis(sessionId, rawConversationData);

    // 3. Load session to get scenario and user info
    const session = await db.query(
      'SELECT scenario_id, external_user_id FROM simulation_sessions WHERE id = $1',
      [sessionId]
    );
    const scenarioId = session.rows[0]?.scenario_id || 'unknown';
    const userId = session.rows[0]?.external_user_id || null;

    // 4. Score the transcript
    const scorecard = await scoreTranscript(transcript, scenarioId);

    if (!scorecard) {
      console.warn(`[PostCall] Scoring unavailable for session ${sessionId}`);
      await updateStatus(sessionId, 'completed');
      return { status: 'completed', scored: false };
    }

    // 5. Persist scoring results
    await persistScore(sessionId, scorecard);

    // 6. Notify ROC Academy (fire-and-forget, does not block completion)
    sendCompletionCallback({ sessionId, scorecard, scenarioId, userId }).catch(() => {});

    // 7. Mark session as completed
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
    return { transcript: existing.rows[0].normalized_transcript, rawConversationData: null };
  }

  // Get the Tavus conversation ID from the session
  const session = await db.query(
    'SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1',
    [sessionId]
  );

  const conversationId = session.rows[0]?.tavus_conversation_id;
  if (!conversationId) {
    console.warn(`[PostCall] No Tavus conversation ID for session ${sessionId}`);
    return { transcript: null, rawConversationData: null };
  }

  // Fetch from Tavus with retry loop (verbose=true for perception analysis data)
  // No fixed attempt limit - polls until data arrives or 5-minute ceiling
  let transcript = null;
  let rawResponse = null;
  let rawConversationData = null;

  // Initial delay: give Tavus a moment to finalize after call ends
  console.log(`[PostCall] Waiting ${TRANSCRIPT_INITIAL_DELAY_MS / 1000}s before first transcript fetch...`);
  await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_INITIAL_DELAY_MS));

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < TRANSCRIPT_MAX_WAIT_MS) {
    attempt++;

    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[PostCall] Fetching transcript, attempt ${attempt} (${elapsed}s elapsed)`);

    try {
      const data = await tavusFetch(`/conversations/${conversationId}?verbose=true`);
      rawResponse = JSON.stringify(data);
      rawConversationData = data;

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
    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.warn(`[PostCall] Transcript unavailable after ${totalElapsed}s (${attempt} attempts)`);
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

  console.log(`[PostCall] Transcript stored for session ${sessionId}`);
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
      console.log(`[PostCall] No perception analysis data for session ${sessionId}`);
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
    console.log(`[PostCall] Perception analysis stored for session ${sessionId}`);
  } catch (err) {
    console.warn(`[PostCall] Perception analysis failed for session ${sessionId}:`, err.message);
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
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();

  try {
    const extraction = JSON.parse(data.choices[0].message.content);
    const scorecard = calculateMechanicalScore(extraction, rubric);
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
 * Build the scoring prompt from transcript and behavioral checklist rubric.
 * GPT-4o only observes YES/NO per behavior with exact transcript quotes.
 * Score calculation happens server-side in calculateMechanicalScore.
 */
function buildScoringPrompt(transcript, rubric, scenarioId) {
  // Build behavior list from rubric
  const behaviorList = [];
  for (const [catName, catData] of Object.entries(rubric)) {
    const behaviors = catData.behaviors || [];
    for (const b of behaviors) {
      behaviorList.push(`- ${b.id}: ${b.description}`);
    }
  }
  const behaviorText = behaviorList.join('\n');

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

Return a JSON object with this exact structure:
{
  "checklist": {
    "<behavior_id>": {
      "observed": true|false,
      "evidence": "<exact transcript quote or NOT OBSERVED>"
    }
  },
  "top_strengths": ["<strength based on observed evidence>", "<strength based on observed evidence>"],
  "critical_improvements": ["<improvement based on missing behaviors>", "<improvement>", "<improvement>"],
  "coaching_tip": "<one actionable tip>"
}`,

    user: `SCENARIO: ${scenarioId || 'Sales Call Simulation'}

BEHAVIORS TO EVALUATE:
${behaviorText}

CALL TRANSCRIPT:
${transcript}

Evaluate each behavior. Return JSON only.`,
  };
}

/**
 * Calculate mechanical score from GPT-4o checklist extraction and rubric behaviors.
 * Returns a backward-compatible scorecard object.
 */
function calculateMechanicalScore(extraction, rubric) {
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
      evidence: checklist,
    };
  }

  const overallVerdict = totalScore >= 70 ? 'pass' : (totalScore >= 50 ? 'needs_work' : 'fail');

  return {
    overall_score: totalScore,
    overall_verdict: overallVerdict,
    categories: categories,
    checklist: checklist,
    top_strengths: extraction.top_strengths || [],
    critical_improvements: extraction.critical_improvements || [],
    coaching_tip: extraction.coaching_tip || '',
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

/**
 * Load curriculum source material for a scenario.
 * Reads the corresponding .md file from the curriculum/ directory.
 * Returns the curriculum text, or a generic fallback if not found.
 */
function loadCurriculum(scenarioId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const curriculumDir = path.join(__dirname, '..', 'curriculum');

    // Map scenarioId to curriculum filename: module1_identifying_customer -> module1_identifying_customer.md
    const filePath = path.join(curriculumDir, scenarioId + '.md');

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }

    // Fallback: list available files
    console.warn(`[PostCall] No curriculum found for scenario ${scenarioId}`);
  } catch (err) {
    console.warn(`[PostCall] Could not load curriculum for scenario ${scenarioId}:`, err.message);
  }

  return 'No specific curriculum available for this module. Evaluate based on general sales best practices.';
}

/**
 * Build the coaching prompt from transcript, curriculum, and scorecard.
 * Produces 5 sections: call_overview, coaches_analysis, playbook, stats, next_call_focus.
 * Strict language constraints: no em dashes, no emojis, no exclamation marks.
 */
function buildCoachingPrompt({ transcript, curriculum, scorecard, scenarioId }) {
  const scoreSummary = `Overall Score: ${scorecard.overall_score}/100 (${scorecard.overall_verdict})
Top Strengths: ${(scorecard.top_strengths || []).join('; ')}
Critical Improvements: ${(scorecard.critical_improvements || []).join('; ')}
Coaching Tip: ${scorecard.coaching_tip || 'N/A'}`;

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
    console.warn('[PostCall] Coaching skipped: no OpenAI API key');
    return null;
  }

  if (!transcript) {
    console.warn('[PostCall] Coaching skipped: no transcript');
    return null;
  }

  try {
    const curriculum = loadCurriculum(scenarioId);
    const prompt = buildCoachingPrompt({ transcript, curriculum, scorecard, scenarioId });

    console.log(`[PostCall] Generating coaching analysis for scenario ${scenarioId}...`);

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
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    try {
      const coaching = JSON.parse(data.choices[0].message.content);
      console.log(`[PostCall] Coaching analysis generated for scenario ${scenarioId}`);
      return coaching;
    } catch (parseErr) {
      console.error('[PostCall] Failed to parse coaching response:', parseErr.message);
      return null;
    }
  } catch (err) {
    console.error('[PostCall] Coaching generation failed:', err.message);
    return null;
  }
}

module.exports = { processSession, generateCoachingAnalysis };
