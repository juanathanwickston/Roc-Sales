// ===== ROC ACADEMY — MODULE DEFINITIONS =====
// MODULES loads from CMS API on init. PHASES stays hardcoded.
// Game data lives in content.js. Game engines live in game.js.

// MODULES starts empty — populated by loadModules() on init
let MODULES = [];

/**
 * Load modules from CMS API. Called once on app init.
 * Returns the loaded array; also sets the global MODULES.
 */
async function loadModules(pathwayId) {
  try {
    const data = await API.getModules(pathwayId);
    if (Array.isArray(data) && data.length > 0) {
      MODULES = data;
      console.log(`[CMS] Loaded ${MODULES.length} modules from API`);
    } else {
      console.warn('[CMS] API returned empty modules');
    }
  } catch (e) {
    console.error('[CMS] Failed to load modules:', e.message);
  }
  return MODULES;
}

// Phase metadata with Behavioral Standards (L&D Pillar)
// Stays hardcoded — rarely changes, coupled to UI layout
const PHASES = [
  { num:1, title:'Foundation', days:'Days 1-30', color:'blue',
    desc:'Build your product knowledge, understand your compensation, and master the sales process.',
    standards:[
      {level:'Expert',desc:'Articulates all products, comp mechanics, and full 6-stage process from memory. Customizes pitch to prospect type without notes.'},
      {level:'Competent',desc:'Solid product knowledge. Understands 6-stage process and comp math. May reference notes for edge cases.'},
      {level:'Practicing',desc:'Knows products at surface level. Can walk through sales stages with prompting. Needs calculator for margin math.'}
    ]},
  { num:2, title:'Applied Skill', days:'Days 30-60', color:'orange',
    desc:'Handle objections, cross-sell effectively, and own your territory.',
    standards:[
      {level:'Expert',desc:'Handles all objections instinctively with real math. Spots cross-sell signals mid-conversation. Runs a disciplined territory cadence daily.'},
      {level:'Competent',desc:'Handles top objections with prepared responses. Identifies obvious cross-sell opportunities. Maintains a basic territory plan.'},
      {level:'Practicing',desc:'Recognizes common objections but responses lack precision. Cross-sell feels forced. Territory plan is reactive, not proactive.'}
    ]},
  { num:3, title:'Performance Validation', days:'Days 60-90', color:'green',
    desc:'Prove your skills with full simulations, coaching, and final certification.',
    standards:[
      {level:'Expert',desc:'Executes full sales conversations independently. Seeks coaching. Pipeline built and producing. Ready to represent Payroc alone.'},
      {level:'Competent',desc:'Can run most sales conversations with minimal support. Accepts coaching. Pipeline growing but not yet self-sustaining.'},
      {level:'Practicing',desc:'Needs manager support on complex conversations. Beginning to apply coaching. Pipeline is early-stage.'}
    ]}
];
