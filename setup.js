/**
 * ROC Academy - Superuser Bootstrap Script
 *
 * Run once to create the initial superuser account:
 *   node setup.js
 *
 * Requires DATABASE_URL and JWT_SECRET environment variables.
 */

const readline = require('readline');
const db = require('./server/db');
const auth = require('./server/auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function setup() {
  console.log('');
  console.log('ROC Academy - Superuser Setup');
  console.log('=============================');
  console.log('');

  try {
    // Run migrations first
    await db.migrate();

    // Check if superuser already exists
    const existing = await db.query(
      "SELECT id, username FROM users WHERE role = 'superuser'"
    );

    if (existing.rows.length > 0) {
      console.log(`Superuser already exists: ${existing.rows[0].username}`);
      console.log('To create another, modify the database directly.');
      rl.close();
      process.exit(0);
    }

    const username = await ask('Username: ');
    const firstName = await ask('First name: ');
    const lastName = await ask('Last name: ');
    const password = await ask('Password (min 8 chars): ');

    if (!username.trim() || !firstName.trim() || !lastName.trim()) {
      console.error('All fields are required.');
      rl.close();
      process.exit(1);
    }

    const passwordError = auth.validatePassword(password);
    if (passwordError) {
      console.error(passwordError);
      rl.close();
      process.exit(1);
    }

    const hash = await auth.hashPassword(password);

    await db.query(
      `INSERT INTO users (username, password_hash, first_name, last_name, role, must_change_password, is_active)
       VALUES ($1, $2, $3, $4, 'superuser', FALSE, TRUE)`,
      [username.toLowerCase().trim(), hash, firstName.trim(), lastName.trim()]
    );

    console.log('');
    console.log(`Superuser "${username.toLowerCase().trim()}" created successfully.`);
    console.log('You can now log in to ROC Academy.');
  } catch (err) {
    console.error('Setup failed:', err.message);
  }

  rl.close();
  process.exit(0);
}

setup();
