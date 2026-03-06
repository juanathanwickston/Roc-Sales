/**
 * Sales Call Simulator — Express Server
 * Pattern adapted from roc_academy/server/server.js
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { config, validateConfig } = require('./config');

const app = express();

// Trust first proxy (Railway) — required for express-rate-limit
app.set('trust proxy', 1);

// ─── Middleware ───

// Security headers (relaxed CSP for Daily.co WebRTC)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        connectSrc: [
          "'self'",
          "https://tavusapi.com",
          "https://*.daily.co",
          "https://*.wss.daily.co",
          "wss://*.daily.co",
          "https://api.openai.com",
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

// CORS — accept requests from ROC Academy
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

// Rate limiting (adapted from support_chatbot/main.py)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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

// ─── API Routes ───

const { requireAuth } = require('./middleware/auth');
const tavusRoutes = require('./routes/tavusRoutes');
const scenarioRoutes = require('./routes/scenarioRoutes');
const scoringRoutes = require('./routes/scoringRoutes');

// Auth is enforced only when JWT_SECRET is configured (production/integration).
// For standalone staging, auth is skipped so the simulator works without ROC Academy login.
const authMiddleware = config.JWT_SECRET ? requireAuth : (req, res, next) => next();

if (!config.JWT_SECRET) {
  console.warn('[Server] ⚠️  JWT_SECRET not set — auth is DISABLED (staging mode)');
}

app.use('/api/tavus', authMiddleware, tavusRoutes);
app.use('/api/scenarios', scenarioRoutes); // Always public
app.use('/api/scoring', authMiddleware, scoringRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sales-call-simulator',
    timestamp: new Date().toISOString(),
    tavusConfigured: !!config.TAVUS_API_KEY,
    openaiConfigured: !!config.OPENAI_API_KEY,
  });
});

// ─── Static Files ───

app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ─── Error Handler ───

app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ─── Start ───

validateConfig();

const server = app.listen(config.PORT, () => {
  console.log(`\n🎙️  Sales Call Simulator running on http://localhost:${config.PORT}`);
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Tavus API: ${config.TAVUS_API_KEY ? '✅ configured' : '❌ not set'}`);
  console.log(`   OpenAI:    ${config.OPENAI_API_KEY ? '✅ configured' : '❌ not set'}`);
  console.log(`   Auth:      ${config.JWT_SECRET ? '✅ configured' : '⚠️  disabled (dev mode)'}\n`);
});

// ─── Process Error Handlers ───

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

// ─── Graceful Shutdown ───

function shutdown(signal) {
  console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
