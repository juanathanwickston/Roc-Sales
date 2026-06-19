/**
 * JWT authentication middleware.
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config');
const logger = require('../utils/logger');

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
  // Dev bypass: if no JWT_SECRET configured, use dev identity
  if (!config.JWT_SECRET) {
    req.user = { userId: 'dev-user', role: 'user' };
    return next();
  }

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

/**
 * Verify a signed launch token from an external LMS.
 * Launch tokens include learner and module context for auto-setup.
 * Returns the decoded payload or null if invalid/missing.
 *
 * Expected payload shape:
 *   { userId, courseId, moduleId, scenarioId, returnUrl, iat, exp }
 */
function verifyLaunchToken(token) {
  if (!token) return null;

  // Dev bypass: no JWT_SECRET means tokens cannot be verified
  if (!config.JWT_SECRET) return null;

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);

    // Ensure required fields are present
    if (!payload.userId || !payload.scenarioId) {
      logger.warn('[Auth] Launch token missing required fields (userId, scenarioId)');
      return null;
    }

    return {
      userId: payload.userId,
      courseId: payload.courseId || null,
      moduleId: payload.moduleId || null,
      scenarioId: payload.scenarioId,
      returnUrl: payload.returnUrl || null,
    };
  } catch (err) {
    logger.warn('[Auth] Launch token verification failed:', err.message);
    return null;
  }
}

/**
 * Require the authenticated user to have one of the specified roles.
 * Must be used after requireAuth so that req.user is populated.
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, verifyLaunchToken, requireAnyRole };

