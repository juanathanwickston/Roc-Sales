/**
 * Scenario Management Routes
 * Serves predefined sales training scenarios from JSON files.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');

// Cache scenarios at startup (H5 - no disk reads per request)
let cachedScenarios = [];

/**
 * Load all scenario files from the scenarios directory.
 * Called once at module init.
 */
function loadScenarios() {
  const scenarios = [];
  try {
    const files = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(SCENARIOS_DIR, file), 'utf-8');
      scenarios.push(JSON.parse(raw));
    }
    console.log(`[Scenarios] Loaded ${scenarios.length} scenario(s) from disk.`);
  } catch (err) {
    console.error('[Scenarios] Error loading scenarios:', err.message);
  }
  return scenarios;
}

cachedScenarios = loadScenarios();

/**
 * GET /api/scenarios - List all available scenarios (summary view)
 */
router.get('/', (req, res) => {
  const summaries = cachedScenarios.map(s => ({
    id: s.id,
    name: s.name,
    difficulty: s.difficulty,
    description: s.description,
    module: s.module,
    durationMinutes: s.duration_minutes,
  }));
  res.json({ scenarios: summaries });
});

/**
 * GET /api/scenarios/:id - Get full scenario details
 */
router.get('/:id', (req, res) => {
  const scenario = cachedScenarios.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  res.json(scenario);
});

module.exports = router;
