/**
 * Sales Call Simulator - Express Server
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const db = require('./db');
const { COURSE_MODULES } = require('./modules');

const app = express();

// Trust first proxy (Railway) - required for express-rate-limit
app.set('trust proxy', 1);

// --- Middleware ---

// Security headers (relaxed CSP for Daily.co WebRTC)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", "https://unpkg.com", "https://*.daily.co"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: [
          "'self'",
          "https://tavusapi.com",
          "https://*.daily.co",
          "https://*.wss.daily.co",
          "wss://*.daily.co",
          "https://api.openai.com",
          "https://*.ingest.sentry.io",
        ],
        frameSrc: ["'self'", "https://*.daily.co"],
        mediaSrc: ["'self'", "blob:", "https://*.daily.co"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// CORS - accept requests from configured origins
app.use((req, res, next) => {
  const allowedOrigins = [config.ROC_ACADEMY_URL, `http://localhost:${config.PORT}`];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Maximum API requests per minute per client
const API_RATE_LIMIT_PER_MINUTE = 30;

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: API_RATE_LIMIT_PER_MINUTE,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info('API request', { method: req.method, path: req.path });
  }
  next();
});

// --- API Routes ---

const { optionalAuth, requireAuth, requireAnyRole, verifyLaunchToken } = require('./middleware/auth');
const tavusRoutes = require('./routes/tavusRoutes');
const scenarioRoutes = require('./routes/scenarioRoutes');
const { router: sessionRoutes, adminDashboardHandler } = require('./routes/sessionRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const { verifyLtiSignature } = require('./utils/ltiVerifier');
const { sendLtiGrade } = require('./utils/ltiOutcomes');

// --- Standalone Auth ---
// Lightweight token endpoint for standalone mode.
// Accepts a display name, returns a signed JWT. No database required.

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      type: 'https://payroc.example/errors/validation',
      title: 'Bad Request',
      status: 400,
      detail: 'Name is required.',
    });
  }

  const accessCode = (req.body.accessCode || '').trim();
  if (config.TRAINING_ACCESS_CODE && accessCode !== config.TRAINING_ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid access code' });
  }

  const displayName = name.trim().substring(0, 100);
  const baseId = displayName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // Facilitators keep their clean IDs to match FACILITATOR_IDS config.
  // All other users get a deterministic hash suffix to prevent name collisions
  // (e.g. "John Hamilton" vs "John.Hamilton" would otherwise map to the same ID).
  let userId;
  if (config.FACILITATOR_IDS.includes(baseId)) {
    userId = baseId;
  } else {
    const hash = crypto.createHash('sha256').update(displayName.toLowerCase()).digest('hex').substring(0, 8);
    userId = (baseId + '_' + hash).replace(/_+/g, '_');
  }
  const role = config.FACILITATOR_IDS.includes(baseId) ? 'admin' : 'user';

  if (!config.JWT_SECRET) {
    // Dev mode — return a mock token
    return res.json({
      data: {
        token: 'dev-token',
        user: { userId, displayName, role },
      },
    });
  }

  const token = jwt.sign(
    { userId, displayName, role },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );

  logger.info('User logged in', { userId, displayName, role });

  return res.json({
    data: {
      token,
      user: { userId, displayName, role },
    },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    data: {
      userId: req.user.userId,
      displayName: req.user.displayName || req.user.userId,
      role: req.user.role || 'user',
    },
  });
});

// --- Feature Routes ---

app.use('/api/tavus', requireAuth, tavusRoutes);
app.use('/api/scenarios', scenarioRoutes); // Always public
app.use('/api/sessions', requireAuth, sessionRoutes);
app.get('/api/admin/dashboard', requireAuth, requireAnyRole('manager', 'admin'), adminDashboardHandler);
app.use('/api/assignments', requireAuth, requireAnyRole('admin'), assignmentRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await db.healthCheck();
    res.json({
      status: 'ok',
      service: 'sales-call-simulator',
      timestamp: new Date().toISOString(),
      tavusConfigured: !!config.TAVUS_API_KEY,
      openaiConfigured: !!config.OPENAI_API_KEY,
      db: dbStatus,
    });
  } catch (err) {
    res.json({
      status: 'degraded',
      service: 'sales-call-simulator',
      timestamp: new Date().toISOString(),
      db: { status: 'error', error: err.message },
    });
  }
});

// --- Launch Helpers ---

/**
 * Sign a user session JWT for use by the client app.
 * Centralizes token creation to avoid duplication across launch routes.
 */
