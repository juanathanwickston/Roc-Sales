/**
 * Scenario Management Routes
 * Serves predefined sales training scenarios from JSON files.
 * Updated to use module-based course structure instead of legacy stages.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const { COURSE_MODULES, PERSONA_DISPLAY_NAMES } = require('../modules');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');

// Cache scenarios at startup (H5 - no disk reads per request)
let cachedScenarios = [];

/**
 * Load all scenario files from the scenarios directory.
 * Skips files in the archive/ subdirectory.
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
    logger.info(`Loaded scenario(s) from disk.`, { count: scenarios.length });
  } catch (err) {
    logger.error('Error loading scenarios', { error: err.message });
  }
  return scenarios;
}

cachedScenarios = loadScenarios();

/**
 * GET /api/scenarios/modules - Return the 2-module course structure with persona and scenario availability.
 * Must be defined before /:id to prevent 'modules' matching as a scenario ID.
 */
router.get('/modules', (req, res) => {
  const modules = COURSE_MODULES.map(mod => {
    const personas = {};
    for (const personaId of mod.personas) {
      const scenario = cachedScenarios.find(
        s => s.module_id === mod.id && s.persona_id === personaId
      );

      personas[personaId] = {
        displayName: PERSONA_DISPLAY_NAMES[personaId] || personaId,
        available: scenario !== null && scenario !== undefined,
        scenarioId: scenario ? scenario.id : null,
        scenario: scenario ? {
          id: scenario.id,
          name: scenario.name,
          difficulty: scenario.difficulty,
          module: scenario.module,
          product: scenario.product || null,
          durationMinutes: scenario.duration_minutes,
        } : null,
      };
    }

    return {
      id: mod.id,
      name: mod.name,
      shortName: mod.shortName,
      description: mod.description,
      order: mod.order,
      prerequisiteModuleId: mod.prerequisiteModuleId || null,
      personas,
    };
  });

  return sendSuccess(res, { modules });
});

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
    module_id: s.module_id || null,
    persona_id: s.persona_id || null,
    product: s.product || null,
    durationMinutes: s.duration_minutes,
  }));
  return sendSuccess(res, { scenarios: summaries });
});

/**
 * GET /api/scenarios/:id - Get full scenario details
 */
router.get('/:id', (req, res) => {
  let scenario = cachedScenarios.find(s => s.id === req.params.id);
  if (!scenario) {
    try {
      const archivePath = path.join(SCENARIOS_DIR, 'archive', `${req.params.id}.json`);
      if (fs.existsSync(archivePath)) {
        scenario = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
      }
    } catch (err) {
      logger.warn('Failed to load archived scenario fallback', { scenarioId: req.params.id, error: err.message });
    }
  }
  if (!scenario) {
    return sendError(res, req, 404, 'Scenario not found');
  }
  return sendSuccess(res, scenario);
});

module.exports = router;
