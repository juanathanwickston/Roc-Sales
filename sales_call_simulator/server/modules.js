/**
 * Course Module Definitions
 * The 2-module course structure for the Sales Call Simulator.
 * Each module maps to 4 merchant persona scenarios.
 * Replaces the legacy 6-stage pipeline from stages.js.
 */

const COURSE_MODULES = [
  {
    id: 'module1',
    name: 'Module 1: Discovery & Make the Sale',
    shortName: 'Discovery',
    description: 'Conduct effective discovery, identify business pain points, align the correct Payroc solution, and earn a next step.',
    order: 1,
    personas: ['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller'],
  },
  {
    id: 'module2',
    name: 'Module 2: Close the Sale',
    shortName: 'Close',
    description: 'Handle objections, reinforce value, and close with confidence using relationship context from Module 1.',
    order: 2,
    prerequisiteModuleId: 'module1',
    personas: ['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller'],
  },
];

const PERSONA_DISPLAY_NAMES = {
  sam_patel: 'Sam Patel – QuickStop Market',
  carla_reyes: 'Carla Reyes – Studio Collective Salon',
  mike_turner: 'Mike Turner – Precision Plumbing & Drain',
  david_miller: 'Pastor David Miller – New Hope Community Church',
};

module.exports = { COURSE_MODULES, PERSONA_DISPLAY_NAMES };
