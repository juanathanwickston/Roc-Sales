/**
 * Academy Completion Sync Service
 * Notifies ROC Academy when a simulator session completes with scoring.
 * Logs sync attempts to academy_completion_sync for auditability.
 *
 * The callback is fire-and-forget from the pipeline perspective.
 * Failures are logged but do not block session completion.
 */

const db = require('../db');
const { config } = require('../config');

// Maximum time to wait for ROC Academy response
const CALLBACK_TIMEOUT_MS = 10000;

/**
 * Send completion callback to ROC Academy.
 * Called after scoring results are persisted.
 * Does not throw - failures are logged to the sync table.
 */
async function sendCompletionCallback({ sessionId, scorecard, scenarioId, userId }) {
  const payload = {
    sessionId,
    scenarioId: scenarioId || null,
    userId: userId || null,
    overallScore: scorecard.overall_score || 0,
    verdict: scorecard.overall_verdict || 'unknown',
    completedAt: new Date().toISOString(),
  };

  // Log the sync attempt
  await logSyncAttempt(sessionId, payload, 'pending');

  // Skip callback if ROC Academy URL is not configured or is localhost default
  if (!config.ROC_ACADEMY_URL || config.ROC_ACADEMY_URL === 'http://localhost:3000') {
    console.log('[AcademySync] Skipping callback - ROC Academy URL not configured for remote');
    await updateSyncStatus(sessionId, 'skipped', null, null);
    return;
  }

  const callbackUrl = `${config.ROC_ACADEMY_URL}/api/simulator/completion`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.JWT_SECRET ? { 'X-Simulator-Secret': config.JWT_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log(`[AcademySync] Callback sent for session ${sessionId} (${response.status})`);
      await updateSyncStatus(sessionId, 'sent', response.status, null);
    } else {
      const errText = await response.text().catch(() => '');
      console.warn(`[AcademySync] Callback failed for session ${sessionId}: ${response.status}`);
      await updateSyncStatus(sessionId, 'failed', response.status, errText.slice(0, 500));
    }
  } catch (err) {
    console.warn(`[AcademySync] Callback error for session ${sessionId}:`, err.message);
    await updateSyncStatus(sessionId, 'failed', null, err.message);
  }
}

/**
 * Log initial sync attempt to academy_completion_sync.
 */
async function logSyncAttempt(sessionId, payload, status) {
  try {
    await db.query(
      `INSERT INTO academy_completion_sync (session_id, payload, status, attempts, last_attempt_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET
         payload = $2, status = $3, attempts = academy_completion_sync.attempts + 1, last_attempt_at = NOW()`,
      [sessionId, JSON.stringify(payload), status]
    );
  } catch (err) {
    // Sync logging should not break the pipeline
    console.warn('[AcademySync] Failed to log sync attempt:', err.message);
  }
}

/**
 * Update sync status after callback attempt.
 */
async function updateSyncStatus(sessionId, status, responseStatus, errorMessage) {
  try {
    await db.query(
      `UPDATE academy_completion_sync
       SET status = $2, response_status = $3, error_message = $4
       WHERE session_id = $1`,
      [sessionId, status, responseStatus, errorMessage]
    );
  } catch (err) {
    console.warn('[AcademySync] Failed to update sync status:', err.message);
  }
}

module.exports = { sendCompletionCallback };
