/**
 * Authentication module for ROC Academy.
 * Handles password hashing, JWT token creation, and verification.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '8h';

if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Server cannot start.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Hash a plaintext password.
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compare plaintext against stored hash.
 */
async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Create a signed JWT containing user ID, role, and session hash.
 */
function createToken(userId, role, sessionHash) {
  return jwt.sign(
    { userId, role, sessionHash },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode a JWT. Returns payload or null.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Generate a random session hash for single-session enforcement.
 */
function generateSessionHash() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate password meets minimum requirements.
 * Returns null if valid, error message if invalid.
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  generateSessionHash,
  validatePassword
};
