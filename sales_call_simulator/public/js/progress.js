/**
 * Progress Dashboard — 2-Module LMS Course Layout
 * Renders the home screen: module cards, scenario selector modal,
 * performance sidebar, and certificate section.
 * Data comes from GET /api/scenarios/modules and GET /api/sessions/progress.
 */

/* global esc, app */

/**
 * Persona metadata — static lookup for display info.
 * Each persona maps to a name, business, product, and icon.
 */
const PERSONA_META = {
  sam_patel: {
    name: 'Sam Patel',
    business: 'QuickStop Market',
    product: 'Bodega AI',
    initials: 'SP'
  },
  carla_reyes: {
    name: 'Carla Reyes',
    business: 'Studio Collective Salon',
    product: 'Roc Terminal+',
    initials: 'CR'
  },
  mike_turner: {
    name: 'Mike Turner',
    business: 'Precision Plumbing & Drain',
    product: 'Roc Services',
    initials: 'MT'
  },
  david_miller: {
    name: 'Pastor David Miller',
    business: 'New Hope Community Church',
    product: 'Roc Giving',
    initials: 'DM'
  }
};

/**
 * Module metadata — static descriptions for each module.
 */
const MODULE_META = {
  module1: {
    number: 1,
    name: 'Discovery & Qualification',
    description: 'Build rapport, ask the right discovery questions, qualify using BANT/CHAMP, and close for a next step.'
  },
  module2: {
    number: 2,
    name: 'Objection Handling & Close',
    description: 'Handle real-world objections, present tailored solutions, and guide the prospect toward a buying decision.'
  }
};

/**
 * Cached data from the last loadProgress() call.
 */
let _cachedModules = null;
let _cachedProgress = null;

/**
 * Load progress data from the server and render the dashboard.
 * Called from app.init() after scenarios are loaded.
 */
function loadProgress() {
  return Promise.all([
    fetchWithAuth('/api/scenarios/modules'),
    fetchWithAuth('/api/sessions/progress')
  ]).then(function(results) {
    const modulesRes = results[0];
    const progressRes = results[1];

    if (!modulesRes.ok) {
      return modulesRes.json().then(function(err) {
        throw new Error(err.detail || err.error || 'Failed to load modules');
      }).catch(function() {
        throw new Error('Failed to load modules (' + modulesRes.status + ')');
      });
    }
    if (!progressRes.ok) {
      return progressRes.json().then(function(err) {
        throw new Error(err.detail || err.error || 'Failed to load progress');
      }).catch(function() {
        throw new Error('Failed to load progress (' + progressRes.status + ')');
      });
    }

    return Promise.all([
      modulesRes.json(),
      progressRes.json()
    ]);
  }).then(function(data) {
    const modulesData = data[0].data;
    const progressData = data[1].data;

    _cachedModules = modulesData;
    _cachedProgress = progressData;

    renderModuleCards(modulesData, progressData);
    renderPerformanceSidebar(progressData);
    renderCertificate(progressData);
  }).catch(function(err) {
    console.error('[Progress] Failed to load progress:', err);
    renderModuleCardsFallback();
  });
}

/**
 * Render fallback module cards when API fails (show static module info).
 */
