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
var PERSONA_META = {
  sam_patel: {
    name: 'Sam Patel',
    business: 'QuickStop Market',
    product: 'Bodega AI',
    icon: '🏪'
  },
  carla_reyes: {
    name: 'Carla Reyes',
    business: 'Studio Collective Salon',
    product: 'Roc Terminal+',
    icon: '💇'
  },
  mike_turner: {
    name: 'Mike Turner',
    business: 'Precision Plumbing & Drain',
    product: 'Roc Services',
    icon: '🔧'
  },
  david_miller: {
    name: 'Pastor David Miller',
    business: 'New Hope Community Church',
    product: 'Roc Giving',
    icon: '⛪'
  }
};

/**
 * Module metadata — static descriptions for each module.
 */
var MODULE_META = {
  module1: {
    number: 1,
    name: 'Discovery & Qualification',
    description: 'Master the art of the first call. Learn to build rapport, ask the right discovery questions, qualify using BANT/CHAMP, and close for a next step — not a sale.',
    icon: '🎯'
  },
  module2: {
    number: 2,
    name: 'Objection Handling & Close',
    description: 'Handle real-world objections with confidence. Present tailored solutions, overcome resistance, and guide the prospect toward a buying decision.',
    icon: '🏆'
  }
};

/**
 * Cached data from the last loadProgress() call.
 */
var _cachedModules = null;
var _cachedProgress = null;

/**
 * Load progress data from the server and render the dashboard.
 * Called from app.init() after scenarios are loaded.
 */
