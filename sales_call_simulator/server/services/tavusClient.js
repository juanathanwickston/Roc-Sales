/**
 * Tavus API Client
 * Shared service for making authenticated calls to the Tavus CVI API.
 */

const { config } = require('../config');

/** Timeout for individual Tavus API requests (milliseconds). */
const TAVUS_REQUEST_TIMEOUT_MS = 30000;

/**
 * Make an authenticated request to the Tavus API.
 * Returns the parsed JSON response on success.
 * Throws an error with status and data on failure.
 * Enforces a 30-second timeout via AbortController.
 */
async function tavusFetch(path, options = {}) {
  const url = `${config.TAVUS_API_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TAVUS_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.TAVUS_API_KEY,
        ...options.headers,
      },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Maximum number of retry attempts for transient failures (Power of Ten Rule 2: bounded loop). */
const MAX_RETRIES = 3;

/** Base delay between retries in milliseconds. Multiplied by attempt number for linear backoff. */
const RETRY_DELAY_MS = 1000;

/**
 * Tavus API fetch with bounded retry for transient errors.
 * Only retries on 5xx server errors and 429 rate-limit responses.
 * Auth (401) and validation (400) errors are never retried.
 *
 * @param {string} path   - API path (e.g. '/personas/abc123')
 * @param {object} options - fetch options (method, body, headers)
 * @returns {Promise<object>} parsed JSON response
 */
async function tavusFetchWithRetry(path, options = {}) {
  if (!path || typeof path !== 'string') {
    throw new Error('tavusFetchWithRetry: path must be a non-empty string');
  }

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await tavusFetch(path, options);
    } catch (err) {
      lastError = err;
      const status = err.status || 0;
      const isRetryable = status >= 500 || status === 429;
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (!isRetryable || isLastAttempt) {
        throw err;
      }

      const delayMs = RETRY_DELAY_MS * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  /* istanbul ignore next — defensive: loop always throws on last attempt */
  throw lastError;
}

module.exports = { tavusFetch, tavusFetchWithRetry };
