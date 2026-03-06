/**
 * Sales Call Simulator — App Controller
 * Manages screen transitions, scenario loading, and state.
 */

// ─── Shared Helpers (matching ROC Academy api.js patterns) ───

/**
 * Escape HTML entities in user-sourced strings.
 * Prevents XSS when inserting via innerHTML.
 */
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * Toast notification system — auto-dismiss alerts.
 * Usage: toast('Saved!') or toast('Error occurred', 'error')
 */
function toast(msg, type = 'success', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { success: 'var(--green,#00E0B8)', error: 'var(--red,#FF4466)', info: 'var(--blue,#3B82F6)' };
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.style.cssText = `pointer-events:auto;padding:8px 16px;border-radius:var(--rs,8px);background:var(--n2,#0F1B32);border:1px solid ${colors[type] || colors.success};color:var(--white,#EDF2FF);font-size:var(--fs-sm,13px);font-family:var(--font,'Geist',sans-serif);backdrop-filter:blur(12px);transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;max-width:340px;`;
  el.innerHTML = `<span style="margin-right:8px">${icons[type] || icons.success}</span>${esc(msg)}`;
  container.appendChild(el);
  requestAnimationFrame(() => el.style.transform = 'translateX(0)');
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, type === 'error' ? 5000 : duration);
}

// ─── App Controller ───

const app = {
  currentScreen: 'scenarios',
  currentScenario: null,
  scenarios: [],

  /**
   * Initialize the app — load scenarios on startup.
   */
  async init() {
    await this.loadScenarios();
  },

  /**
   * Switch between screens.
   */
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`screen-${name}`);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
    }
  },

  /**
   * Load and render available scenarios.
   */
  async loadScenarios() {
    const container = document.getElementById('scenario-list');
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      this.scenarios = data.scenarios || [];

      if (this.scenarios.length === 0) {
        // M9: Empty state with icon + title + desc + CTA
        container.setAttribute('aria-busy', 'false');
        container.innerHTML = `
          <div class="empty-state" role="listitem">
            <div class="empty-icon">🎭</div>
            <div class="empty-title">No scenarios available</div>
            <div class="empty-desc">Training scenarios haven't been configured yet. Contact your administrator.</div>
          </div>`;
        return;
      }

      container.setAttribute('aria-busy', 'false');
      container.innerHTML = this.scenarios
        .map(s => this.renderScenarioCard(s))
        .join('');
    } catch (err) {
      console.error('[App] Failed to load scenarios:', err);
      container.setAttribute('aria-busy', 'false');
      container.innerHTML = `
        <div class="empty-state" role="listitem">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Unable to load scenarios</div>
          <div class="empty-desc">Please check your connection and try again.</div>
          <button class="btn btn-primary" onclick="app.loadScenarios()">Retry</button>
        </div>`;
    }
  },

  /**
   * Render a single scenario card as a semantic button element.
   */
  renderScenarioCard(scenario) {
    const diff = scenario.difficulty || 'beginner';
    const duration = scenario.durationMinutes || scenario.duration_minutes;
    return `
      <button class="scenario-card" onclick="app.selectScenario('${esc(scenario.id)}')" role="listitem"
        aria-label="${esc(scenario.name)} — ${diff} difficulty">
        <div class="scenario-card-title">
          <span>${esc(scenario.name)}</span>
          <span class="difficulty-badge difficulty-${diff}">${diff}</span>
        </div>
        <div class="scenario-card-desc">${esc(scenario.description || '')}</div>
        <div class="scenario-card-meta">
          ${scenario.module ? `<span>📋 ${esc(scenario.module)}</span>` : ''}
          ${duration ? `<span>⏱ ${duration} min</span>` : ''}
        </div>
      </button>`;
  },

  /**
   * User selected a scenario — fetch full details and start lobby.
   */
  async selectScenario(scenarioId) {
    try {
      const token = localStorage.getItem('roc_token');
      const res = await fetch(`/api/scenarios/${scenarioId}`);
      if (!res.ok) throw new Error('Scenario not found');
      this.currentScenario = await res.json();

      // Show lobby
      document.getElementById('lobby-scenario-name').textContent = this.currentScenario.name;
      document.getElementById('lobby-status').textContent = 'Setting up the conversation...';
      this.showScreen('lobby');

      // Start the call
      await callManager.startCall(this.currentScenario);
    } catch (err) {
      console.error('[App] Error selecting scenario:', err);
      // C8 fix: toast instead of alert()
      toast('Failed to start scenario. Please try again.', 'error');
      this.showScreen('scenarios');
    }
  },

  /**
   * Cancel from lobby — return to scenarios.
   */
  cancelLobby() {
    callManager.cleanup();
    this.showScreen('scenarios');
    toast('Call cancelled', 'info');
  },

  /**
   * Called when a call ends — transition to debrief.
   */
  async onCallEnded(callData) {
    this.showScreen('debrief');

    // Set debrief header
    const scenarioName = this.currentScenario?.name || 'Sales Call Simulation';
    document.getElementById('debrief-scenario-name').textContent = scenarioName;

    // Show loading
    document.getElementById('debrief-loading').style.display = 'flex';
    document.getElementById('debrief-content').style.display = 'none';

    // Run scoring
    await scoring.evaluate(callData, this.currentScenario);
  },

  /**
   * Retry the current scenario.
   */
  retryScenario() {
    if (this.currentScenario) {
      this.selectScenario(this.currentScenario.id);
    } else {
      this.showScreen('scenarios');
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => app.init());