function signUserToken(userId, displayName, role) {
  if (!config.JWT_SECRET) return 'dev-token';
  return jwt.sign({ userId, displayName, role }, config.JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Build redirect query params for launch routes.
 * Includes the signed token and all optional LMS context fields.
 */
function buildLaunchRedirectParams(token, context) {
  return new URLSearchParams({
    token,
    scenarioId: context.scenarioId,
    userId: context.userId,
    ...(context.courseId && { courseId: context.courseId }),
    ...(context.moduleId && { moduleId: context.moduleId }),
    ...(context.returnUrl && { returnUrl: context.returnUrl }),
  });
}

/**
 * Sanitize a userId from an external source.
 * Strips non-alphanumeric characters and caps length to prevent abuse.
 */
function sanitizeLaunchUserId(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().substring(0, 100).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

// --- Launch Routes ---

/**
 * GET /launch?token=... - Signed launch entry point for external LMS integration.
 * Validates the JWT, generates a user session token, then redirects to the simulator.
 */
app.get('/launch', authLimiter, (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Launch token is required' });
  }

  const launch = verifyLaunchToken(token);
  if (!launch) {
    return res.status(401).json({ error: 'Invalid or expired launch token' });
  }

  const userToken = signUserToken(launch.userId, launch.userId, 'user');
  const params = buildLaunchRedirectParams(userToken, launch);

  logger.info('Signed launch redirect', { userId: launch.userId, scenarioId: launch.scenarioId });
  res.redirect(`/?${params.toString()}`);
});

/**
 * GET /launch-unsigned?userId=...&scenarioId=...&key=...
 * Static-key launch for direct LMS linking (e.g. Docebo Web Page materials).
 * Validates the key using constant-time comparison, sanitizes userId, and redirects.
 */
app.get('/launch-unsigned', authLimiter, (req, res) => {
  const { scenarioId, key, courseId, moduleId, returnUrl } = req.query;
  const userId = sanitizeLaunchUserId(req.query.userId);

  if (!userId || !scenarioId || !key) {
    return res.status(400).json({ error: 'userId, scenarioId, and key are required' });
  }

  if (!config.SIMULATOR_LAUNCH_KEY) {
    return res.status(401).json({ error: 'Static launch is not configured on this server' });
  }

  // Constant-time comparison to prevent timing attacks on the launch key
  const keyBuffer = Buffer.from(key);
  const secretBuffer = Buffer.from(config.SIMULATOR_LAUNCH_KEY);
  if (keyBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(keyBuffer, secretBuffer)) {
    return res.status(401).json({ error: 'Invalid launch key' });
  }

  const userToken = signUserToken(userId, userId, 'user');
  const params = buildLaunchRedirectParams(userToken, {
    scenarioId, userId, courseId, moduleId, returnUrl,
  });

  logger.info('Unsigned launch redirect', { userId, scenarioId });
  res.redirect(`/?${params.toString()}`);
});

/**
 * POST /launch-lti/:moduleId - LTI 1.1 launch from Docebo.
 * Module ID is encoded in the URL path since Docebo lacks custom parameter support.
 * Verifies OAuth 1.0 signature, resolves persona assignment, redirects to simulator.
 */
app.post('/launch-lti/:moduleId', authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!config.LTI_CONSUMER_KEY || !config.LTI_SHARED_SECRET) {
      return res.status(500).json({ error: 'LTI is not configured on this server' });
    }

    // Verify consumer key matches
    if (req.body.oauth_consumer_key !== config.LTI_CONSUMER_KEY) {
      logger.warn('LTI consumer key mismatch');
      return res.status(401).json({ error: 'Invalid LTI consumer key' });
    }

    // Verify OAuth 1.0 HMAC-SHA1 signature
    const { valid, error } = verifyLtiSignature(req, config.LTI_SHARED_SECRET);
    if (!valid) {
      logger.warn('LTI signature verification failed', { error });
      return res.status(401).json({ error: 'Invalid LTI launch signature' });
    }

    await handleLtiLaunch(req, res);
  } catch (err) {
    logger.error('LTI launch handler failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error during LTI launch' });
    }
  }
});

