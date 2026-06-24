/**
 * Docebo API client for reading user additional fields.
 * Used during LTI launches to resolve persona assignments.
 */
const config = require('../config').config;
const logger = require('../utils/logger');

const TOKEN_BUFFER_MS = 60_000;

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get an OAuth2 access token via client_credentials grant.
 * Caches the token until 60s before expiry.
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const url = `${config.DOCEBO_BASE_URL}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.DOCEBO_CLIENT_ID,
    client_secret: config.DOCEBO_CLIENT_SECRET,
    scope: 'api',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Docebo token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - TOKEN_BUFFER_MS;
  return cachedToken;
}

/**
 * Look up a Docebo user by email and return their assigned persona.
 * Returns the persona ID string (e.g. 'sam_patel') or null if not found.
 */
async function getAssignedPersona(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const token = await getAccessToken();
  const searchUrl = `${config.DOCEBO_BASE_URL}/manage/v1/user`
    + `?search_text=${encodeURIComponent(email)}&page_size=5`;

  const res = await fetch(searchUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Docebo user search failed', { status: res.status, body: text });
    return null;
  }

  const data = await res.json();
  const items = data.data && data.data.items;
  if (!items || items.length === 0) {
    logger.warn('No Docebo user found', { email });
    return null;
  }

  // Match by exact email (search_text is a fuzzy match)
  const emailLower = email.toLowerCase();
  const user = items.find((u) => {
    const userEmail = (u.email || '').toLowerCase();
    return userEmail === emailLower;
  });

  if (!user) {
    logger.warn('Docebo user not found by exact email match', { email });
    return null;
  }

  // field_15 = "Assigned Persona (Simulations)"
  const persona = user.field_15 || null;
  if (persona) {
    logger.info('Docebo persona resolved', { email, persona });
  } else {
    logger.warn('Docebo user has no persona assigned', { email });
  }

  return persona;
}

module.exports = { getAssignedPersona };
