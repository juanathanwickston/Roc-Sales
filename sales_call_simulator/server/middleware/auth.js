/**
 * JWT Authentication Middleware
 * Shares JWT_SECRET with ROC Academy for seamless auth passthrough.
 * Pattern adapted from roc_academy/server/auth.js
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config');

/**
 * Verify JWT token from Authorization header.
 * If JWT_SECRET is not configured, allows all requests (dev mode).
 */
function requireAuth(req, res, next) {
  // Dev bypass: if no JWT_SECRET configured, skip auth
  if (!config.JWT_SECRET) {
    req.user = { userId: 'dev-user', role: 'user' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth - sets req.user if token present, continues regardless.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