const VALID_LTI_MODULES = new Set(['module4', 'module5']);
const VALID_PERSONAS = new Set(['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller']);

async function handleLtiLaunch(req, res) {
  const ltiUserId = req.body.lis_person_contact_email_primary
    || req.body.user_id
    || '';
  const userId = sanitizeLaunchUserId(ltiUserId);
  const moduleId = req.params.moduleId;

  logger.info('LTI Launch raw parameters', {
    hasEmail: !!req.body.lis_person_contact_email_primary,
    userId: req.body.user_id,
    extUsername: req.body.ext_user_username,
  });

  if (!userId) {
    return res.status(400).json({ error: 'LTI launch missing user identity' });
  }
  if (!VALID_LTI_MODULES.has(moduleId)) {
    return res.status(400).json({ error: 'Invalid module ID. Must be module4 or module5.' });
  }

  // Resolve persona: prefer Docebo API, fall back to local DB
  let personaId = null;

  if (config.DOCEBO_BASE_URL && config.DOCEBO_CLIENT_ID && config.DOCEBO_CLIENT_SECRET) {
    const { getAssignedPersona } = require('./services/doceboClient');
    const email = req.body.lis_person_contact_email_primary || ltiUserId;
    personaId = await getAssignedPersona(email);
  } else {
    const result = await db.query(
      'SELECT persona_id FROM persona_assignments WHERE external_user_id = $1',
      [userId]
    );
    personaId = result.rows.length > 0 ? result.rows[0].persona_id : null;
  }

  if (!personaId || !VALID_PERSONAS.has(personaId)) {
    return res.status(404).json({ error: 'No valid persona assigned for this user. Contact your administrator.' });
  }

  const scenarioId = `${moduleId}_${personaId}`;

  const userToken = signUserToken(userId, userId, 'user');
  const params = buildLaunchRedirectParams(userToken, {
    scenarioId, userId, moduleId,
  });

  logger.info('LTI launch redirect', { userId, moduleId, personaId, scenarioId });
  res.redirect(`/?${params.toString()}`);
}

/**
 * POST /launch-briefing/:moduleId - LTI 1.1 launch for Pre-call Briefing.
 * Mirrors the simulator launch but redirects to /briefing.html instead of /.
 * Captures LTI Outcomes params for grade passback on drill completion.
 */
app.post('/launch-briefing/:moduleId', authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!config.LTI_CONSUMER_KEY || !config.LTI_SHARED_SECRET) {
      return res.status(500).json({ error: 'LTI is not configured on this server' });
    }

    if (req.body.oauth_consumer_key !== config.LTI_CONSUMER_KEY) {
      logger.warn('LTI briefing consumer key mismatch');
      return res.status(401).json({ error: 'Invalid LTI consumer key' });
    }

    const { valid, error } = verifyLtiSignature(req, config.LTI_SHARED_SECRET);
    if (!valid) {
      logger.warn('LTI briefing signature verification failed', { error });
      return res.status(401).json({ error: 'Invalid LTI launch signature' });
    }

    await handleBriefingLtiLaunch(req, res);
  } catch (err) {
    logger.error('LTI briefing launch handler failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error during LTI briefing launch' });
    }
  }
});

