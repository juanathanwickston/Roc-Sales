/**
 * Session History Controller
 * Displays past simulation attempts with scores and stats.
 * Fetches data from GET /api/sessions and renders into Screen 5.
 */

/**
 * Load session history from the API and render the history screen.
 * Called when the user navigates to the history screen.
 */
async function loadHistory() {
  const loadingEl = document.getElementById('history-loading');
  const contentEl = document.getElementById('history-content');
  const emptyEl = document.getElementById('history-empty');

  // Show loading, hide content and empty
  loadingEl.style.display = '';
  contentEl.style.display = 'none';
  emptyEl.style.display = 'none';

  try {
    const res = await fetch('/api/sessions?limit=50');
    if (!res.ok) throw new Error('Failed to load sessions');

    const data = await res.json();
    const sessions = data.sessions || [];

    loadingEl.style.display = 'none';

    if (sessions.length === 0) {
      emptyEl.style.display = '';
      return;
    }

    // Render stats
    renderHistoryStats(sessions);

    // Render session cards
    renderSessionList(sessions);

    contentEl.style.display = '';
  } catch (err) {
    console.error('[History] Load error:', err.message);
    loadingEl.style.display = 'none';
    emptyEl.style.display = '';
  }
}

/**
 * Calculate and display summary stats from session data.
 * Shows total attempts, best score, average score, and pass rate.
 */
function renderHistoryStats(sessions) {
  const scored = sessions.filter(s => s.overall_score !== null && s.overall_score !== undefined);

  document.getElementById('stat-total').textContent = sessions.length;

  if (scored.length === 0) {
    document.getElementById('stat-best').textContent = '-';
    document.getElementById('stat-average').textContent = '-';
    document.getElementById('stat-pass-rate').textContent = '-';
    return;
  }

  const scores = scored.map(s => s.overall_score);
  const best = Math.max(...scores);
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const passes = scored.filter(s => s.overall_verdict === 'pass').length;
  const passRate = Math.round((passes / scored.length) * 100);

  document.getElementById('stat-best').textContent = best;
  document.getElementById('stat-average').textContent = average;
  document.getElementById('stat-pass-rate').textContent = `${passRate}%`;
}

/**
 * Render session cards into the history list.
 * Each card shows scenario name, date, duration, score ring, and verdict badge.
 */
function renderSessionList(sessions) {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '';

  for (const session of sessions) {
    const card = document.createElement('button');
    card.className = 'history-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `View session from ${formatHistoryDate(session.created_at)}`);

    const hasScore = session.overall_score !== null && session.overall_score !== undefined;
    const verdictClass = hasScore ? getVerdictClass(session.overall_verdict) : 'pending';
    const scoreText = hasScore ? session.overall_score : '-';
    const verdictText = hasScore ? formatVerdict(session.overall_verdict) : 'Pending';

    card.innerHTML = `
      <div class="history-score-mini ${verdictClass}">${esc(String(scoreText))}</div>
      <div class="history-card-info">
        <div class="history-card-title">${esc(formatScenarioName(session.scenario_id))}</div>
        <div class="history-card-meta">
          <span>${formatHistoryDate(session.created_at)}</span>
          ${session.duration_seconds ? `<span>${formatHistoryDuration(session.duration_seconds)}</span>` : ''}
          <span>${esc(session.status)}</span>
        </div>
      </div>
      <span class="verdict-badge verdict-${verdictClass}">${esc(verdictText)}</span>
    `;

    // Only allow viewing score if session is completed and has a score
    if (hasScore) {
      card.addEventListener('click', () => viewSessionScore(session.id));
    }

    listEl.appendChild(card);
  }
}

/**
 * Navigate to debrief screen to view a stored scorecard.
 * Fetches the score from the API and renders it using the existing scoring module.
 */
async function viewSessionScore(sessionId) {
  // Show debrief screen with loading state
  if (typeof showScreen === 'function') {
    showScreen('debrief');
  }

  const loadingEl = document.getElementById('debrief-loading');
  const contentEl = document.getElementById('debrief-content');

  loadingEl.style.display = '';
  contentEl.style.display = 'none';

  try {
    const res = await fetch(`/api/sessions/${sessionId}/score`);
    if (!res.ok) throw new Error('Score not found');

    const scorecard = await res.json();

    // Use existing scoring module to render
    if (typeof renderScorecard === 'function') {
      renderScorecard(scorecard);
    }
  } catch (err) {
    console.error('[History] Score fetch error:', err.message);
    loadingEl.style.display = 'none';
    contentEl.style.display = '';
    document.getElementById('score-number').textContent = '-';
    document.getElementById('score-verdict').textContent = 'Score unavailable';
  }
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
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert scenario_id to a readable name.
 * Replaces underscores with spaces and capitalizes words.
 */
function formatScenarioName(scenarioId) {
  if (!scenarioId) return 'Unknown Scenario';
  return scenarioId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Map verdict string to CSS class.
 */
function getVerdictClass(verdict) {
  if (verdict === 'pass') return 'pass';
  if (verdict === 'needs_work') return 'needs-work';
  if (verdict === 'fail') return 'fail';
  return 'pending';
}

/**
 * Format verdict for display with initial caps.
 */
function formatVerdict(verdict) {
  if (verdict === 'pass') return 'Pass';
  if (verdict === 'needs_work') return 'Needs Work';
  if (verdict === 'fail') return 'Fail';
  return 'Pending';
}
