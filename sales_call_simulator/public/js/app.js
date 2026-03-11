/**
 * Sales Call Simulator - App Controller
 * Manages screen transitions, scenario loading, and state.
 * NO inline onclick handlers - all bindings via addEventListener (CSP compliant).
 */

// --- Shared Helpers ---

/**
 * Escape HTML entities in user-sourced strings.
 */
const esc = function(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
};

/**
 * Toast notification system.
 */
const toast = function(msg, type, duration) {
  type = type || 'success';
  duration = duration || 3000;
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { success: 'var(--green,#00E0B8)', error: 'var(--red,#FF4466)', info: 'var(--blue,#3B82F6)' };
  const icons = { success: '\u2713', error: '!', info: 'i' };
  const el = document.createElement('div');
  el.style.cssText = 'pointer-events:auto;padding:8px 16px;border-radius:var(--rs,8px);background:var(--n2,#0F1B32);border:1px solid ' + (colors[type] || colors.success) + ';color:var(--white,#EDF2FF);font-size:var(--fs-sm,13px);font-family:var(--font,Geist,sans-serif);backdrop-filter:blur(12px);transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;max-width:340px;';
  el.innerHTML = '<span style="margin-right:8px">' + (icons[type] || icons.success) + '</span>' + esc(msg);
  container.appendChild(el);
  requestAnimationFrame(function() { el.style.transform = 'translateX(0)'; });
  setTimeout(function() {
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 300);
  }, type === 'error' ? 5000 : duration);
};

// --- App Controller ---

