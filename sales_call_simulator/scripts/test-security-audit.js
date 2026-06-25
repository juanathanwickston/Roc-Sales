/**
 * Security & Access Control Verification Suite
 * Validates BOLA, IDOR, manager dashboard blocks, admin endpoint gates,
 * and threshold prerequisites. Run via `npm run test:security`.
 */

process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.NODE_ENV = 'test';

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../server/db');
const postCallProcessor = require('../server/services/postCallProcessor');

// Mock scoreTranscript to avoid actual OpenAI API calls
postCallProcessor.scoreTranscript = async () => ({
  overall_score: 95,
  overall_verdict: 'pass',
  raw_score: 95,
  final_score: 95,
  automatic_fails_triggered: [],
  categories: {}
});

// Mock Database Queries
db.isAvailable = () => true;

const mockDbState = {
  sessions: {
    101: { id: 101, external_user_id: 'user-a', scenario_id: 'module4_sam_patel', module_id: 'module4', persona_id: 'sam_patel', status: 'completed', tavus_conversation_id: 'tavus-conv-101', relationship_summary: 'prior notes' },
    102: { id: 102, external_user_id: 'user-b', scenario_id: 'module4_sam_patel', module_id: 'module4', persona_id: 'sam_patel', status: 'completed', tavus_conversation_id: 'tavus-conv-102' },
    103: { id: 103, external_user_id: 'user-a', scenario_id: 'module5_sam_patel', module_id: 'module5', persona_id: 'sam_patel', status: 'created' },
  },
  masteries: {
    'user-a:sam_patel': { mastery_score: 85 }
    // user-a:carla_reyes is omitted initially to simulate no mastery
  }
};

db.query = async (text, params) => {
  const queryNormalized = text.replace(/\s+/g, ' ').trim();

  // 1. SELECT external_user_id FROM simulation_sessions
  if (queryNormalized.includes('SELECT external_user_id FROM simulation_sessions WHERE id = $1')) {
    const id = params[0];
    const session = mockDbState.sessions[id];
    return { rows: session ? [{ external_user_id: session.external_user_id }] : [] };
  }

  // 2. SELECT * FROM simulation_sessions WHERE id = $1
  if (queryNormalized.includes('SELECT * FROM simulation_sessions WHERE id = $1')) {
    const id = params[0];
    const session = mockDbState.sessions[id];
    return { rows: session ? [session] : [] };
  }

  // 3. SELECT tavus_conversation_id FROM simulation_sessions
  if (queryNormalized.includes('SELECT tavus_conversation_id FROM simulation_sessions WHERE id = $1')) {
    const id = params[0];
    const session = mockDbState.sessions[id];
    return { rows: session ? [{ tavus_conversation_id: session.tavus_conversation_id }] : [] };
  }

  // 4. SELECT mastery_score FROM module_masteries
  if (queryNormalized.includes('SELECT mastery_score FROM module_masteries')) {
    const userId = params[0];
    const personaId = params[1];
    const key = `${userId}:${personaId}`;
    const mastery = mockDbState.masteries[key];
    return { rows: mastery ? [mastery] : [] };
  }

  // 5. SELECT relationship_summary FROM simulation_sessions (Module 5 prerequisite summary lookup)
  if (queryNormalized.includes('SELECT relationship_summary') && queryNormalized.includes('module_id = \'module4\'')) {
    const userId = params[0];
    const personaId = params[1];
    const session = Object.values(mockDbState.sessions).find(
      s => s.external_user_id === userId && s.persona_id === personaId && s.module_id === 'module4' && s.relationship_summary
    );
    return { rows: session ? [{ relationship_summary: session.relationship_summary }] : [] };
  }

  // 6. COUNT query for sessions list
  if (queryNormalized.includes('SELECT COUNT(*) AS total FROM simulation_sessions')) {
    return { rows: [{ total: 1 }] };
  }

  // 7. stats query for sessions list
  if (queryNormalized.includes('SELECT MAX(sc.overall_score)')) {
    return { rows: [{ best_score: 90, avg_score: 80, pass_count: 1, scored_total: 1 }] };
  }

  // 8. SELECT sessions list
  if (queryNormalized.includes('SELECT s.id, s.scenario_id')) {
    return { rows: Object.values(mockDbState.sessions).filter(s => s.external_user_id === params[0]) };
  }

  // 9. INSERT INTO simulation_sessions
  if (queryNormalized.includes('INSERT INTO simulation_sessions')) {
    return { rows: [{ id: 104, scenario_id: params[0], external_user_id: params[1], module_id: params[2], persona_id: params[3], status: 'created' }] };
  }

  // 10. SELECT normalized_transcript FROM session_transcripts
  if (queryNormalized.includes('SELECT normalized_transcript FROM session_transcripts')) {
    return { rows: [{ normalized_transcript: 'Hello Rep. Hello Celine.' }] };
  }

  // 11. INSERT/UPDATE session_scores
  if (queryNormalized.includes('INSERT INTO session_scores') || queryNormalized.includes('UPDATE session_scores')) {
    return { rows: [] };
  }

  return { rows: [] };
};

