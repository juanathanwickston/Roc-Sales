/**
 * Sales Call Simulator - Express Server
 */

const path = require('path');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
  if (!config.LTI_CONSUMER_KEY || !config.LTI_SHARED_SECRET) {
    return res.status(500).json({ error: 'LTI is not configured on this server' });
  }

  const lti = require('ims-lti');
  const provider = new lti.Provider(config.LTI_CONSUMER_KEY, config.LTI_SHARED_SECRET);

  provider.valid_request(req, (err, isValid) => {
    if (err || !isValid) {
      logger.warn('LTI signature verification failed', { error: err ? err.message : 'invalid' });
      return res.status(401).json({ error: 'Invalid LTI launch signature' });
    }

    handleLtiLaunch(req, res);
  });
});

const VALID_LTI_MODULES = new Set(['module4', 'module5']);

async function handleLtiLaunch(req, res) {
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

  const assignmentResult = await db.query(
    'SELECT persona_id FROM persona_assignments WHERE external_user_id = $1',
    [userId]
  );

  if (assignmentResult.rows.length === 0) {
    return res.status(404).json({ error: 'No persona assigned for this user. Contact your administrator.' });
  }

  const personaId = assignmentResult.rows[0].persona_id;
  const scenarioId = `${moduleId}_${personaId}`;

  const userToken = signUserToken(userId, userId, 'user');
  const params = buildLaunchRedirectParams(userToken, {
    scenarioId, userId, moduleId,
  });

  logger.info('LTI launch redirect', { userId, moduleId, personaId, scenarioId });
  res.redirect(`/?${params.toString()}`);
}

// --- Static Files ---

app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
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
