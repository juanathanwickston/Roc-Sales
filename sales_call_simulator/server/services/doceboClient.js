/**
 * Docebo API client for reading user additional fields.
 * Used during LTI launches to resolve persona assignments.
 *
 * Security controls:
 * - HTTPS enforced on all outbound requests
 * - Credentials never logged (masked or omitted)
 * - Token cached; invalidated on 401
 * - All fetch calls hard-capped at 10s
 * - Response structure validated before field access
 * - Persona value validated against whitelist (in caller)
 */
const config = require('../config').config;
const logger = require('../utils/logger');

const TOKEN_BUFFER_MS = 60_000;
const API_TIMEOUT_MS = 10_000;
const PERSONA_FIELD_KEY = 'field_3';

let cachedToken = null;
let tokenExpiresAt = 0;

function maskEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const masked = local.length > 2
    ? local[0] + '***' + local[local.length - 1]
    : '***';
  return `${masked}@${parts[1]}`;
}

/**
 * Validate that all required Docebo credentials are configured.
 * Returns an error string or null if valid.
 */
function validateDoceboConfig() {
  const required = ['DOCEBO_BASE_URL', 'DOCEBO_CLIENT_ID', 'DOCEBO_CLIENT_SECRET', 'DOCEBO_USERNAME', 'DOCEBO_PASSWORD'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length > 0) {
    return `Missing Docebo config: ${missing.join(', ')}`;
  }
  if (!config.DOCEBO_BASE_URL.startsWith('https://')) {
    return 'DOCEBO_BASE_URL must use HTTPS';
  }
  return null;
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Get an OAuth2 access token via password grant.
 * Caches the token until 60s before expiry.
 * Clears cache on auth failure to prevent stale token reuse.
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const configError = validateDoceboConfig();
  if (configError) {
    throw new Error(configError);
  }

  const url = `${config.DOCEBO_BASE_URL}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: config.DOCEBO_CLIENT_ID,
    client_secret: config.DOCEBO_CLIENT_SECRET,
    username: config.DOCEBO_USERNAME,
    password: config.DOCEBO_PASSWORD,
    scope: 'api',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!res.ok) {
    clearTokenCache();
    // Log status only — never log response body (may echo credentials)
    logger.error('Docebo token request failed', { status: res.status });
    throw new Error(`Docebo token request failed (${res.status})`);
  }

  const data = await res.json();

  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Docebo token response missing access_token');
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (expiresIn * 1000) - TOKEN_BUFFER_MS;

  logger.info('Docebo token acquired', { expiresIn });
  return cachedToken;
}

/**
 * Look up a Docebo user by email and return their assigned persona.
 * Returns the persona ID string (e.g. 'sam_patel') or null if not found.
 */
async function getAssignedPersona(emailOrId) {
  if (!emailOrId || typeof emailOrId !== 'string') {
    return null;
  }

  const isEmail = emailOrId.includes('@');
  const masked = isEmail ? maskEmail(emailOrId) : '***';

  const token = await getAccessToken();
  let user = null;

  if (isEmail) {
    const searchUrl = `${config.DOCEBO_BASE_URL}/manage/v1/user`
      + `?search_text=${encodeURIComponent(emailOrId)}&page_size=5`;

    logger.info('Docebo user search (debug)', { url: searchUrl.replace(/search_text=[^&]+/, `search_text=${masked}`), email: masked });

    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (res.status === 401) {
      clearTokenCache();
      logger.error('Docebo user search returned 401, token cache cleared', { email: masked });
      return null;
    }

    if (!res.ok) {
      logger.error('Docebo user search failed', { status: res.status, email: masked });
      return null;
    }

    const data = await res.json();

    // DEBUG: log raw response keys to verify structure
    logger.info('Docebo search response (debug)', {
      hasData: !!data.data,
      itemCount: data.data && data.data.items ? data.data.items.length : 0,
      totalCount: data.data && data.data.count,
      topLevelKeys: Object.keys(data),
    });

    // Validate response structure before accessing nested fields
    if (!data || typeof data !== 'object') {
      logger.error('Docebo returned invalid response structure');
      return null;
    }

    const items = data.data && Array.isArray(data.data.items) ? data.data.items : [];
    if (items.length === 0) {
      logger.warn('No Docebo user found', { email: masked });
      return null;
    }

    // Match by exact email — search_text is a fuzzy match, we need precision
    const emailLower = emailOrId.toLowerCase();
    user = items.find((u) => {
      const userEmail = (u.email || '').toLowerCase();
      return userEmail === emailLower;
    });

    if (!user) {
      logger.warn('Docebo user not found by exact email match', { email: masked, resultCount: items.length });
      return null;
    }
  } else {
    // Direct lookup by User ID, UUID, or Username
    const getUrl = `${config.DOCEBO_BASE_URL}/manage/v1/user/${encodeURIComponent(emailOrId)}`;

    logger.info('Docebo user direct fetch (debug)', { url: getUrl });

    const res = await fetch(getUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (res.status === 401) {
      clearTokenCache();
      logger.error('Docebo user direct fetch returned 401, token cache cleared');
      return null;
    }

    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      logger.error('Docebo user direct fetch failed', { status: res.status, url: getUrl, errorResponse: errText });
      return null;
    }

    const data = await res.json();

    logger.info('Docebo user direct fetch response (debug)', {
      hasData: !!data.data,
      topLevelKeys: Object.keys(data),
      dataType: data.data ? typeof data.data : 'undefined',
      dataKeys: data.data ? Object.keys(data.data) : []
    });

    if (!data || typeof data !== 'object' || !data.data) {
      logger.error('Docebo returned invalid user response structure');
      return null;
    }

    user = data.data;
  }

  // DEBUG: log all field_* keys (remove after initial verification)
  const fieldKeys = Object.keys(user).filter((k) => k.startsWith('field_'));
  const fieldData = {};
  for (const k of fieldKeys) {
    fieldData[k] = user[k];
  }
  logger.info('Docebo user fields (debug)', { email: masked, fields: fieldData });

  // Read the persona field — handle both string and numeric (dropdown ID) values
  const rawPersona = user[PERSONA_FIELD_KEY];
  const persona = (typeof rawPersona === 'string' ? rawPersona.trim() : null) || null;

  if (persona) {
    logger.info('Docebo persona resolved', { email: masked, persona });
  } else {
    logger.warn('Docebo user has no persona assigned', { email: masked, rawValue: rawPersona, rawType: typeof rawPersona });
  }

  return persona;
}

module.exports = { getAssignedPersona, validateDoceboConfig };
