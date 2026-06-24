/**
 * Sales Call Simulator - Server Configuration
 * Validates environment variables on startup.
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

  // External LMS (optional)
  ROC_ACADEMY_URL: process.env.ROC_ACADEMY_URL || 'http://localhost:3000',

  // Simulator Sync — dedicated secret for external completion callbacks
  SIMULATOR_SYNC_SECRET: process.env.SIMULATOR_SYNC_SECRET || '',

  // Static key for bypass/unsigned launches (optional)
  SIMULATOR_LAUNCH_KEY: process.env.SIMULATOR_LAUNCH_KEY || '',

  // LTI integration
  LTI_CONSUMER_KEY: process.env.LTI_CONSUMER_KEY || '',
  LTI_SHARED_SECRET: process.env.LTI_SHARED_SECRET || '',

  // Docebo API — reads user additional fields for persona resolution
  DOCEBO_BASE_URL: process.env.DOCEBO_BASE_URL || '',
  DOCEBO_CLIENT_ID: process.env.DOCEBO_CLIENT_ID || '',
  DOCEBO_CLIENT_SECRET: process.env.DOCEBO_CLIENT_SECRET || '',
  DOCEBO_USERNAME: process.env.DOCEBO_USERNAME || '',
  DOCEBO_PASSWORD: process.env.DOCEBO_PASSWORD || '',

  // Training gate — access code shared with reps to gate login
  TRAINING_ACCESS_CODE: process.env.TRAINING_ACCESS_CODE || '',

  // Facilitator user IDs — get admin role on login
  FACILITATOR_IDS: (process.env.FACILITATOR_IDS || 'john_hamilton,kevin_reed,mike_mccaffrey,zack_zivkovich').split(','),
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
  if (!config.TRAINING_ACCESS_CODE) {
    warnings.push('TRAINING_ACCESS_CODE is not set - login will not require an access code.');
  }
  if (!config.SIMULATOR_LAUNCH_KEY) {
    warnings.push('SIMULATOR_LAUNCH_KEY is not set - static bypass launch will be disabled.');
  }

  if (warnings.length > 0) {
    console.warn('\n[CONFIG] Missing configuration:');
    warnings.forEach(w => console.warn(`  - ${w}`));
    console.warn('  Set these in your .env file. See .env.example for reference.\n');
  }

  return warnings.length === 0;
}

module.exports = { config, validateConfig };
