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
const logger = require('../utils/logger');



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

  // Skip callback if SIMULATOR_SYNC_SECRET is not configured
  // This code change may be deployed before the ROC Academy validator is updated
  // only if stakeholders accept that completion callbacks will be skipped until
  // both systems are configured. Prefer a coordinated staging deployment first.
  if (!config.SIMULATOR_SYNC_SECRET) {
    logger.warn('[AcademySync] Skipping callback - SIMULATOR_SYNC_SECRET is not configured');
    await updateSyncStatus(sessionId, 'skipped', null, 'SIMULATOR_SYNC_SECRET not configured');
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
        'X-Simulator-Secret': config.SIMULATOR_SYNC_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      logger.info(`[AcademySync] Callback sent for session ${sessionId} (${response.status})`);
      await updateSyncStatus(sessionId, 'sent', response.status, null);
    } else {
      const errText = await response.text().catch(() => '');
      logger.warn(`[AcademySync] Callback failed for session ${sessionId}: ${response.status}`);
      await updateSyncStatus(sessionId, 'failed', response.status, errText.slice(0, 500));
    }
  } catch (err) {
    logger.warn(`[AcademySync] Callback error for session ${sessionId}:`, err.message);
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
    logger.warn('[AcademySync] Failed to log sync attempt:', err.message);
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
    logger.warn('[AcademySync] Failed to update sync status:', err.message);
  }
}

module.exports = { sendCompletionCallback };
