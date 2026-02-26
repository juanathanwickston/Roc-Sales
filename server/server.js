/**
 * ROC Academy - Express Server
 * Serves static frontend and API routes.
 */

const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 400) {
      console.warn(log);
    } else if (duration > 500) {
      console.warn(log + ' (slow)');
    }
  });
  next();
});

// CORS - locked to same origin (static files served from same server)
// For development, allow all origins; in production, same-origin only.
if (process.env.NODE_ENV !== 'main') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

// ─── API ROUTES ───

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/scores', require('./routes/scoreRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/cms', require('./routes/cmsRoutes'));

// Profile nickname update
const requireAuth = require('./middleware/requireAuth');
app.put('/api/profile/nickname', requireAuth, async (req, res) => {
  const { nickname } = req.body;
  if (nickname !== undefined && typeof nickname === 'string' && nickname.length > 100) {
    return res.status(400).json({ error: 'Nickname must be 100 characters or less' });
  }
  try {
    await db.query(
      'UPDATE users SET nickname = $1 WHERE id = $2',
      [nickname ? nickname.trim() : null, req.user.id]
    );
    res.json({ message: 'Nickname updated' });
  } catch (err) {
    console.error('[PROFILE] Nickname error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.healthCheck();
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
    version: '1.0.0'
  });
});

// ─── STATIC FILES ───

app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── START ───

async function start() {
  try {
    console.log('[SERVER] Running database migrations...');
    await db.migrate();
    console.log('[SERVER] Migrations complete.');

    // Auto-bootstrap superuser if none exists
    await bootstrapSuperuser();

    app.listen(PORT, () => {
      console.log(`[SERVER] ROC Academy running on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[SERVER] Failed to start:', err.message);
    process.exit(1);
  }
}

/**
 * Create the superuser on first deploy if SUPERUSER_USERNAME and
 * SUPERUSER_PASSWORD are set in environment variables.
 * Runs only once — skips if any superuser already exists.
 */
async function bootstrapSuperuser() {
  const existing = await db.query("SELECT id FROM users WHERE role = 'superuser'");
  if (existing.rows.length > 0) return;

  const username = process.env.SUPERUSER_USERNAME;
  const password = process.env.SUPERUSER_PASSWORD;

  if (!username || !password) {
    console.warn('[SERVER] No superuser found. Set SUPERUSER_USERNAME and SUPERUSER_PASSWORD env vars to auto-create.');
    return;
  }

  const auth = require('./auth');
  const hash = await auth.hashPassword(password);

  await db.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, role, must_change_password, is_active)
     VALUES ($1, $2, 'Admin', 'User', 'superuser', FALSE, TRUE)`,
    [username.toLowerCase().trim(), hash]
  );

  console.log(`[SERVER] Superuser "${username}" created automatically.`);
}

start();

