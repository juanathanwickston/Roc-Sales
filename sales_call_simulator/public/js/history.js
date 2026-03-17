/**
 * Session History Controller
 * Displays past simulation attempts with scores and stats.
 * Fetches data from GET /api/sessions and renders into Screen 5.
 * Only shows sessions that have been scored (overall_score !== null).
 * Paginated at 20 sessions per page.
 */

// Pagination constants
const HISTORY_PAGE_SIZE = 20;
const PASS_THRESHOLD = 80;

// State
let historyCurrentPage = 0;
let historyTotalSessions = 0;
let currentDetailSessionId = null;
let cachedTranscript = null;

/**
 * Load session history from the API and render the history screen.
 * Called when the user navigates to the history screen.
 */
async function loadHistory(page) {
  if (page === undefined) page = 0;
  historyCurrentPage = page;

  const loadingEl = document.getElementById('history-loading');
  const contentEl = document.getElementById('history-content');
  const emptyEl = document.getElementById('history-empty');

  // Show loading, hide content and empty
  loadingEl.style.display = '';
  contentEl.style.display = 'none';
  emptyEl.style.display = 'none';

  try {
    const offset = page * HISTORY_PAGE_SIZE;
    const res = await fetch(`/api/sessions?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
    if (!res.ok) throw new Error('Failed to load sessions');

    const data = await res.json();
    const allSessions = data.sessions || [];
    historyTotalSessions = data.total || 0;

    // Filter to only scored sessions
    const sessions = allSessions.filter(function(s) {
      return s.overall_score !== null && s.overall_score !== undefined;
    });

    loadingEl.style.display = 'none';

    if (sessions.length === 0 && page === 0) {
      emptyEl.style.display = '';
      return;
    }

    // Render stats
    renderHistoryStats(sessions);

    // Render session cards
    renderSessionList(sessions);

    // Render pagination
    renderPagination();

    contentEl.style.display = '';
  } catch (err) {
    console.error('[History] Load error:', err.message);
    loadingEl.style.display = 'none';
    emptyEl.style.display = '';
  }
}

/**
 * Calculate and display summary stats from session data.
 * Uses 80% threshold for pass rate calculation.
 */
function renderHistoryStats(sessions) {
  const scored = sessions.filter(function(s) {
    return s.overall_score !== null && s.overall_score !== undefined;
  });

  document.getElementById('stat-total').textContent = historyTotalSessions;

  if (scored.length === 0) {
    document.getElementById('stat-best').textContent = '-';
    document.getElementById('stat-average').textContent = '-';
    document.getElementById('stat-pass-rate').textContent = '-';
    return;
  }

  const scores = scored.map(function(s) { return s.overall_score; });
  const best = Math.max.apply(null, scores);
  const average = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
  const passes = scored.filter(function(s) { return s.overall_score >= PASS_THRESHOLD; }).length;
  const passRate = Math.round((passes / scored.length) * 100);

  document.getElementById('stat-best').textContent = best;
  document.getElementById('stat-average').textContent = average;
  document.getElementById('stat-pass-rate').textContent = passRate + '%';
}

/**
 * Render session cards into the history list.
 * Each card shows scenario name, date, score ring, and pass/fail badge.
 * Only scored sessions are passed to this function.
 */
function renderSessionList(sessions) {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '';

  for (var i = 0; i < sessions.length; i++) {
    var session = sessions[i];
    var card = document.createElement('button');
    card.className = 'history-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', 'View session from ' + formatHistoryDate(session.created_at));

    var score = session.overall_score;
    var passed = score >= PASS_THRESHOLD;
    var verdictClass = passed ? 'pass' : 'fail';
    var verdictText = passed ? 'Pass' : 'Fail';

    card.innerHTML =
      '<div class="history-score-mini ' + verdictClass + '">' + esc(String(score)) + '</div>' +
      '<div class="history-card-info">' +
        '<div class="history-card-title">' + esc(formatScenarioName(session.scenario_id)) + '</div>' +
        '<div class="history-card-meta">' +
          '<span>' + formatHistoryDate(session.created_at) + '</span>' +
          (session.duration_seconds ? '<span>' + formatHistoryDuration(session.duration_seconds) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<span class="verdict-badge verdict-' + verdictClass + '">' + esc(verdictText) + '</span>';

    card.addEventListener('click', (function(id) {
      return function() { viewSessionScore(id); };
    })(session.id));

    listEl.appendChild(card);
  }
}

/**
 * Render pagination controls.
 */
function renderPagination() {
  var paginationEl = document.getElementById('history-pagination');
  var totalPages = Math.ceil(historyTotalSessions / HISTORY_PAGE_SIZE);

  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = '';

  var prevBtn = document.getElementById('btn-page-prev');
  var nextBtn = document.getElementById('btn-page-next');
  var infoEl = document.getElementById('pagination-info');

  prevBtn.disabled = historyCurrentPage === 0;
  nextBtn.disabled = historyCurrentPage >= totalPages - 1;
  infoEl.textContent = 'Page ' + (historyCurrentPage + 1) + ' of ' + totalPages;
}

/**
 * Navigate to debrief screen to view a stored scorecard.
 * Sets history navigation flag so back button shows.
 * Fetches the score from the API and renders it using the existing scoring module.
 */
async function viewSessionScore(sessionId) {
  currentDetailSessionId = sessionId;
  cachedTranscript = null;

  // Show debrief screen
  if (typeof app !== 'undefined' && app.showScreen) {
    app.showScreen('debrief');
  }

  // Show back button, hide live-call actions, show tabs
  var backBtn = document.getElementById('btn-back-history');
  var liveActions = document.getElementById('debrief-live-actions');
  var tabsEl = document.getElementById('debrief-tabs');

  if (backBtn) backBtn.classList.add('visible');
  if (liveActions) liveActions.style.display = 'none';
  if (tabsEl) tabsEl.style.display = '';

  // Reset to evaluation tab
  switchDebriefTab('evaluation');

  var loadingEl = document.getElementById('debrief-loading');
  var contentEl = document.getElementById('debrief-content');

  loadingEl.style.display = '';
  contentEl.style.display = 'none';

  try {
    var res = await fetch('/api/sessions/' + sessionId + '/score');
    if (!res.ok) throw new Error('Score not found');

    var scorecard = await res.json();

    // Use existing scoring module to render
    if (typeof scoring !== 'undefined' && scoring.renderScorecard) {
      scoring.renderScorecard(scorecard);
    }
  } catch (err) {
    console.error('[History] Score fetch error:', err.message);
    loadingEl.style.display = 'none';
    contentEl.style.display = '';
    document.getElementById('score-number').textContent = '-';
    document.getElementById('score-verdict').textContent = 'Score unavailable';
  }
}

/**
 * Switch between Evaluation and Transcript tabs in the debrief view.
 */
function switchDebriefTab(tabName) {
  // Update tab active state
  var tabs = document.querySelectorAll('.debrief-tab');
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].dataset.tab === tabName) {
      tabs[i].classList.add('active');
    } else {
      tabs[i].classList.remove('active');
    }
  }

  // Show/hide panels
  var evalPanel = document.getElementById('panel-evaluation');
  var txPanel = document.getElementById('panel-transcript');

  if (tabName === 'evaluation') {
    if (evalPanel) evalPanel.style.display = '';
    if (txPanel) txPanel.classList.remove('active');
  } else if (tabName === 'transcript') {
    if (evalPanel) evalPanel.style.display = 'none';
    if (txPanel) txPanel.classList.add('active');
    // Load transcript if not cached
    if (!cachedTranscript && currentDetailSessionId) {
      loadTranscript(currentDetailSessionId);
    }
  }
}

/**
 * Fetch and render the transcript for a session.
 */
async function loadTranscript(sessionId) {
  var bodyEl = document.getElementById('transcript-body');
  bodyEl.innerHTML = '<div class="transcript-empty"><div class="spinner"></div><p>Loading transcript...</p></div>';

  try {
    var res = await fetch('/api/sessions/' + sessionId + '/transcript');
    if (!res.ok) throw new Error('Transcript not found');

    var data = await res.json();
    cachedTranscript = data.transcript || '';

    if (!cachedTranscript) {
      bodyEl.innerHTML = '<div class="transcript-empty"><p>No transcript available for this session.</p></div>';
      return;
    }

    renderTranscript(cachedTranscript);
  } catch (err) {
    console.error('[History] Transcript fetch error:', err.message);
    bodyEl.innerHTML = '<div class="transcript-empty"><p>Unable to load transcript.</p></div>';
  }
}

/**
 * Parse and render transcript text into styled message bubbles.
 * Transcript format: [Role]: message text, one per line.
 */
function renderTranscript(text) {
  var bodyEl = document.getElementById('transcript-body');
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  var html = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var match = line.match(/^\[(.+?)\]:\s*(.+)$/);

    if (match) {
      var role = match[1];
      var content = match[2];
      var isRep = role.toLowerCase() === 'rep';
      var cssClass = isRep ? 'transcript-msg-rep' : 'transcript-msg-buyer';

      html +=
        '<div class="transcript-msg ' + cssClass + '">' +
          '<div class="transcript-role">' + esc(role) + '</div>' +
          '<div class="transcript-text">' + esc(content) + '</div>' +
        '</div>';
    } else {
      // Fallback for lines without role prefix
      html +=
        '<div class="transcript-msg">' +
          '<div class="transcript-text">' + esc(line) + '</div>' +
        '</div>';
    }
  }

  bodyEl.innerHTML = html;
}

/**
 * Copy transcript text to clipboard.
 */
function copyTranscript() {
  if (!cachedTranscript) return;
  navigator.clipboard.writeText(cachedTranscript).then(function() {
    if (typeof toast === 'function') toast('Transcript copied to clipboard', 'success');
  }).catch(function() {
    if (typeof toast === 'function') toast('Failed to copy transcript', 'error');
  });
}

/**
 * Download transcript as a .txt file.
 */
function downloadTranscript() {
  if (!cachedTranscript) return;
  var now = new Date();
  var dateStr = now.toISOString().split('T')[0];
  var filename = 'transcript_' + dateStr + '.txt';
  var blob = new Blob([cachedTranscript], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reset debrief screen to its default state (for live calls).
 * Hides back button, shows live-call actions, hides tabs.
 */
function resetDebriefForLiveCall() {
  var backBtn = document.getElementById('btn-back-history');
  var liveActions = document.getElementById('debrief-live-actions');
  var tabsEl = document.getElementById('debrief-tabs');

  if (backBtn) backBtn.classList.remove('visible');
  if (liveActions) liveActions.style.display = '';
  if (tabsEl) tabsEl.style.display = 'none';

  currentDetailSessionId = null;
  cachedTranscript = null;
}

// --- Utility Functions ---

/**
 * Format an ISO date to a short human-readable string.
 * Example: "Mar 11, 2:15 PM"
 */
function formatHistoryDate(isoDate) {
  if (!isoDate) return '';
  var d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format seconds to mm:ss string.
 */
function formatHistoryDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  var mins = Math.floor(seconds / 60);
  var secs = Math.floor(seconds % 60);
  return mins + ':' + secs.toString().padStart(2, '0');
}

/**
 * Convert scenario_id to a readable name.
 * Replaces underscores with spaces and capitalizes words.
 */
function formatScenarioName(scenarioId) {
  if (!scenarioId) return 'Unknown Scenario';
  return scenarioId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}
