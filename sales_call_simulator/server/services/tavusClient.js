/**
 * Tavus API Client
 * Shared service for making authenticated calls to the Tavus CVI API.
 */

const { config } = require('../config');

/**
 * Make an authenticated request to the Tavus API.
 * Returns the parsed JSON response on success.
 * Throws an error with status and data on failure.
 */
async function tavusFetch(path, options = {}) {
  const url = `${config.TAVUS_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.TAVUS_API_KEY,
      ...options.headers,
    },
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
}

module.exports = { tavusFetch };