// Setup Test App
const app = express();
app.use(express.json());

const { requireAuth, requireAnyRole } = require('../server/middleware/auth');
const { router: sessionRoutes, adminDashboardHandler } = require('../server/routes/sessionRoutes');
const tavusRoutes = require('../server/routes/tavusRoutes');
const scenarioRoutes = require('../server/routes/scenarioRoutes');

app.use('/api/sessions', requireAuth, sessionRoutes);
app.use('/api/tavus', requireAuth, tavusRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.get('/api/admin/dashboard', requireAuth, requireAnyRole('manager', 'admin'), adminDashboardHandler);

let server;
const PORT = 3009;

// Tokens
const tokenUserA = jwt.sign({ userId: 'user-a', role: 'user' }, process.env.JWT_SECRET);
const tokenUserB = jwt.sign({ userId: 'user-b', role: 'user' }, process.env.JWT_SECRET);
const tokenManager = jwt.sign({ userId: 'manager-1', role: 'manager' }, process.env.JWT_SECRET);
const tokenAdmin = jwt.sign({ userId: 'admin-1', role: 'admin' }, process.env.JWT_SECRET);

async function runAuthTests(assertStatus) {
  // Test 1: Unauthenticated sessions list
  await assertStatus(
    'Unauthenticated sessions list rejected (401)',
    '/api/sessions',
    { method: 'GET' },
    401
  );

  // Test 2: Unauthenticated Tavus launch
  await assertStatus(
    'Unauthenticated Tavus launch rejected (401)',
    '/api/tavus/conversations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 101 })
    },
    401
  );
}

async function runBolaTests(assertStatus) {
  // Test 3: User A reads User B session (BOLA/IDOR)
  await assertStatus(
    'User A reading User B session rejected (403)',
    '/api/sessions/102',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'belongs to another user'
  );

  // Test 4: User A reads User A session
  await assertStatus(
    'User A reading own session allowed (200)',
    '/api/sessions/101',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    200
  );

  // Test 5: Tavus launch with another user's session
  await assertStatus(
    'Tavus launch with another user\'s session rejected (403)',
    '/api/tavus/conversations',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenUserA}`
      },
      body: JSON.stringify({ sessionId: 102 })
    },
    403,
    'belongs to another user'
  );

  // Test 6: Manager dashboard access
  await assertStatus(
    'Manager dashboard access rejected (403)',
    '/api/admin/dashboard',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenManager}` }
    },
    403,
    'cohort scoping is pending integration'
  );

  // Test 7: Manager reading session access
  await assertStatus(
    'Manager reading session rejected (403)',
    '/api/sessions/101',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenManager}` }
    },
    403,
    'cohort scoping is pending integration'
  );

  // Test 8: Admin reading other user's session
  await assertStatus(
    'Admin reading other user\'s session allowed (200)',
    '/api/sessions/101',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    },
    200
  );

  // Test 9: Learner rescore utility call
  await assertStatus(
    'Regular user rescore utility rejected (403)',
    '/api/sessions/101/rescore',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403
  );

  // Test 10: Admin rescore utility call
  await assertStatus(
    'Admin rescore utility allowed (200)',
    '/api/sessions/101/rescore',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    },
    200
  );
}

async function runModuleGatingTests(assertStatus) {
  // Test 11: Module 5 gating block (no mastery for carla_reyes)
  await assertStatus(
    'Module 5 launch without Module 4 mastery rejected (403)',
    '/api/sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenUserA}`
      },
      body: JSON.stringify({ scenarioId: 'module5_carla_reyes' })
    },
    403,
    'Module 4 mastery required'
  );

  // Test 12: Module 5 launch with mastery, but missing relationship summary
  mockDbState.masteries['user-a:carla_reyes'] = { mastery_score: 85 };
  await assertStatus(
    'Module 5 launch with mastery but missing summary rejected (422)',
    '/api/sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenUserA}`
      },
      body: JSON.stringify({ scenarioId: 'module5_carla_reyes' })
    },
    422,
    'No relationship summary found'
  );
}