const app = {
  currentScreen: 'scenarios',
  currentScenario: null,
  scenarios: [],

  /**
   * Initialize - load scenarios, bind events, check for launch context.
   */
  async init() {
    await this.loadScenarios();
    this.bindEvents();

    // Check for launch context from ROC Academy (set by GET /launch redirect)
    const params = new URLSearchParams(window.location.search);
    const launchScenarioId = params.get('scenarioId');
    if (launchScenarioId) {
      this.launchContext = {
        userId: params.get('userId'),
        courseId: params.get('courseId'),
        moduleId: params.get('moduleId'),
        returnUrl: params.get('returnUrl'),
      };

      // Clear URL params so refresh does not re-trigger launch
      window.history.replaceState({}, '', window.location.pathname);

      console.log(`[App] Launch context: scenario ${launchScenarioId}`);
      this.selectScenario(launchScenarioId);
    }
  },

  /**
   * Bind all static event listeners (CSP-safe - no inline onclick).
   */
  bindEvents() {
    // Lobby cancel
    const lobbyCancel = document.getElementById('lobby-cancel');
    if (lobbyCancel) lobbyCancel.addEventListener('click', function() { app.cancelLobby(); });

    // Call controls
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) btnMute.addEventListener('click', function() { callManager.toggleMute(); });

    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.addEventListener('click', function() { callManager.toggleCamera(); });

    const btnEnd = document.getElementById('btn-end');
    if (btnEnd) btnEnd.addEventListener('click', function() { callManager.endCall(); });

    // Debrief actions
    const btnTryAnother = document.getElementById('btn-try-another');
    if (btnTryAnother) btnTryAnother.addEventListener('click', function() { app.showScreen('scenarios'); });

    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', function() { app.retryScenario(); });

    // Scenario card clicks - event delegation on the grid container
    const scenarioList = document.getElementById('scenario-list');
    if (scenarioList) {
      scenarioList.addEventListener('click', function(e) {
        const card = e.target.closest('[data-scenario-id]');
        if (card) {
          app.selectScenario(card.dataset.scenarioId);
        }
      });
    }

    // --- Coaching Sidebar: Accordion ---
    const sidebarBody = document.querySelector('.sidebar-body');
    if (sidebarBody) {
      sidebarBody.addEventListener('click', function(e) {
        const btn = e.target.closest('.guide-section-btn');
        if (!btn) return;
        const section = btn.closest('.guide-section');
        const isOpen = section.classList.contains('open');
        // Toggle this section
        section.classList.toggle('open');
        btn.setAttribute('aria-expanded', !isOpen);
      });
    }

    // --- Mobile Guide Drawer ---
    const btnGuide = document.getElementById('btn-guide');
    const sidebar = document.getElementById('call-sidebar');
    const overlay = document.getElementById('drawer-overlay');

    if (btnGuide && sidebar && overlay) {
      btnGuide.addEventListener('click', function() {
        const isOpen = sidebar.classList.contains('drawer-open');
        sidebar.classList.toggle('drawer-open');
        overlay.classList.toggle('visible');
      });
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('drawer-open');
        overlay.classList.remove('visible');
      });
    }
  },

  /**
   * Switch between screens.
   */
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    const screen = document.getElementById('screen-' + name);
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
        container.setAttribute('aria-busy', 'false');
        container.innerHTML =
          '<div class="empty-state" role="listitem">' +
            '<div class="empty-icon">🎭</div>' +
            '<div class="empty-title">No scenarios available</div>' +
            '<div class="empty-desc">Training scenarios haven\'t been configured yet. Contact your administrator.</div>' +
          '</div>';
        return;
      }

      container.setAttribute('aria-busy', 'false');
      container.innerHTML = this.scenarios
        .map(function(s) { return app.renderScenarioCard(s); })
        .join('');
    } catch (err) {
      console.error('[App] Failed to load scenarios:', err);
      container.setAttribute('aria-busy', 'false');
      container.innerHTML =
        '<div class="empty-state" role="listitem">' +
          '<div class="empty-icon">⚠️</div>' +
          '<div class="empty-title">Unable to load scenarios</div>' +
          '<div class="empty-desc">Please check your connection and try again.</div>' +
          '<button id="btn-retry-load" class="btn btn-primary">Retry</button>' +
        '</div>';
      // Bind retry button
      const retryBtn = document.getElementById('btn-retry-load');
      if (retryBtn) retryBtn.addEventListener('click', function() { app.loadScenarios(); });
    }
  },

  /**
   * Render a scenario card - uses data-scenario-id for event delegation.
   * NO inline onclick.
   */
  renderScenarioCard(scenario) {
    const diff = scenario.difficulty || 'beginner';
    const duration = scenario.durationMinutes || scenario.duration_minutes;
    return '' +
      '<button class="scenario-card" data-scenario-id="' + esc(scenario.id) + '" role="listitem"' +
        ' aria-label="' + esc(scenario.name) + ' - ' + diff + ' difficulty" type="button">' +
        '<div class="scenario-card-title">' +
          '<span>' + esc(scenario.name) + '</span>' +
          '<span class="difficulty-badge difficulty-' + diff + '">' + diff + '</span>' +
        '</div>' +
        '<div class="scenario-card-desc">' + esc(scenario.description || '') + '</div>' +
        '<div class="scenario-card-meta">' +
          (scenario.module ? '<span>📋 ' + esc(scenario.module) + '</span>' : '') +
          (duration ? '<span>⏱ ' + duration + ' min</span>' : '') +
        '</div>' +
      '</button>';
  },

  /**
   * User selected a scenario - fetch full details and start lobby.
   */
  async selectScenario(scenarioId) {
    try {
      const res = await fetch('/api/scenarios/' + scenarioId);
      if (!res.ok) throw new Error('Scenario not found');
      this.currentScenario = await res.json();

      document.getElementById('lobby-scenario-name').textContent = this.currentScenario.name;
      document.getElementById('lobby-status').textContent = 'Setting up the conversation...';
      this.showScreen('lobby');

      await callManager.startCall(this.currentScenario);
    } catch (err) {
      console.error('[App] Error selecting scenario:', err);
      toast('Failed to start scenario. Please try again.', 'error');
      this.showScreen('scenarios');
    }
  },

  /**
   * Cancel from lobby - return to scenarios.
   */
  cancelLobby() {
    callManager.cleanup();
    this.showScreen('scenarios');
    toast('Call cancelled', 'info');
  },

  /**
   * Called when a call ends - trigger backend processing and poll for results.
   */
  async onCallEnded(callData) {
    this.showScreen('debrief');
    const scenarioName = this.currentScenario ? this.currentScenario.name : 'Sales Call Simulation';
    document.getElementById('debrief-scenario-name').textContent = scenarioName;
    document.getElementById('debrief-loading').style.display = 'flex';
    document.getElementById('debrief-content').style.display = 'none';

    if (!callData.sessionId) {
      // No session - fall back to manual debrief
      scoring.renderManualDebrief(callData, this.currentScenario);
      return;
    }

    try {
      // Trigger backend processing (fire-and-forget on server side)
      const token = localStorage.getItem('roc_token');
      const triggerRes = await fetch(`/api/sessions/${callData.sessionId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!triggerRes.ok) {
        console.warn('[App] Backend processing trigger failed:', triggerRes.status);
        scoring.renderManualDebrief(callData, this.currentScenario);
        return;
      }

      // Poll for completion
      const finalStatus = await this.pollSessionStatus(callData.sessionId);

      if (finalStatus === 'completed') {
        // Fetch and render the scorecard
        const scorecard = await this.fetchScorecard(callData.sessionId);
        if (scorecard) {
          scoring.renderScorecard(scorecard, this.currentScenario);
          toast('Performance evaluation complete', 'success');
        } else {
          scoring.renderManualDebrief(callData, this.currentScenario);
        }
      } else {
        console.warn(`[App] Session ended with status: ${finalStatus}`);
        toast('AI scoring unavailable - showing self-assessment', 'info');
        scoring.renderManualDebrief(callData, this.currentScenario);
      }
    } catch (err) {
      console.error('[App] Post-call processing error:', err);
      toast('AI scoring unavailable - showing self-assessment', 'info');
      scoring.renderManualDebrief(callData, this.currentScenario);
    }
  },

  /**
   * Poll session status until it reaches a terminal state (completed or failed).
   * Returns the final status string.
   */
  async pollSessionStatus(sessionId) {
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLLS = 30;
    const token = localStorage.getItem('roc_token');

    for (let poll = 1; poll <= MAX_POLLS; poll++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (!res.ok) continue;

        const session = await res.json();

        if (session.status === 'completed' || session.status === 'failed') {
          return session.status;
        }

        console.log(`[App] Polling session ${sessionId}: ${session.status} (${poll}/${MAX_POLLS})`);
      } catch (err) {
        console.warn('[App] Poll error:', err.message);
      }
    }

    console.warn(`[App] Polling timed out after ${MAX_POLLS} attempts`);
    return 'timeout';
  },

  /**
   * Fetch the stored scorecard from the backend.
   * Returns the scorecard object, or null if not found.
   */
  async fetchScorecard(sessionId) {
    try {
      const token = localStorage.getItem('roc_token');
      const res = await fetch(`/api/sessions/${sessionId}/score`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        console.warn('[App] Scorecard fetch failed:', res.status);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn('[App] Scorecard fetch error:', err.message);
      return null;
    }
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
document.addEventListener('DOMContentLoaded', function() { app.init(); });
