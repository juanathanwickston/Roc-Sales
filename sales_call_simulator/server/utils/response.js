/**
 * Shared API Response & Error Helpers
 * Conforms to { data } envelope and RFC 9457 Problem Details standards.
 */

const STATUS_TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function sendSuccess(res, data, status = 200, meta = undefined) {
  const payload = { data };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(status).json(payload);
}

function sendError(res, req, status, detail = undefined, errorCode = undefined) {
  const title = STATUS_TITLES[status] || 'Error';
  const type = errorCode 
    ? `https://payroc.example/errors/${errorCode.toLowerCase().replace(/_/g, '-')}`
    : `https://payroc.example/errors/http-${status}`;

  res.setHeader('Content-Type', 'application/problem+json');
  return res.status(status).json({
    type,
    title,
    status,
    ...(detail && { detail }),
    instance: req.originalUrl,
  });
}

module.exports = { sendSuccess, sendError };
