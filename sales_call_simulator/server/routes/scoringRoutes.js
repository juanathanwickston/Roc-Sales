/**
 * Post-Call Scoring Routes
 * Evaluates sales call transcripts against scenario rubrics using OpenAI.
 * Pattern adapted from support_chatbot/app/core/bot.py
 */

const express = require('express');
const { config } = require('../config');

const router = express.Router();

/**
 * POST /api/scoring/evaluate
 * Body: { transcript, scenario_id, rubric }
 * Returns: scored rubric with feedback
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { transcript, scenario_id, rubric } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'transcript must be a non-empty string' });
    }
    if (!rubric || typeof rubric !== 'object') {
      return res.status(400).json({ error: 'rubric is required and must be an object' });
    }

    if (!config.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'Scoring unavailable - OPENAI_API_KEY not configured',
      });
    }

    const scoringPrompt = buildScoringPrompt(transcript, rubric, scenario_id);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: scoringPrompt.system },
          { role: 'user', content: scoringPrompt.user },
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
    let scorecard;
    try {
      scorecard = JSON.parse(data.choices[0].message.content);
    } catch (parseErr) {
      console.error('[Scoring] Failed to parse OpenAI response:', parseErr.message);
      return res.status(502).json({ error: 'Scoring returned invalid results. Please try again.' });
    }

    console.log(`[Scoring] Evaluated scenario ${scenario_id}: overall ${scorecard.overall_score}/100`);
    res.json(scorecard);
  } catch (err) {
    console.error('[Scoring] Evaluation error:', err.message);
    res.status(500).json({ error: 'Something went wrong during scoring. Please try again.' });
  }
});

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
    system: `You are an expert sales coach evaluating a sales call simulation. You are rigorous but constructive. You evaluate based on observable evidence in the transcript — not assumptions.

Score each rubric category on a scale of 0-100. Provide specific evidence from the transcript for each score. Be honest — a score of 50 means average, 70 means good, 90+ means exceptional.

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

module.exports = router;
