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

    // Auto-seed CMS content if tables are empty
    await seedCmsContent();

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
 * Seed CMS content tables on first deploy.
 * Runs only once — skips if any modules already exist.
 */
async function seedCmsContent() {
  try {
    const existing = await db.query('SELECT COUNT(*) as cnt FROM cms_modules');
    if (parseInt(existing.rows[0].cnt) > 0) return;

    console.log('[SERVER] CMS tables empty. Seeding content...');
    const seedData = require('../seed_content_data');
    
    for (let i = 0; i < seedData.MODULES.length; i++) {
      const m = seedData.MODULES[i];
      await db.query(
        `INSERT INTO cms_modules (id, phase, title, description, icon, game_id, game_title, game_desc, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.phase, m.title, m.desc, m.icon, m.game_id, m.game_title, m.game_desc, i]
      );
      for (let j = 0; j < (m.videos || []).length; j++) {
        const v = m.videos[j];
        await db.query(
          `INSERT INTO cms_videos (module_id, title, url, description, icon, sort_order)
           SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM cms_videos WHERE module_id=$1 AND title=$2)`,
          [m.id, v.title, v.url || null, v.desc, v.icon, j]
        );
      }
      for (let j = 0; j < (m.docs || []).length; j++) {
        const d = m.docs[j];
        await db.query(
          `INSERT INTO cms_doc_sections (module_id, heading, body, sort_order)
           SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM cms_doc_sections WHERE module_id=$1 AND heading=$2)`,
          [m.id, d.h, d.body, j]
        );
      }
      for (let j = 0; j < (m.apply_items || []).length; j++) {
        const a = m.apply_items[j];
        const text = typeof a === 'string' ? a : a.text;
        const type = (typeof a === 'object' && a.type) ? a.type : 'text';
        const url = (typeof a === 'object' && a.url) ? a.url : null;
        const icon = (typeof a === 'object' && a.icon) ? a.icon : null;
        await db.query(
          `INSERT INTO cms_apply_items (module_id, text, item_type, url, icon, sort_order)
           SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM cms_apply_items WHERE module_id=$1 AND text=$2)`,
          [m.id, text, type, url, icon, j]
        );
      }
      console.log(`  ✓ ${m.id}: ${m.title}`);
    }

    for (const [pool, questions] of Object.entries(seedData.QUIZZES)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.query(
          `INSERT INTO cms_quiz_questions (pool, question, options, correct_index, explanation, sort_order)
           SELECT $1,$2,$3::jsonb,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM cms_quiz_questions WHERE pool=$1 AND question=$2)`,
          [pool, q.q, JSON.stringify(q.opts), q.c, q.exp, i]
        );
      }
      console.log(`  ✓ ${pool}: ${questions.length} questions`);
    }

    console.log('[SERVER] CMS content seeded successfully.');
  } catch (err) {
    // Don't crash the server if seeding fails — tables might not exist yet
    console.warn('[SERVER] CMS seed skipped:', err.message);
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