function renderModuleCardsFallback() {
  const container = document.getElementById('module-cards');
  if (!container) return;

  let html = '';
  const moduleIds = ['module1', 'module2'];

  for (let i = 0; i < moduleIds.length; i++) {
    const moduleId = moduleIds[i];
    const meta = MODULE_META[moduleId] || {};
    const isLocked = moduleId === 'module2';

    html += '<div class="module-card' + (isLocked ? ' module-card-locked' : '') + '" data-module-id="' + moduleId + '">' +
      '<div class="module-card-header">' +
        '<div class="module-card-number">Module ' + String(meta.number || (i + 1)).padStart(2, '0') + '</div>' +
        '<h3 class="module-card-name">' + esc(meta.name || moduleId) + '</h3>' +
        '<span class="module-card-status-badge ' + (isLocked ? 'module-status-locked' : 'module-status-available') + '">' +
          (isLocked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Locked' : 'Available') +
        '</span>' +
      '</div>' +
      '<p class="module-card-desc">' + esc(meta.description || '') + '</p>' +
      (isLocked
        ? '<p class="module-card-lock-msg">Complete Module 1 to unlock this module.</p>'
        : '<button class="btn btn-primary module-card-cta" data-module-id="' + moduleId + '" type="button">Start Practice</button>') +
    '</div>';
  }

  container.innerHTML = html;
}

/**
 * Compute module mastery status for a given module and progress data.
 * Returns: 'mastered', 'available', or 'locked'.
 */
function getModuleStatus(moduleId, progressData) {
  const modules = progressData?.modules ?? {};
  const mod = modules[moduleId];

  if (moduleId === 'module2') {
    // Module 2 is locked unless at least one persona is mastered in Module 1
    const mod1 = modules['module1'];
    if (!mod1 || !mod1.personas) return 'locked';
    let anyMastered = false;
    const personas = mod1.personas;
    for (const key in personas) {
      if (personas.hasOwnProperty(key) && personas[key].mastered) {
        anyMastered = true;
        break;
      }
    }
    if (!anyMastered) return 'locked';
  }

  // Check if any persona is mastered (single-assignment model: 1 mastered = module mastered)
  if (mod && mod.personas) {
    const personas2 = mod.personas;
    for (const k in personas2) {
      if (personas2.hasOwnProperty(k) && personas2[k].mastered) {
        return 'mastered';
      }
    }
  }

  return 'available';
}

/**
 * Count mastered personas for a module.
 */
function countMasteredPersonas(moduleId, progressData) {
  const modules = progressData?.modules ?? {};
  const mod = modules[moduleId];
  if (!mod || !mod.personas) return 0;

  let count = 0;
  const personas = mod.personas;
  for (const key in personas) {
    if (personas.hasOwnProperty(key) && personas[key].mastered) {
      count++;
    }
  }
  return count;
}

/**
 * Render the 2 module cards in the journey column.
 */
function renderModuleCards(modulesData, progressData) {
  const container = document.getElementById('module-cards');
  if (!container) return;

  const moduleIds = ['module1', 'module2'];
  let html = '';

  for (let i = 0; i < moduleIds.length; i++) {
    const moduleId = moduleIds[i];
    const meta = MODULE_META[moduleId] || {};
    const status = getModuleStatus(moduleId, progressData);
    const mastered = countMasteredPersonas(moduleId, progressData);
    const totalPersonas = 1;

    let cardClass = 'module-card';
    if (status === 'locked') cardClass += ' module-card-locked';
    if (status === 'mastered') cardClass += ' module-card-mastered';

    let statusBadgeClass = 'module-card-status-badge ';
    let statusBadgeText = '';
    if (status === 'mastered') {
      statusBadgeClass += 'module-status-mastered';
      statusBadgeText = 'Mastered';
    } else if (status === 'locked') {
      statusBadgeClass += 'module-status-locked';
      statusBadgeText = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Locked';
    } else {
      statusBadgeClass += 'module-status-available';
      statusBadgeText = 'Available';
    }

    // Progress bar for assigned scenario
    let progressBarHtml = '';
    if (status !== 'locked') {
      const masteredCount = mastered > 0 ? 1 : 0;
      progressBarHtml = '<div class="module-card-progress">' +
        '<div class="module-card-progress-bar">' +
          '<div class="module-card-progress-fill" style="width:' + (masteredCount * 100) + '%"></div>' +
        '</div>' +
        '<span class="module-card-progress-text">' + (mastered > 0 ? 'Assigned scenario mastered' : 'Complete your assigned scenario') + '</span>' +
      '</div>';
    }

    html += '<div class="' + cardClass + '" data-module-id="' + moduleId + '">' +
      '<div class="module-card-header">' +
        '<div class="module-card-number">Module ' + String(meta.number || (i + 1)).padStart(2, '0') + '</div>' +
        '<h3 class="module-card-name">' + esc(meta.name || moduleId) + '</h3>' +
        '<span class="' + statusBadgeClass + '">' + statusBadgeText + '</span>' +
      '</div>' +
      '<p class="module-card-desc">' + esc(meta.description || '') + '</p>' +
      progressBarHtml +
      (status === 'locked'
        ? '<p class="module-card-lock-msg"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;color:var(--color-locked)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Master at least one persona in Module 1 to unlock.</p>'
        : '<button class="btn btn-primary module-card-cta" data-module-id="' + moduleId + '" type="button">Start Practice</button>') +
    '</div>';
  }

  container.innerHTML = html;
}

/**
 * Open the scenario selector modal for a given module.
 */
function openScenarioModal(moduleId) {
  const overlay = document.getElementById('scenario-modal');
  if (!overlay) return;

  const progressData = _cachedProgress || {};
  const modulesData = _cachedModules || {};

  renderScenarioModal(moduleId, progressData, modulesData);

  overlay.style.display = 'flex';
  overlay.setAttribute('data-current-module', moduleId);

  // Focus trap: focus the first focusable element
  setTimeout(function() {
    var firstFocusable = overlay.querySelector('.scenario-modal-close, .persona-card:not(.persona-card-locked)');
    if (firstFocusable) firstFocusable.focus();
  }, 50);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close the scenario selector modal.
 */
function closeScenarioModal() {
  const overlay = document.getElementById('scenario-modal');
  if (!overlay) return;

  overlay.style.display = 'none';
  document.body.style.overflow = '';

  // Return focus to the module card button that opened it
  const moduleId = overlay.getAttribute('data-current-module');
  if (moduleId) {
    const btn = document.querySelector('.module-card-cta[data-module-id="' + moduleId + '"]');
    if (btn) btn.focus();
  }
}

/**
 * Build and populate the scenario modal content.
 */
function renderScenarioModal(moduleId, progressData, modulesData) {
  const titleEl = document.getElementById('scenario-modal-title');
  const gridEl = document.getElementById('scenario-modal-grid');

  if (!titleEl || !gridEl) return;

  const meta = MODULE_META[moduleId] || {};
  titleEl.textContent = 'Module ' + (meta.number || '') + ': ' + (meta.name || 'Select Your Assigned Scenario');

  const modules = progressData?.modules ?? {};
  const modProgress = modules[moduleId] || {};
  const modPersonas = modProgress.personas || {};

  // For Module 2, check Module 1 mastery
  let mod1Personas = {};
  if (moduleId === 'module2' && modules['module1']) {
    mod1Personas = modules['module1'].personas || {};
  }

  // Get scenario IDs from modules data if available
  let moduleScenarios = {};
  if (modulesData && modulesData.modules) {
    const modData = modulesData.modules[moduleId];
    if (modData && modData.personas) {
      moduleScenarios = modData.personas;
    }
  }

  const personaIds = Object.keys(PERSONA_META);
  let html = '';

  for (let i = 0; i < personaIds.length; i++) {
    const pid = personaIds[i];
    const pmeta = PERSONA_META[pid] || {};
    const pProgress = modPersonas[pid] || {};
    const attempts = pProgress.attempts || 0;
    const bestScore = pProgress.bestScore || 0;
    const isMastered = pProgress.mastered || false;

    // Check lock for Module 2
    let isLocked = false;
    let lockReason = '';
    if (moduleId === 'module2') {
      const mod1PersonaProgress = mod1Personas[pid] || {};
      if (!mod1PersonaProgress.mastered) {
        isLocked = true;
        lockReason = 'Master this persona in Module 1 first';
      }
    }

    // Find scenario ID for this persona + module
    let scenarioId = '';
    if (moduleScenarios[pid] && moduleScenarios[pid].scenarioId) {
      scenarioId = moduleScenarios[pid].scenarioId;
    } else {
      // Fallback: construct scenario ID from convention
      scenarioId = moduleId + '_' + pid;
    }

    let cardClass = 'persona-card';
    if (isLocked) cardClass += ' persona-card-locked';
    if (isMastered) cardClass += ' persona-card-mastered';

    html += '<button class="' + cardClass + '"' +
      (isLocked ? ' disabled aria-disabled="true"' : '') +
      ' data-scenario-id="' + esc(scenarioId) + '"' +
      ' data-persona-id="' + esc(pid) + '"' +
      ' type="button"' +
      ' aria-label="' + esc(pmeta.name || pid) + ' — ' + esc(pmeta.business || '') + (isLocked ? ' (Locked)' : '') + '"' +
    '>' +
      '<div class="persona-card-icon" aria-hidden="true">' + esc(pmeta.initials || (pmeta.name || pid).split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase()) + '</div>' +
      '<div class="persona-card-info">' +
        '<div class="persona-card-name">' + esc(pmeta.name || pid) +
          (isMastered ? ' <span class="persona-mastery-badge" aria-label="Mastered">Mastered</span>' : '') +
        '</div>' +
        '<div class="persona-card-business">' + esc(pmeta.business || '') + '</div>' +
        '<div class="persona-card-product">' + esc(pmeta.product || '') + '</div>' +
      '</div>' +
      (isLocked
        ? '<div class="persona-card-lock-info">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color:var(--color-locked)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>' +
            '<span>' + esc(lockReason) + '</span>' +
          '</div>'
        : '<div class="persona-card-stats">' +
            '<span class="persona-stat">' + attempts + ' attempt' + (attempts !== 1 ? 's' : '') + '</span>' +
            (bestScore > 0 ? '<span class="persona-stat">Best: ' + bestScore + '/100</span>' : '') +
          '</div>') +
    '</button>';
  }

  gridEl.innerHTML = html;
}

/**
 * Render the performance sidebar: score ring, module completion stats, focus areas.
 */
function renderPerformanceSidebar(progressData) {
  const sidebar = document.getElementById('performance-sidebar');
  if (!sidebar) return;

  const modules = progressData?.modules ?? {};
  const categories = progressData?.categories ?? {};

  // Check if user has any session data
  let hasSessions = false;
  let totalMastered = 0;
  let totalPersonas = 0;
  let totalAttempts = 0;
  let bestScoreSum = 0;
  let bestScoreCount = 0;

  const moduleIds = ['module1', 'module2'];
  for (let m = 0; m < moduleIds.length; m++) {
    const mod = modules[moduleIds[m]];
    if (!mod || !mod.personas) continue;
    const personas = mod.personas;
    for (const p in personas) {
      if (!personas.hasOwnProperty(p)) continue;
      totalPersonas++;
      const pd = personas[p];
      if (pd.attempts > 0) hasSessions = true;
      totalAttempts += (pd.attempts || 0);
      if (pd.mastered) totalMastered++;
      if (pd.bestScore > 0) {
        bestScoreSum += pd.bestScore;
        bestScoreCount++;
      }
    }
  }

  if (!hasSessions) {
    sidebar.innerHTML = '<div class="perf-empty">' +
      '<div class="perf-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M12 20V10M18 20V4M6 20v-4"/></svg></div>' +
      '<p class="perf-empty-title">No progress yet</p>' +
      '<p class="perf-empty-desc">Complete your first practice call to start tracking your performance.</p>' +
    '</div>';
    return;
  }

  let html = '';

  // Overall mastery score ring
  let masteryScore = totalPersonas > 0 ? Math.round((totalMastered / totalPersonas) * 100) : 0;
  if (bestScoreCount > 0) {
    // Use average best score as mastery when available
    masteryScore = Math.round(bestScoreSum / bestScoreCount);
  }

  const ringColor = masteryScore >= window.SCORE_PASS_THRESHOLD ? 'var(--payroc-blue)' : (masteryScore >= window.SCORE_WARNING_THRESHOLD ? 'var(--color-warning)' : 'var(--color-fail)');
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (masteryScore / 100) * circumference;

  html += '<div class="perf-score-ring">' +
    '<svg viewBox="0 0 120 120" width="80" height="80">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-light)" stroke-width="5"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + ringColor + '" stroke-width="5" ' +
        'stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(2) + '" ' +
        'stroke-dashoffset="' + offset.toFixed(2) + '" ' +
        'style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1.5s ease"/>' +
    '</svg>' +
    '<div class="perf-score-text">' +
      '<span class="perf-score-number">' + (masteryScore > 0 ? masteryScore : '—') + '</span>' +
      '<span class="perf-score-label">Mastery</span>' +
    '</div>' +
  '</div>';

  const m1Status = getModuleStatus('module1', progressData);
  const m2Status = getModuleStatus('module2', progressData);
  const m1Complete = m1Status === 'mastered' ? 1 : 0;
  const m2Complete = m2Status === 'mastered' ? 1 : 0;

  html += '<div class="perf-stats-grid">' +
    '<div class="perf-stat"><div class="perf-stat-value">' + m1Complete + '/1</div><div class="perf-stat-label">Module 1</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + m2Complete + '/1</div><div class="perf-stat-label">Module 2</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + totalAttempts + '</div><div class="perf-stat-label">Attempts</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + (m1Complete + m2Complete) + '/2</div><div class="perf-stat-label">Total</div></div>' +
  '</div>';

  // Focus Areas (skill bars from categories)
  html += '<div class="perf-skills-card">' +
    '<div class="perf-skills-title">Focus Areas</div>';

  const catEntries = [];
  for (const catKey in categories) {
    if (categories.hasOwnProperty(catKey)) {
      catEntries.push([catKey, categories[catKey]]);
    }
  }

  if (catEntries.length === 0) {
    html += '<div class="perf-empty" style="padding: 16px; text-align: center;">' +
      '<p style="font-size: 12px; color: var(--text-muted); margin: 0;">Complete a practice call to reveal focus areas.</p>' +
    '</div>';
  } else {
    // Sort ascending by latest score to show weakest first
    catEntries.sort(function(a, b) {
      return (a[1].latest || 0) - (b[1].latest || 0);
    });

    // Show bottom 3 (weakest)
    const focusSkills = catEntries.slice(0, 3);

    for (let f = 0; f < focusSkills.length; f++) {
      const catName = focusSkills[f][0];
      const catData = focusSkills[f][1];
      const displayName = catName.replace(/_/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
      const latestScore = catData.latest || 0;
      const barColor2 = latestScore >= window.SCORE_PASS_THRESHOLD ? 'var(--color-pass)' : (latestScore >= window.SCORE_WARNING_THRESHOLD ? 'var(--color-warning)' : 'var(--color-fail)');

      let trendArrow = '';
      if (catData.trend && catData.trend.length >= 2) {
        const prev = catData.trend[catData.trend.length - 2];
        const curr = catData.trend[catData.trend.length - 1];
        if (curr > prev) trendArrow = '<span class="skill-trend skill-trend-up">▲</span>';
        else if (curr < prev) trendArrow = '<span class="skill-trend skill-trend-down">▼</span>';
        else trendArrow = '<span class="skill-trend skill-trend-same">—</span>';
      }

      html += '<div class="perf-skill-row" style="margin-bottom: 8px;">' +
        '<div class="perf-skill-name">' + esc(displayName) + '</div>' +
        '<div class="perf-skill-bar-wrap">' +
          '<div class="perf-skill-bar" style="width:0;background:' + barColor2 + '" data-target="' + latestScore + '%"></div>' +
        '</div>' +
        '<div class="perf-skill-score">' + latestScore + '%' + trendArrow + '</div>' +
      '</div>';
    }
  }

  html += '</div>';

  sidebar.innerHTML = html;

  // Animate skill bars
  setTimeout(function() {
    const bars = sidebar.querySelectorAll('.perf-skill-bar');
    for (let b = 0; b < bars.length; b++) {
      bars[b].style.width = bars[b].getAttribute('data-target');
    }
  }, 200);
}

/**
 * Render the certificate section if both modules are fully mastered.
 */
function renderCertificate(progressData) {
  const container = document.getElementById('certificate-section');
  if (!container) return;

  const certs = progressData?.certificates ?? {};
  const unlockedPersonas = [];
  for (const pid in certs) {
    if (certs.hasOwnProperty(pid) && certs[pid].unlocked) {
      unlockedPersonas.push(pid);
    }
  }

  if (unlockedPersonas.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  const completionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let html = '<div class="certificate-inner">' +
    '<div class="certificate-badge" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15l-3 3v-4.5M12 15l3 3v-4.5"/><circle cx="12" cy="9" r="6"/><path d="M9.5 9l1.5 1.5 3-3"/></svg></div>' +
    '<h2 class="certificate-title">Congratulations!</h2>' +
    '<p class="certificate-subtitle">You have earned certifications for:</p>' +
    '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:16px 0;">';

  for (let j = 0; j < unlockedPersonas.length; j++) {
    const upid = unlockedPersonas[j];
    const meta = PERSONA_META[upid] || { name: upid };
    html += '<button class="btn btn-primary btn-print-persona-cert" data-persona-id="' + upid + '" type="button">Print ' + esc(meta.name) + ' Cert</button>';
  }

  html += '</div>' +
    '<div class="certificate-print-area" id="certificate-print-area">' +
      '<div class="certificate-printable">' +
        '<div class="cert-header">CERTIFICATE OF COMPLETION</div>' +
        '<div class="cert-logo">ROC Academy</div>' +
        '<div class="cert-body">' +
          '<p>This certifies that</p>' +
          '<h2 class="cert-name">Sales Representative</h2>' +
          '<p>has successfully completed the</p>' +
          '<h3 class="cert-course">Sales Call Certification</h3>' +
          '<p class="cert-modules" id="cert-printable-persona-name"></p>' +
          '<p class="cert-date">' + esc(completionDate) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  container.innerHTML = html;

  // Bind print buttons
  const buttons = container.querySelectorAll('.btn-print-persona-cert');
  for (let k = 0; k < buttons.length; k++) {
    buttons[k].addEventListener('click', function(e) {
      const personaId = e.currentTarget.getAttribute('data-persona-id');
      const meta = PERSONA_META[personaId] || { name: personaId, business: '' };
      const nameEl = document.getElementById('cert-printable-persona-name');
      if (nameEl) {
        nameEl.innerHTML = esc(meta.name) + '<br><span style="font-size:12px;color:var(--text-muted);font-weight:normal;">' + esc(meta.business) + '</span>';
      }
      setTimeout(function() {
        window.print();
      }, 50);
    });
  }
}

/**
 * Initialize event listeners for the module cards and scenario modal.
 * Called once from app.bindEvents() or from DOMContentLoaded.
 */
function initProgressEvents() {
  // Module card CTA clicks — event delegation
  const moduleCardsContainer = document.getElementById('module-cards');
  if (moduleCardsContainer) {
    moduleCardsContainer.addEventListener('click', function(e) {
      const cta = e.target.closest('.module-card-cta');
      if (cta) {
        const moduleId = cta.getAttribute('data-module-id');
        if (moduleId) {
          openScenarioModal(moduleId);
        }
      }
    });
  }

  // Modal close button and overlay click
  const modalOverlay = document.getElementById('scenario-modal');
  if (modalOverlay) {
    // Close on overlay click (not modal content click)
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        closeScenarioModal();
      }
    });

    // Close button
    const closeBtn = modalOverlay.querySelector('.scenario-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeScenarioModal();
      });
    }

    // Escape key
    modalOverlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeScenarioModal();
        return;
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusableEls = modalOverlay.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableEls.length === 0) return;

        const firstEl = focusableEls[0];
        const lastEl = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    });

    // Persona card clicks — event delegation on modal grid
    const modalGrid = document.getElementById('scenario-modal-grid');
    if (modalGrid) {
      modalGrid.addEventListener('click', function(e) {
        const card = e.target.closest('.persona-card');
        if (card && !card.classList.contains('persona-card-locked') && !card.disabled) {
          const scenarioId = card.getAttribute('data-scenario-id');
          if (scenarioId) {
            closeScenarioModal();
            app.selectScenario(scenarioId);
          }
        }
      });
    }
  }
}

// Initialize events once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initProgressEvents();
});
