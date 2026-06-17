/**
 * Sales Call Simulator - Express Server
 * Pattern adapted from roc_academy/server/server.js
 */

const path = require('path');
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
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://*.daily.co"],
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

// CORS - accept requests from ROC Academy
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
  const userId = displayName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const role = config.FACILITATOR_IDS.includes(userId) ? 'admin' : 'user';

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

// Health check
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.healthCheck();
  res.json({
    status: 'ok',
    service: 'sales-call-simulator',
    timestamp: new Date().toISOString(),
    tavusConfigured: !!config.TAVUS_API_KEY,
    openaiConfigured: !!config.OPENAI_API_KEY,
    db: dbStatus,
  });
});

// --- Launch Route ---

/**
 * GET /launch?token=... - ROC Academy signed launch entry point.
 * Validates the JWT, then redirects to the simulator with launch context
 * as query params. The frontend reads these params on load.
 */
app.get('/launch', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Launch token is required' });
  }

  const launch = verifyLaunchToken(token);
  if (!launch) {
    return res.status(401).json({ error: 'Invalid or expired launch token' });
  }

  // Redirect to the app with launch context as query params
  const params = new URLSearchParams({
    scenarioId: launch.scenarioId,
    userId: launch.userId,
    ...(launch.courseId && { courseId: launch.courseId }),
    ...(launch.moduleId && { moduleId: launch.moduleId }),
    ...(launch.returnUrl && { returnUrl: launch.returnUrl }),
  });

  console.log(`[Launch] User ${launch.userId} launching scenario ${launch.scenarioId}`);
  res.redirect(`/?${params.toString()}`);
});

// --- Static Files ---

app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// --- Error Handler ---

app.use((err, req, res, _next) => {
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
