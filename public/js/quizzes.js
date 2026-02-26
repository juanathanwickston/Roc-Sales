// ===== ROC ACADEMY — QUIZ POOLS =====
// PRODUCT, COMP, and CERT now load from CMS API.
// Game scenario data (FLOOR, BLITZ, TERR, COACH) stays in content.js.

let PRODUCT = [];
let COMP = [];
let CERT = [];

/**
 * Load all quiz pools from CMS API. Called once on app init.
 */
async function loadQuizzes() {
  try {
    const [prod, comp, cert] = await Promise.all([
      API.getQuizPool('productIQ'),
      API.getQuizPool('compIQ'),
      API.getQuizPool('certification')
    ]);
    PRODUCT = prod || [];
    COMP = comp || [];
    CERT = cert || [];
    console.log(`[CMS] Loaded quizzes: PRODUCT(${PRODUCT.length}) COMP(${COMP.length}) CERT(${CERT.length})`);
  } catch (e) {
    console.error('[CMS] Failed to load quizzes:', e.message);
  }
}
