/**
 * Sales Call Simulator — App Controller
 * Manages screen transitions, scenario loading, and state.
 * NO inline onclick handlers — all bindings via addEventListener (CSP compliant).
 */

// ─── Shared Helpers ───

/**
 * Escape HTML entities in user-sourced strings.
 */
var esc = function(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
};

/**
 * Toast notification system.
 */
var toast = function(msg, type, duration) {
  type = type || 'success';
  duration = duration || 3000;
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  var colors = { success: 'var(--green,#00E0B8)', error: 'var(--red,#FF4466)', info: 'var(--blue,#3B82F6)' };
  var icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  var el = document.createElement('div');
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

// ─── App Controller ───

var app = {
  currentScreen: 'scenarios',
  currentScenario: null,
  scenarios: [],

  /**
   * Initialize — load scenarios and bind all event listeners.
   */
  async init() {
    await this.loadScenarios();
    this.bindEvents();
  },

  /**
   * Bind all static event listeners (CSP-safe — no inline onclick).
   */
  bindEvents() {
    // Lobby cancel
    var lobbyCancel = document.getElementById('lobby-cancel');
    if (lobbyCancel) lobbyCancel.addEventListener('click', function() { app.cancelLobby(); });

    // Call controls
    var btnMute = document.getElementById('btn-mute');
    if (btnMute) btnMute.addEventListener('click', function() { callManager.toggleMute(); });

    var btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.addEventListener('click', function() { callManager.toggleCamera(); });

    var btnCaptions = document.getElementById('btn-captions');
    if (btnCaptions) btnCaptions.addEventListener('click', function() { callManager.toggleCaptions(); });

    var btnEnd = document.getElementById('btn-end');
    if (btnEnd) btnEnd.addEventListener('click', function() { callManager.endCall(); });

    // Debrief actions
    var btnTryAnother = document.getElementById('btn-try-another');
    if (btnTryAnother) btnTryAnother.addEventListener('click', function() { app.showScreen('scenarios'); });

    var btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', function() { app.retryScenario(); });

    // Scenario card clicks — event delegation on the grid container
    var scenarioList = document.getElementById('scenario-list');
    if (scenarioList) {
      scenarioList.addEventListener('click', function(e) {
        var card = e.target.closest('[data-scenario-id]');
        if (card) {
          app.selectScenario(card.dataset.scenarioId);
        }
      });
    }

    // ─── Coaching Sidebar: Accordion ───
    var sidebarBody = document.querySelector('.sidebar-body');
    if (sidebarBody) {
      sidebarBody.addEventListener('click', function(e) {
        var btn = e.target.closest('.guide-section-btn');
        if (!btn) return;
        var section = btn.closest('.guide-section');
        var isOpen = section.classList.contains('open');
        // Toggle this section
        section.classList.toggle('open');
        btn.setAttribute('aria-expanded', !isOpen);
      });
    }

    // ─── Mobile Guide Drawer ───
    var btnGuide = document.getElementById('btn-guide');
    var sidebar = document.getElementById('call-sidebar');
    var overlay = document.getElementById('drawer-overlay');

    if (btnGuide && sidebar && overlay) {
      btnGuide.addEventListener('click', function() {
        var isOpen = sidebar.classList.contains('drawer-open');
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
    var screen = document.getElementById('screen-' + name);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
    }
  },

  /**
   * Load and render available scenarios.
   */
  async loadScenarios() {
    var container = document.getElementById('scenario-list');
    try {
      var res = await fetch('/api/scenarios');
      var data = await res.json();
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
      var retryBtn = document.getElementById('btn-retry-load');
      if (retryBtn) retryBtn.addEventListener('click', function() { app.loadScenarios(); });
    }
  },

  /**
   * Render a scenario card — uses data-scenario-id for event delegation.
   * NO inline onclick.
   */
  renderScenarioCard(scenario) {
    var diff = scenario.difficulty || 'beginner';
    var duration = scenario.durationMinutes || scenario.duration_minutes;
    return '' +
      '<button class="scenario-card" data-scenario-id="' + esc(scenario.id) + '" role="listitem"' +
        ' aria-label="' + esc(scenario.name) + ' — ' + diff + ' difficulty" type="button">' +
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
   * User selected a scenario — fetch full details and start lobby.
   */
  async selectScenario(scenarioId) {
    try {
      var res = await fetch('/api/scenarios/' + scenarioId);
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
    var scenarioName = this.currentScenario ? this.currentScenario.name : 'Sales Call Simulation';
    document.getElementById('debrief-scenario-name').textContent = scenarioName;
    document.getElementById('debrief-loading').style.display = 'flex';
    document.getElementById('debrief-content').style.display = 'none';
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
document.addEventListener('DOMContentLoaded', function() { app.init(); });
