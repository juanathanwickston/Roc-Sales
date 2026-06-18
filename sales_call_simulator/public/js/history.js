/**
 * Session History Controller
 * Displays past simulation attempts with scores and stats.
 * Fetches data from GET /api/sessions and renders into Screen 5.
 * Only shows sessions that have been scored (overall_score !== null).
 * Paginated at 20 sessions per page.
 */

// Pagination constants
const HISTORY_PAGE_SIZE = 20;

// State
let historyCurrentPage = 0;
let historyTotalSessions = 0;
let currentDetailSessionId = null;
let cachedTranscript = null;
let cachedCoaching = null;

// fetchWithAuth is defined globally in app.js

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
    const res = await fetchWithAuth(`/api/sessions?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `Failed to load sessions: ${res.status}`);
    }

    const envelope = await res.json();
    const data = envelope.data || {};
    const sessions = data.sessions || [];
    historyTotalSessions = envelope.meta?.totalItems ?? 0;

    loadingEl.style.display = 'none';

    if (sessions.length === 0 && page === 0) {
      emptyEl.style.display = '';
      return;
    }

    // Render global stats from backend aggregates (not per-page)
    renderHistoryStats(data.stats || {});

    // Render session cards
    renderSessionList(sessions);

    // Render pagination
    renderPagination();

    contentEl.style.display = '';
  } catch (err) {

    loadingEl.style.display = 'none';
    emptyEl.style.display = '';
  }
}

/**
 * Render compact summary strip from backend-provided global stats.
 * Stats come from the API response, computed across ALL scored sessions.
 */
function renderHistoryStats(stats) {
  const summaryEl = document.getElementById('history-summary');
  const total = historyTotalSessions;
  const best = stats.best_score || 0;
  const avg = stats.avg_score || 0;
  const scoredTotal = stats.scored_total || 0;
  const passRate = scoredTotal > 0 ? Math.round((stats.pass_count / scoredTotal) * 100) : 0;

  if (scoredTotal === 0) {
    summaryEl.innerHTML =
      '<span class="history-summary-value">' + total + '</span> sessions' +
      '<span class="history-summary-sep">&middot;</span>' +
      'No scores yet';
    return;
  }

  summaryEl.innerHTML =
    '<span class="history-summary-value">' + total + '</span> sessions' +
    '<span class="history-summary-sep">&middot;</span>' +
    'Best: <span class="history-summary-value">' + best + '</span>' +
    '<span class="history-summary-sep">&middot;</span>' +
    'Avg: <span class="history-summary-value">' + avg + '</span>' +
    '<span class="history-summary-sep">&middot;</span>' +
    '<span class="history-summary-value">' + passRate + '%</span> pass rate';
}

/**
 * Map overall_verdict to a three-tier verdict class and label.
 */
function getVerdictInfo(verdict) {
  if (verdict === 'pass') return { cls: 'pass', text: 'Pass' };
  if (verdict === 'needs_work') return { cls: 'needs-work', text: 'Needs Work' };
  return { cls: 'fail', text: 'Fail' };
}

/**
 * Build an SVG mini score ring matching the Dashboard's ring style.
 * radius=20, circumference=125.66
 */
function buildScoreRing(score, verdictCls) {
  const r = 20;
  const circ = 2 * Math.PI * r; // ~125.66
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const offset = circ * (1 - pct);

  return '<div class="history-ring-wrap">' +
    '<svg viewBox="0 0 52 52">' +
      '<circle class="history-ring-bg" cx="26" cy="26" r="' + r + '"/>' +
      '<circle class="history-ring-fill ' + verdictCls + '" cx="26" cy="26" r="' + r + '"' +
        ' stroke-dasharray="' + circ.toFixed(2) + '"' +
        ' stroke-dashoffset="' + offset.toFixed(2) + '"/>' +
    '</svg>' +
    '<span class="history-ring-text ' + verdictCls + '">' + score + '</span>' +
  '</div>';
}

/**
 * Render session cards into the history list.
 * Each card shows an SVG score ring, module name, date, duration,
 * score delta from previous session, and a three-tier verdict badge.
 * Sessions are ordered newest-first; delta compares to the next item in the array (chronologically prior).
 */
function renderSessionList(sessions) {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '';

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const score = session.overall_score;
    const verdict = getVerdictInfo(session.overall_verdict);

    // Score delta: compare to the chronologically previous session (next index, since newest-first)
    let deltaHtml = '';
    if (i < sessions.length - 1 && sessions[i + 1].overall_score !== null) {
      const prevScore = sessions[i + 1].overall_score;
      const diff = score - prevScore;
      if (diff > 0) {
        deltaHtml = '<span class="history-delta delta-up">+' + diff + '</span>';
      } else if (diff < 0) {
        deltaHtml = '<span class="history-delta delta-down">' + diff + '</span>';
      } else {
        deltaHtml = '<span class="history-delta delta-same">&mdash;</span>';
      }
    }

    const card = document.createElement('button');
    card.className = 'history-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', 'View session from ' + formatHistoryDate(session.created_at));

    card.innerHTML =
      buildScoreRing(score, verdict.cls) +
      '<div class="history-card-info">' +
        '<div class="history-card-title">' + esc(formatScenarioName(session.scenario_id)) + '</div>' +
        '<div class="history-card-meta">' +
          '<span>' + formatHistoryDate(session.created_at) + '</span>' +
          (session.duration_seconds ? '<span>' + formatHistoryDuration(session.duration_seconds) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="history-card-right">' +
        '<span class="verdict-badge verdict-' + verdict.cls + '">' + esc(verdict.text) + '</span>' +
        deltaHtml +
      '</div>';

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
  const paginationEl = document.getElementById('history-pagination');
  const totalPages = Math.ceil(historyTotalSessions / HISTORY_PAGE_SIZE);

  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = '';

  const prevBtn = document.getElementById('btn-page-prev');
  const nextBtn = document.getElementById('btn-page-next');
  const infoEl = document.getElementById('pagination-info');

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
  cachedCoaching = null;

  // Show debrief screen
  if (typeof app !== 'undefined' && app.showScreen) {
    app.showScreen('debrief');
  }

  // Show back button, hide live-call actions, show tabs
  const backBtn = document.getElementById('btn-back-history');
  const liveActions = document.getElementById('debrief-live-actions');
  const tabsEl = document.getElementById('debrief-tabs');

  if (backBtn) backBtn.classList.add('visible');
  if (liveActions) liveActions.style.display = 'none';
  if (tabsEl) tabsEl.style.display = '';

  // Reset to scorecard tab
  switchDebriefTab('scorecard');

  const loadingEl = document.getElementById('debrief-loading');
  const contentEl = document.getElementById('debrief-content');

  loadingEl.style.display = '';
  contentEl.style.display = 'none';

  try {
    // Fetch score and scenarios in parallel
    const scoreRes = fetchWithAuth('/api/sessions/' + sessionId + '/score');
    const scenariosRes = fetch('/api/scenarios'); // Public endpoint
    const results = await Promise.all([scoreRes, scenariosRes]);

    if (!results[0].ok) {
      const err = await results[0].json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Score not found');
    }

    const scoreEnvelope = await results[0].json();
    const scorecard = scoreEnvelope.data;

    // Match scenario by finding which rubric's category keys match scorecard categories
    let scenario = null;
    if (results[1].ok) {
      const scenariosEnvelope = await results[1].json();
      const scenariosList = (scenariosEnvelope.data && scenariosEnvelope.data.scenarios) || [];
      if (Array.isArray(scenariosList)) {
        const scoreCatKeys = Object.keys(scorecard.categories || {}).sort().join(',');
        scenario = scenariosList.find(function(s) {
          if (!s.rubric) return false;
          return Object.keys(s.rubric).sort().join(',') === scoreCatKeys;
        }) || null;
      }
    }

    // Use existing scoring module to render
    if (typeof scoring !== 'undefined' && scoring.renderScorecard) {
      scoring.renderScorecard(scorecard, scenario);
    }
  } catch (err) {

    loadingEl.style.display = 'none';
    contentEl.style.display = '';
    document.getElementById('score-number').textContent = '-';
    document.getElementById('score-verdict').textContent = 'Score unavailable';
  }
}

/**
 * Switch between Scorecard, Coaching, and Transcript tabs in the debrief view.
 */
function switchDebriefTab(tabName) {
  // Update tab active state
  const tabs = document.querySelectorAll('.debrief-tab');
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].dataset.tab === tabName) {
      tabs[i].classList.add('active');
    } else {
      tabs[i].classList.remove('active');
    }
  }

  // Get all panels
  const evalPanel = document.getElementById('panel-evaluation');
  const coachPanel = document.getElementById('panel-coaching');
  const txPanel = document.getElementById('panel-transcript');

  // Hide all panels
  if (evalPanel) evalPanel.style.display = 'none';
  if (coachPanel) coachPanel.classList.remove('active');
  if (txPanel) txPanel.classList.remove('active');

  // Show selected panel
  if (tabName === 'scorecard') {
    if (evalPanel) evalPanel.style.display = '';
  } else if (tabName === 'coaching') {
    if (coachPanel) coachPanel.classList.add('active');
    // Load coaching if not cached
    if (!cachedCoaching && currentDetailSessionId) {
      loadCoaching(currentDetailSessionId);
    }
  } else if (tabName === 'transcript') {
    if (txPanel) txPanel.classList.add('active');
    // Load transcript if not cached
    if (!cachedTranscript && currentDetailSessionId) {
      loadTranscript(currentDetailSessionId);
    }
  }
}

/**
 * Fetch and render coaching analysis for a session.
 */
async function loadCoaching(sessionId) {
  const loadingEl = document.getElementById('coaching-loading');
  const contentEl = document.getElementById('coaching-content');
  const emptyEl = document.getElementById('coaching-empty');

  // Show loading state
  if (loadingEl) loadingEl.style.display = '';
  if (contentEl) contentEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    // Fetch coaching and score data in parallel
    const coachRes = fetchWithAuth('/api/sessions/' + sessionId + '/coaching');
    const scoreRes = fetchWithAuth('/api/sessions/' + sessionId + '/score');
    const results = await Promise.all([coachRes, scoreRes]);

    if (!results[0].ok) {
      const err = await results[0].json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Coaching not found');
    }

    const coachEnvelope = await results[0].json();
    const coachData = coachEnvelope.data || {};
    cachedCoaching = coachData.coaching_analysis || null;

    // Get score data for stats (non-blocking if unavailable)
    let scoreData = null;
    if (results[1].ok) {
      const scoreEnvelope = await results[1].json();
      scoreData = scoreEnvelope.data;
    }

    if (!cachedCoaching) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }

    renderCoaching(cachedCoaching, scoreData);
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = '';
  } catch (err) {

    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = '';
  }
}

/**
 * Render coaching analysis JSON into the coaching panel.
 * Sections: Call Overview, Coach's Analysis, Playbook, Your Stats, Next Call Focus.
 */
function renderCoaching(coaching, scoreData) {
  // Call Overview
  const overviewEl = document.getElementById('coaching-call-overview');
  if (overviewEl) overviewEl.textContent = coaching.call_overview || '';

  // Coach's Analysis
  const analysisEl = document.getElementById('coaching-coaches-analysis');
  if (analysisEl) analysisEl.textContent = coaching.coaches_analysis || '';

  // Playbook (side-by-side: what you said / what to say)
  const playbookEl = document.getElementById('coaching-playbook');
  if (playbookEl) {
    const plays = coaching.playbook || [];
    playbookEl.innerHTML = plays.map(function(p) {
      return '<div class="coaching-playbook-item">' +
        '<div class="coaching-playbook-situation">' + esc(p.situation || '') + '</div>' +
        '<div class="coaching-playbook-columns">' +
          '<div class="coaching-playbook-col">' +
            '<div class="coaching-playbook-col-label">What You Said</div>' +
            '<p>"' + esc(p.what_you_said || '') + '"</p>' +
          '</div>' +
          '<div class="coaching-playbook-col">' +
            '<div class="coaching-playbook-col-label what-to-say">What To Say</div>' +
            '<p>"' + esc(p.what_to_say || '') + '"</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Your Stats (from scorecard categories)
  const statsEl = document.getElementById('coaching-stats');
  if (statsEl && scoreData && scoreData.categories) {
    statsEl.innerHTML = Object.entries(scoreData.categories).map(function(entry) {
      var name = entry[0];
      var data = entry[1];
      const observed = data.observed_count || 0;
      const total = data.total_count || 0;
      const pct = total > 0 ? Math.round((observed / total) * 100) : 0;
      const barColor = pct >= window.SCORE_PASS_THRESHOLD ? 'var(--green)' : (pct >= window.SCORE_WARNING_THRESHOLD ? 'var(--orange)' : 'var(--red)');
      const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      return '<div class="coaching-stats-row">' +
        '<span class="coaching-stats-label">' + esc(displayName) + '</span>' +
        '<div class="coaching-stats-bar-wrap">' +
          '<div class="coaching-stats-bar" style="width:' + pct + '%;background:' + barColor + '"></div>' +
        '</div>' +
        '<span class="coaching-stats-count">' + observed + '/' + total + '</span>' +
      '</div>';
    }).join('');
  } else if (statsEl) {
    statsEl.innerHTML = '<p style="color:var(--gray);font-size:var(--fs-sm);">Stats not available for this session.</p>';
  }

  // Next Call Focus
  const focusEl = document.getElementById('coaching-next-focus');
  if (focusEl) {
    focusEl.innerHTML = '<p>' + esc(coaching.next_call_focus || '') + '</p>';
  }
}


/**
 * Fetch and render the transcript for a session.
 */
async function loadTranscript(sessionId) {
  const bodyEl = document.getElementById('transcript-body');
  bodyEl.innerHTML = '<div class="transcript-empty"><div class="spinner"></div><p>Loading transcript...</p></div>';

  try {
    const res = await fetchWithAuth('/api/sessions/' + sessionId + '/transcript');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Transcript not found');
    }

    const envelope = await res.json();
    const data = envelope.data || {};
    cachedTranscript = data.transcript || '';

    if (!cachedTranscript) {
      bodyEl.innerHTML = '<div class="transcript-empty"><p>No transcript available for this session.</p></div>';
      return;
    }

    renderTranscript(cachedTranscript);
  } catch (err) {

    bodyEl.innerHTML = '<div class="transcript-empty"><p>Unable to load transcript.</p></div>';
  }
}

/**
 * Parse and render transcript text into styled message bubbles.
 * Transcript format: [Role]: message text, one per line.
 */
function renderTranscript(text) {
  const bodyEl = document.getElementById('transcript-body');
  const lines = text.split('\n').filter(function(l) { return l.trim(); });
  let html = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\[(.+?)\]:\s*(.+)$/);

    if (match) {
      const role = match[1];
      const content = match[2];
      const isRep = role.toLowerCase() === 'rep';
      const cssClass = isRep ? 'transcript-msg-rep' : 'transcript-msg-buyer';

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
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = 'transcript_' + dateStr + '.txt';
  const blob = new Blob([cachedTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
  const backBtn = document.getElementById('btn-back-history');
  const liveActions = document.getElementById('debrief-live-actions');
  const tabsEl = document.getElementById('debrief-tabs');

  if (backBtn) backBtn.classList.remove('visible');
  if (liveActions) liveActions.style.display = '';
  if (tabsEl) tabsEl.style.display = 'none';

  // Reset coaching panel to loading state
  const coachLoading = document.getElementById('coaching-loading');
  const coachContent = document.getElementById('coaching-content');
  const coachEmpty = document.getElementById('coaching-empty');
  if (coachLoading) coachLoading.style.display = '';
  if (coachContent) coachContent.style.display = 'none';
  if (coachEmpty) coachEmpty.style.display = 'none';

  currentDetailSessionId = null;
  cachedTranscript = null;
  cachedCoaching = null;
}

// --- Utility Functions ---

/**
 * Format an ISO date to a short human-readable string.
 * Example: "Mar 11, 2:15 PM"
 */
function formatHistoryDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
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
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + secs.toString().padStart(2, '0');
}



/**
 * Convert scenario_id to a readable name.
 * Uses the lookup table first, falls back to cleaned formatting.
 */
function formatScenarioName(scenarioId) {
  if (!scenarioId) return 'Unknown Scenario';

  // Fallback: strip module prefix, replace underscores, title-case
  return scenarioId
    .replace(/^module\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}
