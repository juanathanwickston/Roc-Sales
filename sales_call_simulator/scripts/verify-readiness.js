#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

// Load env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { config } = require('../server/config');

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${name} - ${detail}`);
    failed++;
  }
}

console.log('\n--- Sales Call Simulator: Launch Readiness ---\n');

// 1. Environment variables
console.log('Environment Variables:');
check('JWT_SECRET is set', !!config.JWT_SECRET, 'Set JWT_SECRET in .env');
check('DATABASE_URL is set', !!config.DATABASE_URL, 'Set DATABASE_URL in .env');
check('TAVUS_API_KEY is set', !!config.TAVUS_API_KEY, 'Set TAVUS_API_KEY in .env');
check('OPENAI_API_KEY is set', !!config.OPENAI_API_KEY, 'Set OPENAI_API_KEY in .env');
if (config.TRAINING_ACCESS_CODE) {
  console.log('  [PASS] TRAINING_ACCESS_CODE is set');
  passed++;
} else {
  console.log('  [NOTE] TRAINING_ACCESS_CODE is not set - login will not require an access code');
}
check('JWT_SECRET is not default', config.JWT_SECRET !== 'REPLACE_ME', 'Change JWT_SECRET from default value');

// 2. Scenarios
console.log('\nScenarios:');
const scenarioDir = path.join(__dirname, '..', 'server', 'scenarios');
try {
  const files = fs.readdirSync(scenarioDir).filter(f => f.endsWith('.json') && !f.startsWith('.'));
  check('Scenario files found', files.length >= 8, `Expected 8 scenarios, found ${files.length}`);
  
  let allValid = true;
  for (const file of files) {
    try {
      const scenario = JSON.parse(fs.readFileSync(path.join(scenarioDir, file), 'utf8'));
      const hasPersona = !!(scenario.persona_id_tavus || scenario.persona_id);
      const hasName = !!scenario.name;
      if (!hasPersona || !hasName) {
        console.log(`    [WARN] ${file}: missing ${!hasPersona ? 'persona_id_tavus' : ''} ${!hasName ? 'name' : ''}`);
        allValid = false;
      }
    } catch (e) {
      console.log(`    [WARN] ${file}: invalid JSON - ${e.message}`);
      allValid = false;
    }
  }
  check('All scenarios valid', allValid, 'Some scenarios have missing fields');
} catch (e) {
  check('Scenario directory exists', false, `${scenarioDir} not found`);
}

// 3. Facilitator IDs
console.log('\nFacilitator Config:');
check('FACILITATOR_IDS configured', config.FACILITATOR_IDS && config.FACILITATOR_IDS.length > 0, 'Set FACILITATOR_IDS in .env');
if (config.FACILITATOR_IDS) {
  console.log(`    Facilitators: ${config.FACILITATOR_IDS.join(', ')}`);
}

// 4. Database
console.log('\nDatabase:');
if (config.DATABASE_URL) {
  const db = require('../server/db');
  db.healthCheck()
    .then(result => {
      check('Database reachable', result.status === 'healthy', 'Database health check failed');
      printSummary();
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(err => {
      check('Database reachable', false, err.message);
      printSummary();
      process.exit(1);
    });
} else {
  check('Database reachable', false, 'DATABASE_URL not set');
  printSummary();
  process.exit(1);
}

function printSummary() {
  console.log(`\n-----------------------------------------------`);
  console.log(`[${failed === 0 ? 'READY' : 'NOT READY'}] ${passed} passed, ${failed} failed`);
  console.log(`-----------------------------------------------\n`);
}
