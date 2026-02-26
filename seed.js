/**
 * ROC Academy - Seed Script
 * Populates the database with test data for development.
 *
 * Run with: node seed.js
 * Requires DATABASE_URL and JWT_SECRET environment variables.
 */

const db = require('./server/db');
const auth = require('./server/auth');

const TEAMS = ['East Coast', 'West Coast'];
const DEFAULT_PASSWORD = 'password123';

const REPS = [
  { firstName: 'Alex', lastName: 'Rivera', username: 'arivera' },
  { firstName: 'Jordan', lastName: 'Chen', username: 'jchen' },
  { firstName: 'Taylor', lastName: 'Brooks', username: 'tbrooks' },
  { firstName: 'Casey', lastName: 'Morgan', username: 'cmorgan' },
  { firstName: 'Sam', lastName: 'Patel', username: 'spatel' },
  { firstName: 'Jamie', lastName: 'Kim', username: 'jkim' },
  { firstName: 'Drew', lastName: 'Santos', username: 'dsantos' },
  { firstName: 'Morgan', lastName: 'Walsh', username: 'mwalsh' },
  { firstName: 'Riley', lastName: 'Diaz', username: 'rdiaz' },
  { firstName: 'Quinn', lastName: 'Foster', username: 'qfoster' }
];

async function seed() {
  console.log('');
  console.log('ROC Academy - Seed Data');
  console.log('=======================');
  console.log('');

  try {
    await db.migrate();
    const hash = await auth.hashPassword(DEFAULT_PASSWORD);

    // Create teams
    const teamIds = [];
    for (const name of TEAMS) {
      const result = await db.query(
        'INSERT INTO teams (name, created_by) VALUES ($1, 1) ON CONFLICT DO NOTHING RETURNING id',
        [name]
      );
      if (result.rows.length > 0) {
        teamIds.push(result.rows[0].id);
        console.log(`Created team: ${name} (ID: ${result.rows[0].id})`);
      }
    }

    // Create a manager
    const existing = await db.query("SELECT id FROM users WHERE username = 'manager1'");
    if (existing.rows.length === 0) {
      const mgr = await db.query(
        `INSERT INTO users (username, password_hash, first_name, last_name, role, must_change_password, created_by)
         VALUES ('manager1', $1, 'Dana', 'Thompson', 'manager', TRUE, 1) RETURNING id`,
        [hash]
      );
      console.log(`Created manager: manager1 (ID: ${mgr.rows[0].id})`);

      // Assign manager to all teams
      for (const tid of teamIds) {
        await db.query(
          'INSERT INTO manager_teams (manager_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [mgr.rows[0].id, tid]
        );
      }
    }

    // Create reps
    for (let i = 0; i < REPS.length; i++) {
      const rep = REPS[i];
      const teamId = teamIds[i % teamIds.length];
      const existingRep = await db.query('SELECT id FROM users WHERE username = $1', [rep.username]);
      if (existingRep.rows.length === 0) {
        await db.query(
          `INSERT INTO users (username, password_hash, first_name, last_name, role, team_id, must_change_password, created_by)
           VALUES ($1, $2, $3, $4, 'rep', $5, TRUE, 1)`,
          [rep.username, hash, rep.firstName, rep.lastName, teamId]
        );
        console.log(`Created rep: ${rep.username} (Team: ${TEAMS[i % TEAMS.length]})`);
      }
    }

    console.log('');
    console.log(`All accounts use password: ${DEFAULT_PASSWORD}`);
    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err.message);
  }

  process.exit(0);
}

seed();
