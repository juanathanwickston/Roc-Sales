/**
 * Sales Call Simulator - Server Configuration
 * Validates environment variables on startup.
 * Pattern adapted from support_chatbot/app/core/config.py
 */

require('dotenv').config();

const config = {
  // Tavus CVI
  TAVUS_API_KEY: process.env.TAVUS_API_KEY || '',
  TAVUS_API_URL: 'https://tavusapi.com/v2',

  // OpenAI (post-call scoring)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Server
  PORT: parseInt(process.env.PORT, 10) || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || '',

  // ROC Academy
  ROC_ACADEMY_URL: process.env.ROC_ACADEMY_URL || 'http://localhost:3000',
};

/**
 * Validate required configuration on startup.
 * Warns for missing keys instead of crashing - allows dev without all services.
 */
function validateConfig() {
  const warnings = [];

  if (!config.TAVUS_API_KEY) {
    warnings.push('TAVUS_API_KEY is not set - Tavus API calls will fail.');
  }
  if (!config.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY is not set - post-call scoring will be unavailable.');
  }
  if (!config.DATABASE_URL) {
    warnings.push('DATABASE_URL is not set - sessions will not be persisted.');
  }
  if (!config.JWT_SECRET) {
    warnings.push('JWT_SECRET is not set - auth will be disabled.');
  }

  if (warnings.length > 0) {
    console.warn('\n[CONFIG] Missing configuration:');
    warnings.forEach(w => console.warn(`  - ${w}`));
    console.warn('  Set these in your .env file. See .env.example for reference.\n');
  }

  return warnings.length === 0;
}

module.exports = { config, validateConfig };