function loadProgress() {
  return Promise.all([
    fetchWithAuth('/api/scenarios/modules'),
    fetchWithAuth('/api/sessions/progress')
  ]).then(function(results) {
    var modulesRes = results[0];
    var progressRes = results[1];

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
    var modulesData = data[0].data;
    var progressData = data[1].data;

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
  var container = document.getElementById('module-cards');
  if (!container) return;

  var html = '';
  var moduleIds = ['module1', 'module2'];

  for (var i = 0; i < moduleIds.length; i++) {
    var moduleId = moduleIds[i];
    var meta = MODULE_META[moduleId] || {};
    var isLocked = moduleId === 'module2';

    html += '<div class="module-card' + (isLocked ? ' module-card-locked' : '') + '" data-module-id="' + moduleId + '">' +
      '<div class="module-card-header">' +
        '<div class="module-card-number">' + (meta.icon || '') + ' Module ' + (meta.number || (i + 1)) + '</div>' +
        '<h3 class="module-card-name">' + esc(meta.name || moduleId) + '</h3>' +
        '<span class="module-card-status-badge ' + (isLocked ? 'module-status-locked' : 'module-status-available') + '">' +
          (isLocked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Locked' : 'Available') +
        '</span>' +
      '</div>' +
      '<p class="module-card-desc">' + esc(meta.description || '') + '</p>' +
      (isLocked
        ? '<p class="module-card-lock-msg">Complete Module 1 to unlock this module.</p>'
        : '<button class="btn btn-primary module-card-cta" data-module-id="' + moduleId + '" type="button">Select Scenario</button>') +
    '</div>';
  }

  container.innerHTML = html;
}

/**
 * Compute module mastery status for a given module and progress data.
 * Returns: 'mastered', 'available', or 'locked'.
 */
function getModuleStatus(moduleId, progressData) {
  var modules = (progressData && progressData.modules) ? progressData.modules : {};
  var mod = modules[moduleId];

  if (moduleId === 'module2') {
    // Module 2 is locked unless at least one persona is mastered in Module 1
    var mod1 = modules['module1'];
    if (!mod1 || !mod1.personas) return 'locked';
    var anyMastered = false;
    var personas = mod1.personas;
    for (var key in personas) {
      if (personas.hasOwnProperty(key) && personas[key].mastered) {
        anyMastered = true;
        break;
      }
    }
    if (!anyMastered) return 'locked';
  }

  // Check if all personas are mastered
  if (mod && mod.personas) {
    var allMastered = true;
    var personaCount = 0;
    var personas2 = mod.personas;
    for (var k in personas2) {
      if (personas2.hasOwnProperty(k)) {
        personaCount++;
        if (!personas2[k].mastered) {
          allMastered = false;
        }
      }
    }
    if (personaCount > 0 && allMastered) return 'mastered';
  }

  return 'available';
}

/**
 * Count mastered personas for a module.
 */
function countMasteredPersonas(moduleId, progressData) {
  var modules = (progressData && progressData.modules) ? progressData.modules : {};
  var mod = modules[moduleId];
  if (!mod || !mod.personas) return 0;

  var count = 0;
  var personas = mod.personas;
  for (var key in personas) {
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
  var container = document.getElementById('module-cards');
  if (!container) return;

  var moduleIds = ['module1', 'module2'];
  var html = '';

  for (var i = 0; i < moduleIds.length; i++) {
    var moduleId = moduleIds[i];
    var meta = MODULE_META[moduleId] || {};
    var status = getModuleStatus(moduleId, progressData);
    var mastered = countMasteredPersonas(moduleId, progressData);
    var totalPersonas = 4;

    var cardClass = 'module-card';
    if (status === 'locked') cardClass += ' module-card-locked';
    if (status === 'mastered') cardClass += ' module-card-mastered';

    var statusBadgeClass = 'module-card-status-badge ';
    var statusBadgeText = '';
    if (status === 'mastered') {
      statusBadgeClass += 'module-status-mastered';
      statusBadgeText = '✓ Mastered';
    } else if (status === 'locked') {
      statusBadgeClass += 'module-status-locked';
      statusBadgeText = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Locked';
    } else {
      statusBadgeClass += 'module-status-available';
      statusBadgeText = 'Available';
    }

    // Progress bar for mastered personas
    var progressBarHtml = '';
    if (status !== 'locked') {
      progressBarHtml = '<div class="module-card-progress">' +
        '<div class="module-card-progress-bar">' +
          '<div class="module-card-progress-fill" style="width:' + ((mastered / totalPersonas) * 100) + '%"></div>' +
        '</div>' +
        '<span class="module-card-progress-text">' + mastered + '/' + totalPersonas + ' personas mastered</span>' +
      '</div>';
    }

    html += '<div class="' + cardClass + '" data-module-id="' + moduleId + '">' +
      '<div class="module-card-header">' +
        '<div class="module-card-number">' + (meta.icon || '') + ' Module ' + (meta.number || (i + 1)) + '</div>' +
        '<h3 class="module-card-name">' + esc(meta.name || moduleId) + '</h3>' +
        '<span class="' + statusBadgeClass + '">' + statusBadgeText + '</span>' +
      '</div>' +
      '<p class="module-card-desc">' + esc(meta.description || '') + '</p>' +
      progressBarHtml +
      (status === 'locked'
        ? '<p class="module-card-lock-msg"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;color:var(--color-locked)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg> Master at least one persona in Module 1 to unlock.</p>'
        : '<button class="btn btn-primary module-card-cta" data-module-id="' + moduleId + '" type="button">Select Scenario</button>') +
    '</div>';
  }

  container.innerHTML = html;
}

/**
 * Open the scenario selector modal for a given module.
 */
function openScenarioModal(moduleId) {
  var overlay = document.getElementById('scenario-modal');
  if (!overlay) return;

  var progressData = _cachedProgress || {};
  var modulesData = _cachedModules || {};

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
  var overlay = document.getElementById('scenario-modal');
  if (!overlay) return;

  overlay.style.display = 'none';
  document.body.style.overflow = '';

  // Return focus to the module card button that opened it
  var moduleId = overlay.getAttribute('data-current-module');
  if (moduleId) {
    var btn = document.querySelector('.module-card-cta[data-module-id="' + moduleId + '"]');
    if (btn) btn.focus();
  }
}

/**
 * Build and populate the scenario modal content.
 */
function renderScenarioModal(moduleId, progressData, modulesData) {
  var titleEl = document.getElementById('scenario-modal-title');
  var gridEl = document.getElementById('scenario-modal-grid');

  if (!titleEl || !gridEl) return;

  var meta = MODULE_META[moduleId] || {};
  titleEl.textContent = 'Module ' + (meta.number || '') + ': ' + (meta.name || 'Select Your Assigned Scenario');

  var modules = (progressData && progressData.modules) ? progressData.modules : {};
  var modProgress = modules[moduleId] || {};
  var modPersonas = modProgress.personas || {};

  // For Module 2, check Module 1 mastery
  var mod1Personas = {};
  if (moduleId === 'module2' && modules['module1']) {
    mod1Personas = modules['module1'].personas || {};
  }

  // Get scenario IDs from modules data if available
  var moduleScenarios = {};
  if (modulesData && modulesData.modules) {
    var modData = modulesData.modules[moduleId];
    if (modData && modData.personas) {
      moduleScenarios = modData.personas;
    }
  }

  var personaIds = ['sam_patel', 'carla_reyes', 'mike_turner', 'david_miller'];
  var html = '';

  for (var i = 0; i < personaIds.length; i++) {
    var pid = personaIds[i];
    var pmeta = PERSONA_META[pid] || {};
    var pProgress = modPersonas[pid] || {};
    var attempts = pProgress.attempts || 0;
    var bestScore = pProgress.bestScore || 0;
    var isMastered = pProgress.mastered || false;

    // Check lock for Module 2
    var isLocked = false;
    var lockReason = '';
    if (moduleId === 'module2') {
      var mod1PersonaProgress = mod1Personas[pid] || {};
      if (!mod1PersonaProgress.mastered) {
        isLocked = true;
        lockReason = 'Master this persona in Module 1 first';
      }
    }

    // Find scenario ID for this persona + module
    var scenarioId = '';
    if (moduleScenarios[pid] && moduleScenarios[pid].scenarioId) {
      scenarioId = moduleScenarios[pid].scenarioId;
    } else {
      // Fallback: construct scenario ID from convention
      scenarioId = moduleId + '_' + pid;
    }

    var cardClass = 'persona-card';
    if (isLocked) cardClass += ' persona-card-locked';
    if (isMastered) cardClass += ' persona-card-mastered';

    html += '<button class="' + cardClass + '"' +
      (isLocked ? ' disabled aria-disabled="true"' : '') +
      ' data-scenario-id="' + esc(scenarioId) + '"' +
      ' data-persona-id="' + esc(pid) + '"' +
      ' type="button"' +
      ' aria-label="' + esc(pmeta.name || pid) + ' — ' + esc(pmeta.business || '') + (isLocked ? ' (Locked)' : '') + '"' +
    '>' +
      '<div class="persona-card-icon" aria-hidden="true">' + (pmeta.icon || '👤') + '</div>' +
      '<div class="persona-card-info">' +
        '<div class="persona-card-name">' + esc(pmeta.name || pid) +
          (isMastered ? ' <span class="persona-mastery-badge" aria-label="Mastered">✓ Mastered</span>' : '') +
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
  var sidebar = document.getElementById('performance-sidebar');
  if (!sidebar) return;

  var modules = (progressData && progressData.modules) ? progressData.modules : {};
  var categories = (progressData && progressData.categories) ? progressData.categories : {};

  // Check if user has any session data
  var hasSessions = false;
  var totalMastered = 0;
  var totalPersonas = 0;
  var totalAttempts = 0;
  var bestScoreSum = 0;
  var bestScoreCount = 0;

  var moduleIds = ['module1', 'module2'];
  for (var m = 0; m < moduleIds.length; m++) {
    var mod = modules[moduleIds[m]];
    if (!mod || !mod.personas) continue;
    var personas = mod.personas;
    for (var p in personas) {
      if (!personas.hasOwnProperty(p)) continue;
      totalPersonas++;
      var pd = personas[p];
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

  var html = '';

  // Overall mastery score ring
  var masteryScore = totalPersonas > 0 ? Math.round((totalMastered / totalPersonas) * 100) : 0;
  if (bestScoreCount > 0) {
    // Use average best score as mastery when available
    masteryScore = Math.round(bestScoreSum / bestScoreCount);
  }

  var ringColor = masteryScore >= window.SCORE_PASS_THRESHOLD ? 'var(--color-pass)' : (masteryScore >= window.SCORE_WARNING_THRESHOLD ? 'var(--color-warning)' : 'var(--color-fail)');
  var circumference = 2 * Math.PI * 54;
  var offset = circumference - (masteryScore / 100) * circumference;

  html += '<div class="perf-score-ring">' +
    '<svg viewBox="0 0 120 120" width="80" height="80">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-light)" stroke-width="5"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + ringColor + '" stroke-width="5" ' +
        'stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(2) + '" ' +
        'stroke-dashoffset="' + offset.toFixed(2) + '" ' +
        'style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1.5s ease"/>' +
    '</svg>' +
    '<div class="perf-score-text">' +
      '<span class="perf-score-number">' + masteryScore + '</span>' +
      '<span class="perf-score-label">Mastery</span>' +
    '</div>' +
  '</div>';

  // Module completion stats
  var m1Mastered = countMasteredPersonas('module1', progressData);
  var m2Mastered = countMasteredPersonas('module2', progressData);

  html += '<div class="perf-stats-grid">' +
    '<div class="perf-stat"><div class="perf-stat-value">' + m1Mastered + '/4</div><div class="perf-stat-label">Module 1</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + m2Mastered + '/4</div><div class="perf-stat-label">Module 2</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + totalAttempts + '</div><div class="perf-stat-label">Attempts</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + totalMastered + '/8</div><div class="perf-stat-label">Total</div></div>' +
  '</div>';

  // Focus Areas (skill bars from categories)
  html += '<div class="perf-skills-card">' +
    '<div class="perf-skills-title" style="text-transform: uppercase;">Focus Areas</div>';

  var catEntries = [];
  for (var catKey in categories) {
    if (categories.hasOwnProperty(catKey)) {
      catEntries.push([catKey, categories[catKey]]);
    }
  }

  if (catEntries.length === 0) {
    html += '<div class="perf-empty" style="margin-top: 10px; padding: 16px; background: #F7F8FA; border-radius: var(--rs); text-align: center; border: 1px dashed rgba(0,0,0,0.08);">' +
      '<p style="font-size: 11px; color: var(--text-muted); margin: 0;">Complete a practice call to reveal focus areas.</p>' +
    '</div>';
  } else {
    // Sort ascending by latest score to show weakest first
    catEntries.sort(function(a, b) {
      return (a[1].latest || 0) - (b[1].latest || 0);
    });

    // Show bottom 3 (weakest)
    var focusSkills = catEntries.slice(0, 3);

    for (var f = 0; f < focusSkills.length; f++) {
      var catName = focusSkills[f][0];
      var catData = focusSkills[f][1];
      var displayName = catName.replace(/_/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
      var latestScore = catData.latest || 0;
      var barColor2 = latestScore >= window.SCORE_PASS_THRESHOLD ? 'var(--color-pass)' : (latestScore >= window.SCORE_WARNING_THRESHOLD ? 'var(--color-warning)' : 'var(--color-fail)');

      var trendArrow = '';
      if (catData.trend && catData.trend.length >= 2) {
        var prev = catData.trend[catData.trend.length - 2];
        var curr = catData.trend[catData.trend.length - 1];
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
    var bars = sidebar.querySelectorAll('.perf-skill-bar');
    for (var b = 0; b < bars.length; b++) {
      bars[b].style.width = bars[b].getAttribute('data-target');
    }
  }, 200);
}

/**
 * Render the certificate section if both modules are fully mastered.
 */
function renderCertificate(progressData) {
  var container = document.getElementById('certificate-section');
  if (!container) return;

  var certs = (progressData && progressData.certificates) ? progressData.certificates : {};
  var unlockedPersonas = [];
  for (var pid in certs) {
    if (certs.hasOwnProperty(pid) && certs[pid].unlocked) {
      unlockedPersonas.push(pid);
    }
  }

  if (unlockedPersonas.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  var completionDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  var html = '<div class="certificate-inner">' +
    '<div class="certificate-badge" aria-hidden="true">🎓</div>' +
    '<h2 class="certificate-title">Congratulations!</h2>' +
    '<p class="certificate-subtitle">You have earned certifications for:</p>' +
    '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:16px 0;">';

  for (var j = 0; j < unlockedPersonas.length; j++) {
    var upid = unlockedPersonas[j];
    var meta = PERSONA_META[upid] || { name: upid };
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
  var buttons = container.querySelectorAll('.btn-print-persona-cert');
  for (var k = 0; k < buttons.length; k++) {
    buttons[k].addEventListener('click', function(e) {
      var personaId = e.currentTarget.getAttribute('data-persona-id');
      var meta = PERSONA_META[personaId] || { name: personaId, business: '' };
      var nameEl = document.getElementById('cert-printable-persona-name');
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
  var moduleCardsContainer = document.getElementById('module-cards');
  if (moduleCardsContainer) {
    moduleCardsContainer.addEventListener('click', function(e) {
      var cta = e.target.closest('.module-card-cta');
      if (cta) {
        var moduleId = cta.getAttribute('data-module-id');
        if (moduleId) {
          openScenarioModal(moduleId);
        }
      }
    });
  }

  // Modal close button and overlay click
  var modalOverlay = document.getElementById('scenario-modal');
  if (modalOverlay) {
    // Close on overlay click (not modal content click)
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        closeScenarioModal();
      }
    });

    // Close button
    var closeBtn = modalOverlay.querySelector('.scenario-modal-close');
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
        var focusableEls = modalOverlay.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableEls.length === 0) return;

        var firstEl = focusableEls[0];
        var lastEl = focusableEls[focusableEls.length - 1];

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
    var modalGrid = document.getElementById('scenario-modal-grid');
    if (modalGrid) {
      modalGrid.addEventListener('click', function(e) {
        var card = e.target.closest('.persona-card');
        if (card && !card.classList.contains('persona-card-locked') && !card.disabled) {
          var scenarioId = card.getAttribute('data-scenario-id');
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