async function runDataAccessTests(assertStatus) {
  // Test 13: User A reading User B score rejected (403)
  await assertStatus(
    'User A reading User B score rejected (403)',
    '/api/sessions/102/score',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'belongs to another user'
  );

  // Test 14: User A reading User B transcript rejected (403)
  await assertStatus(
    'User A reading User B transcript rejected (403)',
    '/api/sessions/102/transcript',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'belongs to another user'
  );

  // Test 15: User A reading User B coaching rejected (403)
  await assertStatus(
    'User A reading User B coaching rejected (403)',
    '/api/sessions/102/coaching',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'belongs to another user'
  );

  // Test 16: User A reading User B perception rejected (403)
  await assertStatus(
    'User A reading User B perception rejected (403)',
    '/api/sessions/102/perception',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'belongs to another user'
  );

  // Test 17: User A querying User B progress rejected (403)
  await assertStatus(
    'User A querying User B progress rejected (403)',
    '/api/sessions/progress?userId=user-b',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'cannot query progress of other users'
  );

  // Test 18: Manager querying User A progress rejected (403)
  await assertStatus(
    'Manager querying User A progress rejected (403)',
    '/api/sessions/progress?userId=user-a',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenManager}` }
    },
    403,
    'cohort scoping is pending integration'
  );

  // Test 19: User A querying User B sessions list rejected (403)
  await assertStatus(
    'User A querying User B sessions list rejected (403)',
    '/api/sessions?userId=user-b',
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenUserA}` }
    },
    403,
    'cannot query sessions of other users'
  );
}

async function runScenarioTests(assertStatus) {
  // Test 20: Archived scenario fallback details allowed (200)
  await assertStatus(
    'Archived scenario fallback allowed for details (200)',
    '/api/scenarios/module1_identifying_customer',
    { method: 'GET' },
    200
  );

  // Test 21: Launching archived scenario rejected (403)
  await assertStatus(
    'Launching archived scenario rejected (403)',
    '/api/sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenUserA}`
      },
      body: JSON.stringify({ scenarioId: 'module1_identifying_customer' })
    },
    403,
    'Cannot launch an archived scenario'
  );
}

async function runTests() {
  server = app.listen(PORT);
  console.log(`[TEST] Verification server running on port ${PORT}`);

  const failures = [];

  const assertStatus = async (name, url, options, expectedStatus, expectedDetailContains = null) => {
    try {
      const res = await fetch(`http://localhost:${PORT}${url}`, options);
      if (res.status !== expectedStatus) {
        failures.push(`${name}: expected status ${expectedStatus}, got ${res.status}`);
        return;
      }
      if (expectedDetailContains) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail || body.error || JSON.stringify(body);
        if (!detail.toLowerCase().includes(expectedDetailContains.toLowerCase())) {
          failures.push(`${name}: response detail "${detail}" does not contain "${expectedDetailContains}"`);
          return;
        }
      }
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      failures.push(`${name}: request failed with error: ${err.message}`);
    }
  };

  console.log('\n--- Running Security & Access Control Tests ---');
  await runAuthTests(assertStatus);
  await runBolaTests(assertStatus);
  await runModuleGatingTests(assertStatus);
  await runDataAccessTests(assertStatus);
  await runScenarioTests(assertStatus);

  server.close(() => {
    console.log('\n-----------------------------------------------');

    if (failures.length > 0) {
      console.error(`[FAIL] Verification failed with ${failures.length} error(s):`);
      failures.forEach(f => console.error(`  - ${f}`));
      setTimeout(() => process.exit(1), 50);
    } else {
      console.log('[SUCCESS] All verification tests passed successfully.');
      setTimeout(() => process.exit(0), 50);
    }
  });
}

runTests().catch(err => {
  console.error('[FATAL] Verification suite crashed:', err);
  if (server) server.close();
  process.exit(1);
});

