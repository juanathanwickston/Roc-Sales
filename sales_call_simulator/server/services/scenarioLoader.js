'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');

// Cache scenarios at startup
const scenarioCache = new Map();

function loadAll() {
  try {
    const files = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const scenario = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, file), 'utf8'));
      if (scenario.id) scenarioCache.set(scenario.id, scenario);
    }
    logger.info('Scenarios cached', { count: scenarioCache.size });
  } catch (err) {
    logger.error('Failed to load scenarios', { error: err.message });
  }
}

loadAll();

function getScenario(scenarioId) {
  return scenarioCache.get(scenarioId) || null;
}

function getAllScenarios() {
  return Array.from(scenarioCache.values());
}

module.exports = { getScenario, getAllScenarios, SCENARIOS_DIR };
