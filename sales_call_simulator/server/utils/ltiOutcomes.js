/**
 * LTI 1.1 Outcomes Service — Grade Passback
 * Posts a replaceResult XML payload to the LMS Outcomes service URL.
 * Uses OAuth 1.0 HMAC-SHA1 signing with body hash extension.
 *
 * Security controls:
 * - HTTPS enforced on outcome service URL
 * - OAuth body hash (SHA1 of XML body) included per IMS spec
 * - Timing-safe nonce generation via crypto.randomBytes
 * - Hard 10s timeout on outbound POST
 * - Errors logged but never thrown (fire-and-forget)
 */

const crypto = require('crypto');
const { config } = require('../config');
const logger = require('./logger');
const { rfc3986Encode, buildBaseString } = require('./ltiVerifier');

const OUTCOME_TIMEOUT_MS = 10_000;

/**
 * Build the LTI replaceResult XML body.
 * @param {string} sourcedId - The lis_result_sourcedid from the LTI launch
 * @param {number} score - Normalized score between 0.0 and 1.0
 * @returns {string} XML body
 */
function buildReplaceResultXml(sourcedId, score) {
  const messageId = crypto.randomUUID();
  const normalizedScore = Math.max(0, Math.min(1, score)).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${messageId}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${sourcedId}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>en</language>
            <textString>${normalizedScore}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;
}

/**
 * Sign an outbound OAuth 1.0 request with body hash.
 * Used for LTI Outcomes service POST requests.
 *
 * @param {string} method - HTTP method (POST)
 * @param {string} url - Full URL of the Outcomes service
 * @param {string} body - XML request body
 * @param {string} consumerKey - OAuth consumer key
 * @param {string} consumerSecret - OAuth consumer secret
 * @returns {string} OAuth Authorization header value
 */
function signOutboundRequest(method, url, body, consumerKey, consumerSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  // OAuth body hash: base64(sha1(body))
  const bodyHash = crypto
    .createHash('sha1')
    .update(body, 'utf8')
    .digest('base64');

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    oauth_body_hash: bodyHash,
  };

  // Build signature base string
  const baseString = buildBaseString(method, url, oauthParams);
  const signingKey = `${rfc3986Encode(consumerSecret)}&`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  // Build Authorization header
  const authParts = Object.entries(oauthParams)
    .map(([k, v]) => `${rfc3986Encode(k)}="${rfc3986Encode(v)}"`)
    .join(', ');

  return `OAuth ${authParts}, oauth_signature="${rfc3986Encode(signature)}"`;
}

/**
 * Send an LTI grade (replaceResult) to the LMS Outcomes service.
 * Fire-and-forget: logs errors but does not throw.
 *
 * @param {Object} params
 * @param {string} params.outcomeServiceUrl - lis_outcome_service_url from launch
 * @param {string} params.resultSourcedId - lis_result_sourcedid from launch
 * @param {number} [params.score=1.0] - Normalized score (0.0-1.0)
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
async function sendLtiGrade({ outcomeServiceUrl, resultSourcedId, score = 1.0 }) {
  if (!outcomeServiceUrl || !resultSourcedId) {
    logger.warn('[LTI Outcomes] Missing outcome service URL or sourcedId — skipping grade sync');
    return { success: false, error: 'Missing LTI outcome parameters' };
  }

  if (!config.LTI_CONSUMER_KEY || !config.LTI_SHARED_SECRET) {
    logger.warn('[LTI Outcomes] LTI credentials not configured — skipping grade sync');
    return { success: false, error: 'LTI not configured' };
  }

  const xmlBody = buildReplaceResultXml(resultSourcedId, score);

  try {
    const authHeader = signOutboundRequest(
      'POST',
      outcomeServiceUrl,
      xmlBody,
      config.LTI_CONSUMER_KEY,
      config.LTI_SHARED_SECRET
    );

    const res = await fetch(outcomeServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': authHeader,
      },
      body: xmlBody,
      signal: AbortSignal.timeout(OUTCOME_TIMEOUT_MS),
    });

    if (res.ok) {
      logger.info('[LTI Outcomes] Grade posted successfully', {
        url: outcomeServiceUrl,
        score,
        status: res.status,
      });
      return { success: true, status: res.status };
    }

    const errText = await res.text().catch(() => '');
    logger.error('[LTI Outcomes] Grade post failed', {
      url: outcomeServiceUrl,
      status: res.status,
      response: errText.slice(0, 500),
    });
    return { success: false, status: res.status, error: errText.slice(0, 200) };
  } catch (err) {
    logger.error('[LTI Outcomes] Grade post error', {
      url: outcomeServiceUrl,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

module.exports = { sendLtiGrade, buildReplaceResultXml };