async function handleBriefingLtiLaunch(req, res) {
  const ltiUserId = req.body.lis_person_contact_email_primary
    || req.body.user_id
    || '';
  const userId = sanitizeLaunchUserId(ltiUserId);
  const moduleId = req.params.moduleId;

  if (!userId) {
    return res.status(400).json({ error: 'LTI launch missing user identity' });
  }
  if (!VALID_LTI_MODULES.has(moduleId)) {
    return res.status(400).json({ error: 'Invalid module ID. Must be module4 or module5.' });
  }

  // Resolve persona: custom param > Docebo API > local DB
  let personaId = null;

  // 1. Check for custom LTI parameter
  const customPersona = req.body.custom_assigned_persona;
  if (customPersona && VALID_PERSONAS.has(customPersona)) {
    personaId = customPersona;
  }

  // 2. Fall back to Docebo API
  if (!personaId && config.DOCEBO_BASE_URL && config.DOCEBO_CLIENT_ID && config.DOCEBO_CLIENT_SECRET) {
    const { getAssignedPersona } = require('./services/doceboClient');
    const email = req.body.lis_person_contact_email_primary || ltiUserId;
    personaId = await getAssignedPersona(email);
  }

  // 3. Fall back to local DB
  if (!personaId) {
    const result = await db.query(
      'SELECT persona_id FROM persona_assignments WHERE external_user_id = $1',
      [userId]
    );
    personaId = result.rows.length > 0 ? result.rows[0].persona_id : null;
  }

  if (!personaId || !VALID_PERSONAS.has(personaId)) {
    return res.status(404).json({ error: 'No valid persona assigned for this user. Contact your administrator.' });
  }

  const scenarioId = `${moduleId}_${personaId}`;

  // Build JWT — include LTI Outcomes params if present
  const tokenPayload = { userId, displayName: userId, role: 'user' };

  // Capture Outcomes params for grade passback (optional — only if LMS sends them)
  const outcomeServiceUrl = req.body.lis_outcome_service_url || '';
  const resultSourcedId = req.body.lis_result_sourcedid || '';
  if (outcomeServiceUrl && resultSourcedId) {
    tokenPayload.outcomeServiceUrl = outcomeServiceUrl;
    tokenPayload.resultSourcedId = resultSourcedId;
  } else {
    logger.warn('LTI briefing launch missing Outcomes params — grade sync will be skipped', { userId, moduleId });
  }

  const userToken = config.JWT_SECRET
    ? jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn: '24h' })
    : 'dev-token';

  const params = new URLSearchParams({
    token: userToken,
    scenarioId,
    userId,
    moduleId,
  });

  logger.info('LTI briefing launch redirect', { userId, moduleId, personaId, scenarioId });
  res.redirect(`/briefing.html?${params.toString()}`);
}

// --- Curriculum API ---

const CURRICULUM_DIR = path.join(__dirname, 'curriculum');

/**
 * GET /api/curriculum/:scenarioId - Serve curriculum markdown as JSON.
 * Standalone path avoids the /:id catch-all collision in scenarioRoutes.js.
 */
app.get('/api/curriculum/:scenarioId', (req, res) => {
  const scenarioId = req.params.scenarioId.replace(/[^a-zA-Z0-9_-]/g, '');

  // Validate format: must be moduleId_personaId
  const parts = scenarioId.split('_');
  if (parts.length < 3) {
    return res.status(400).json({ error: 'Invalid scenario ID format' });
  }
  const moduleId = parts.slice(0, 1).join('_');
  if (!VALID_LTI_MODULES.has(moduleId)) {
    return res.status(400).json({ error: 'Invalid module in scenario ID' });
  }

  const filePath = path.join(CURRICULUM_DIR, `${scenarioId}.md`);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(CURRICULUM_DIR))) {
    return res.status(400).json({ error: 'Invalid scenario ID' });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Curriculum not found for this scenario' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return res.json({ data: { content } });
  } catch (err) {
    logger.error('Failed to read curriculum file', { scenarioId, error: err.message });
    return res.status(500).json({ error: 'Failed to load curriculum' });
  }
});

// --- Briefing Completion ---

/**
 * POST /api/briefing/complete - Record briefing drill completion.
 * If LTI Outcomes params are in the JWT, sends grade to the LMS.
 * Fire-and-forget on Outcomes — completion is always saved locally.
 */
