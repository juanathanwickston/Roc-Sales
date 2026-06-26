/**
 * OAuth 1.0 signature verification for LTI 1.1 launches.
 * Replaces the deprecated ims-lti package (7 known vulnerabilities).
 * Uses only Node built-in crypto — zero external dependencies.
 */
const crypto = require('crypto');

const MAX_TIMESTAMP_DRIFT_S = 300; // 5 minutes

/**
 * RFC 3986 percent-encode a string.
 * OAuth 1.0 requires this specific encoding (not standard encodeURIComponent).
 */
function rfc3986Encode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Build the OAuth 1.0 signature base string.
 * @param {string} method - HTTP method (uppercase)
 * @param {string} url - Full request URL (no query string)
 * @param {Object} params - All POST body params except oauth_signature
 */
function buildBaseString(method, url, params) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(params[k])}`)
    .join('&');

  return `${method.toUpperCase()}&${rfc3986Encode(url)}&${rfc3986Encode(sorted)}`;
}

/**
 * Verify an OAuth 1.0 HMAC-SHA1 signed LTI launch request.
 * @param {Object} req - Express request (must have .body, .protocol, .headers, .originalUrl)
 * @param {string} consumerSecret - The shared secret for this consumer key
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyLtiSignature(req, consumerSecret) {
  const body = req.body || {};

  // Guard: required OAuth fields
  const requiredFields = ['oauth_consumer_key', 'oauth_signature', 'oauth_timestamp', 'oauth_nonce', 'oauth_signature_method'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return { valid: false, error: `Missing ${field}` };
    }
  }

  // Only HMAC-SHA1 supported for LTI 1.1
  if (body.oauth_signature_method !== 'HMAC-SHA1') {
    return { valid: false, error: `Unsupported signature method: ${body.oauth_signature_method}` };
  }

  // Timestamp drift check (replay protection)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(body.oauth_timestamp, 10);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_TIMESTAMP_DRIFT_S) {
    return { valid: false, error: 'Timestamp drift exceeds 5 minutes' };
  }

  // Build base URL from request (respect X-Forwarded-Proto behind proxy)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers.host;
  const path = req.originalUrl.split('?')[0];
  const baseUrl = `${protocol}://${host}${path}`;

  // Collect all params except oauth_signature
  const params = {};
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'oauth_signature') {
      params[key] = value;
    }
  }

  // Compute expected signature
  const baseString = buildBaseString('POST', baseUrl, params);
  const signingKey = `${rfc3986Encode(consumerSecret)}&`;
  const expectedSig = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  // Timing-safe comparison
  const receivedSig = body.oauth_signature;
  const expected = Buffer.from(expectedSig, 'utf8');
  const received = Buffer.from(receivedSig, 'utf8');

  if (expected.length !== received.length) {
    return { valid: false, error: 'Signature mismatch' };
  }

  const match = crypto.timingSafeEqual(expected, received);
  if (!match) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

module.exports = { verifyLtiSignature, rfc3986Encode, buildBaseString };
