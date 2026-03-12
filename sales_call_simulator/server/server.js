/**
 * Sales Call Simulator - Express Server
 * Pattern adapted from roc_academy/server/server.js
 */

const path = require('path');

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { config, validateConfig } = require('./config');
const db = require('./db');

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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// --- API Routes ---

const { optionalAuth, verifyLaunchToken } = require('./middleware/auth');
const tavusRoutes = require('./routes/tavusRoutes');
const scenarioRoutes = require('./routes/scenarioRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

// optionalAuth: populates req.user when JWT is present (integrated mode),
// but never blocks requests (standalone/staging mode).
// Hard auth enforcement happens at the ROC Academy gateway level.

app.use('/api/tavus', optionalAuth, tavusRoutes);
app.use('/api/scenarios', scenarioRoutes); // Always public
app.use('/api/sessions', optionalAuth, sessionRoutes);

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
  console.error('[Server Error]', err.stack || err.message);
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
    console.log(`\nSales Call Simulator running on http://localhost:${config.PORT}`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Tavus API: ${config.TAVUS_API_KEY ? 'configured' : 'NOT SET'}`);
    console.log(`   OpenAI:    ${config.OPENAI_API_KEY ? 'configured' : 'NOT SET'}`);
    console.log(`   Database:  ${config.DATABASE_URL ? 'configured' : 'NOT SET'}`);
    console.log(`   Auth:      ${config.JWT_SECRET ? 'configured' : 'disabled (dev mode)'}\n`);

    // DIAGNOSTIC: one-shot fetch to confirm events array structure
    // Remove after diagnosis is complete
    if (config.TAVUS_API_KEY) {
      setTimeout(async () => {
        try {
          const diagConvId = 'c5473259e3833408';
          console.log(`[DIAGNOSTIC] Fetching events structure for ${diagConvId}...`);
          const { tavusFetch } = require('./services/tavusClient');
          const data = await tavusFetch(`/conversations/${diagConvId}?verbose=true`);

          // Confirm events array exists
          console.log(`[DIAGNOSTIC] events is array: ${Array.isArray(data.events)}, length: ${data.events ? data.events.length : 0}`);

          // Log each event's keys and event_type
          if (Array.isArray(data.events)) {
            data.events.forEach((evt, i) => {
              const keys = Object.keys(evt);
              console.log(`[DIAGNOSTIC] events[${i}] keys: ${JSON.stringify(keys)}, event_type: ${evt.event_type || evt.type || 'N/A'}`);
            });

            // Find the transcription event and log its properties structure
            const txnEvent = data.events.find(e => e.event_type === 'application.transcription_ready');
            if (txnEvent) {
              console.log(`[DIAGNOSTIC] FOUND transcription_ready event`);
              console.log(`[DIAGNOSTIC] txnEvent.properties type: ${typeof txnEvent.properties}, isObj: ${typeof txnEvent.properties === 'object'}`);
              if (txnEvent.properties) {
                console.log(`[DIAGNOSTIC] txnEvent.properties keys: ${JSON.stringify(Object.keys(txnEvent.properties))}`);
                const t = txnEvent.properties.transcript;
                console.log(`[DIAGNOSTIC] properties.transcript type: ${typeof t}, isArray: ${Array.isArray(t)}, length: ${Array.isArray(t) ? t.length : 'N/A'}`);
                if (Array.isArray(t) && t.length > 0) {
                  console.log(`[DIAGNOSTIC] First entry keys: ${JSON.stringify(Object.keys(t[0]))}`);
                  console.log(`[DIAGNOSTIC] First entry sample: ${JSON.stringify(t[0]).substring(0, 200)}`);
                }
              }
            } else {
              console.log(`[DIAGNOSTIC] transcription_ready event NOT FOUND`);
              // Check if it uses a different key
              const allTypes = data.events.map(e => e.event_type || e.type || 'unknown');
              console.log(`[DIAGNOSTIC] All event types: ${JSON.stringify(allTypes)}`);
            }

            // Find perception analysis event
            const paEvent = data.events.find(e => e.event_type === 'application.perception_analysis');
            console.log(`[DIAGNOSTIC] perception_analysis event found: ${!!paEvent}`);
            if (paEvent && paEvent.properties) {
              console.log(`[DIAGNOSTIC] perception properties keys: ${JSON.stringify(Object.keys(paEvent.properties))}`);
            }
          }
        } catch (err) {
          console.error(`[DIAGNOSTIC] Failed: ${err.message}`);
        }
      }, 5000);
    }
  });

  return server;
}

const serverPromise = start();

// Used by shutdown handlers
let serverInstance = null;
serverPromise.then(s => { serverInstance = s; });

// --- Process Error Handlers ---

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
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