app.post('/api/briefing/complete', requireAuth, async (req, res) => {
  const { scenarioId, moduleId } = req.body;
  const userId = req.user.userId;

  if (!scenarioId || !moduleId) {
    return res.status(400).json({ error: 'scenarioId and moduleId are required' });
  }

  // Extract personaId from scenarioId (e.g. 'module4_sam_patel' -> 'sam_patel')
  const personaId = scenarioId.replace(`${moduleId}_`, '');
  if (!VALID_PERSONAS.has(personaId)) {
    return res.status(400).json({ error: 'Invalid persona in scenarioId' });
  }

  try {
    // Check if already completed
    const existing = await db.query(
      'SELECT id FROM briefing_completions WHERE external_user_id = $1 AND module_id = $2 AND persona_id = $3',
      [userId, moduleId, personaId]
    );

    if (existing.rows.length > 0) {
      logger.info('Briefing already completed', { userId, moduleId, personaId });
      return res.json({ data: { status: 'already_completed' } });
    }

    // Attempt LTI Outcomes grade sync (fire-and-forget)
    let ltiSynced = false;
    let ltiError = null;

    if (req.user.outcomeServiceUrl && req.user.resultSourcedId) {
      const result = await sendLtiGrade({
        outcomeServiceUrl: req.user.outcomeServiceUrl,
        resultSourcedId: req.user.resultSourcedId,
        score: 1.0,
      });
      ltiSynced = result.success;
      ltiError = result.error || null;
    } else {
      logger.warn('Briefing completion without LTI Outcomes — saving locally only', { userId, moduleId });
    }

    // Save local completion record
    await db.query(
      `INSERT INTO briefing_completions (external_user_id, module_id, persona_id, score, lti_outcome_synced, lti_outcome_error)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (external_user_id, module_id, persona_id)
       DO UPDATE SET score = $4, lti_outcome_synced = $5, lti_outcome_error = $6, completed_at = NOW()`,
      [userId, moduleId, personaId, 100.0, ltiSynced, ltiError]
    );

    logger.info('Briefing completion recorded', { userId, moduleId, personaId, ltiSynced });
    return res.json({ data: { status: 'completed', ltiSynced } });
  } catch (err) {
    logger.error('Briefing completion failed', { userId, moduleId, error: err.message });
    return res.status(500).json({ error: 'Failed to record briefing completion' });
  }
});

// --- Static Files ---

// Serve rep briefing handouts (PDFs and templates)
app.use('/handouts', express.static(path.join(__dirname, '..', 'docs', 'rep_briefings')));

app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback - serve index.html for all non-API routes
// Exclude briefing.html which is a standalone page
app.get('*', (req, res) => {
  if (req.path === '/briefing.html') {
    return res.sendFile(path.join(__dirname, '..', 'public', 'briefing.html'));
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Error Handler ---

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  logger.error('Server error', { error: err.stack || err.message, path: req.path });
  res.status(err.status || 500).json({
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// --- Start ---

validateConfig();

async function start() {
  try {
    await db.migrate();
  } catch (err) {
    console.error('[SERVER] Migration failed - aborting startup:', err.message);
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    logger.info('Sales Call Simulator running', {
      port: config.PORT,
      environment: config.NODE_ENV,
      tavusConfigured: !!config.TAVUS_API_KEY,
      openaiConfigured: !!config.OPENAI_API_KEY,
      dbConfigured: !!config.DATABASE_URL,
      authConfigured: !!config.JWT_SECRET,
    });
  });

  return server;
}

const serverPromise = start();

// Used by shutdown handlers
let serverInstance = null;
serverPromise.then(s => { serverInstance = s; });

// --- Process Error Handlers ---

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', { error: err.stack || err.message || err });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.stack || err.message || err });
  process.exit(1);
});

// --- Graceful Shutdown ---

// Maximum time to wait for graceful shutdown before forcing exit
const SHUTDOWN_TIMEOUT_MS = 10000;

function shutdown(signal) {
  console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('[SERVER] HTTP server closed.');
      process.exit(0);
    });
  }
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
