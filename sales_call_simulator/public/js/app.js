/**
 * Sales Call Simulator - App Controller
 * Manages screen transitions, scenario loading, and state.
 * NO inline onclick handlers - all bindings via addEventListener (CSP compliant).
 */

// --- Shared Helpers ---

/**
 * Escape HTML entities in user-sourced strings.
 */
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * Format a category key (e.g., "make_the_sale") into display text ("Make The Sale").
 */
function formatCategoryName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

/**
 * Helper to inject the roc_token into API requests.
 */
function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('roc_token');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

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
  const colors = { success: 'var(--green,#19A070)', error: 'var(--red,#D93737)', info: 'var(--blue,#0051C2)' };
  const icons = { success: '\u2713', error: '!', info: 'i' };
  const el = document.createElement('div');
  el.style.cssText = 'pointer-events:auto;padding:8px 16px;border-radius:var(--rs,6px);background:var(--bg-card,#fff);border:1px solid ' + (colors[type] || colors.success) + ';color:var(--text-primary,#001D4E);font-size:var(--fs-sm,13px);font-family:var(--font,"Open Sans",sans-serif);box-shadow:var(--shadow-card-hover);transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;max-width:340px;';
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
  currentScreen: 'login',
  currentScenario: null,
  currentUser: null,
  scenarios: [],
  _selectingScenario: false,
  _pollAborted: false,

  /**
   * Initialize - check auth, then load scenarios and progress.
   */
  async init() {
    this.bindEvents();

    // Check if token was provided in the launch URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('roc_token', urlToken);
    }

    // Check for existing valid token
    const token = localStorage.getItem('roc_token');
    if (token) {
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (res.ok) {
          const envelope = await res.json();
          this.currentUser = envelope.data;
          this.updateFacilitatorNav();
          await this.initAfterAuth();
          return;
        }
      } catch (err) {
        // silently ignore
      }
      // Token invalid — clear it
      localStorage.removeItem('roc_token');
    }

    // No valid token — show login screen
    this.showScreen('login');
  },

  /**
   * Handle login form submission.
   */
  async login(name) {

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, accessCode: this._pendingAccessCode || '' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(function() { return {}; });
        throw new Error(err.detail || err.error || 'Login failed');
      }

      const envelope = await res.json();
      const data = envelope.data;

      localStorage.setItem('roc_token', data.token);
      this.currentUser = data.user;
      this._pendingAccessCode = '';

      // Show facilitator dashboard button if admin
      this.updateFacilitatorNav();

      await this.initAfterAuth();

  },

  /**
   * Sign out — clear token and return to login.
   */
  logout() {
    localStorage.removeItem('roc_token');
    this.currentUser = null;
    this.scenarios = [];
    // Hide facilitator nav
    const facBtn = document.getElementById('btn-facilitator');
    if (facBtn) facBtn.style.display = 'none';
    this.showScreen('login');
  },

  /**
   * Show/hide the facilitator dashboard nav link based on role.
   */
  updateFacilitatorNav() {
    const btn = document.getElementById('btn-facilitator');
    if (btn && this.currentUser) {
      btn.style.display = this.currentUser.role === 'admin' ? '' : 'none';
    }
  },

  /**
   * Load app data after successful authentication.
   */
  async initAfterAuth() {

    this.showScreen('scenarios');
    await this.loadScenarios();

    // Load progress dashboard (non-blocking)
    if (typeof loadProgress === 'function') {
      loadProgress().catch(function() {});
    }

    // Check for launch context (set by GET /launch redirect)
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


      this.selectScenario(launchScenarioId);
    }
  },

  /**
   * Bind all static event listeners (CSP-safe - no inline onclick).
   */
  bindEvents() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('login-name');
        const errorEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');
        const name = nameInput ? nameInput.value.trim() : '';
        const codeInput = document.getElementById('login-code');
        const code = codeInput ? codeInput.value.trim() : '';

        if (!name) {
          if (errorEl) errorEl.textContent = 'Please enter your name.';
          return;
        }

        app._pendingAccessCode = code;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing in...';
        }
        if (errorEl) errorEl.textContent = '';

        app.login(name).catch(function(err) {
          if (errorEl) errorEl.textContent = err.message || 'Login failed. Please try again.';
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Start Training';
          }
        });
      });
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', function() { app.logout(); });

    // Facilitator dashboard
    const btnFacilitator = document.getElementById('btn-facilitator');
    if (btnFacilitator) btnFacilitator.addEventListener('click', function() {
      facilitator.init();
      app.showScreen('facilitator');
    });
    const btnFacBack = document.getElementById('btn-facilitator-back');
    if (btnFacBack) btnFacBack.addEventListener('click', function() {
      facilitator.destroy();
      app.showScreen('scenarios');
    });
    const btnFacLogout = document.getElementById('btn-facilitator-logout');
    if (btnFacLogout) btnFacLogout.addEventListener('click', function() {
      facilitator.destroy();
      app.logout();
    });

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
          // H6 fix: Prevent double-click from creating duplicate conversations
          if (app._selectingScenario) return;
          app.selectScenario(card.dataset.scenarioId);
        }
      });
    }

    // Module card and scenario modal events are handled by progress.js initProgressEvents()


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

    // --- History Navigation ---
    const btnViewHistory = document.getElementById('btn-view-history');
    if (btnViewHistory) {
      btnViewHistory.addEventListener('click', function() {
        app.showScreen('history');
        if (typeof loadHistory === 'function') loadHistory();
      });
    }

    const btnHistoryBack = document.getElementById('btn-history-back');
    if (btnHistoryBack) {
      btnHistoryBack.addEventListener('click', function() { app.showScreen('scenarios'); });
    }

    const btnHistoryLogout = document.getElementById('btn-history-logout');
    if (btnHistoryLogout) {
      btnHistoryLogout.addEventListener('click', function() { app.logout(); });
    }

    const btnHistoryStart = document.getElementById('btn-history-start');
    if (btnHistoryStart) {
      btnHistoryStart.addEventListener('click', function() { app.showScreen('scenarios'); });
    }

    // --- Debrief: Back to History ---
    const btnBackHistory = document.getElementById('btn-back-history');
    if (btnBackHistory) {
      btnBackHistory.addEventListener('click', function() {
        app.showScreen('history');
        if (typeof loadHistory === 'function') loadHistory(historyCurrentPage);
      });
    }

    // --- Debrief: Tab Switching ---
    const debriefTabs = document.getElementById('debrief-tabs');
    if (debriefTabs) {
      debriefTabs.addEventListener('click', function(e) {
        const tab = e.target.closest('.debrief-tab');
        if (tab && tab.dataset.tab && typeof switchDebriefTab === 'function') {
          switchDebriefTab(tab.dataset.tab);
        }
      });
    }

    // --- Transcript: Copy & Download ---
    const btnCopy = document.getElementById('btn-copy-transcript');
    if (btnCopy) {
      btnCopy.addEventListener('click', function() { if (typeof copyTranscript === 'function') copyTranscript(); });
    }

    const btnDownload = document.getElementById('btn-download-transcript');
    if (btnDownload) {
      btnDownload.addEventListener('click', function() { if (typeof downloadTranscript === 'function') downloadTranscript(); });
    }

    // --- History: Pagination ---
    const btnPagePrev = document.getElementById('btn-page-prev');
    if (btnPagePrev) {
      btnPagePrev.addEventListener('click', function() {
        if (typeof historyCurrentPage !== 'undefined' && historyCurrentPage > 0) {
          loadHistory(historyCurrentPage - 1);
        }
      });
    }

    const btnPageNext = document.getElementById('btn-page-next');
    if (btnPageNext) {
      btnPageNext.addEventListener('click', function() {
        if (typeof historyCurrentPage !== 'undefined' && typeof HISTORY_PAGE_SIZE !== 'undefined' && typeof historyTotalSessions !== 'undefined') {
          const totalPages = Math.ceil(historyTotalSessions / HISTORY_PAGE_SIZE);
          if (historyCurrentPage < totalPages - 1) {
            loadHistory(historyCurrentPage + 1);
          }
        }
      });
    }
  },

  /**
   * Switch between screens.
   */
  showScreen(name) {
    // H7 fix: Cancel any active poll when changing screens
    this._pollAborted = true;

    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    const screen = document.getElementById('screen-' + name);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
    }

    // H8 fix: Re-enable login button when returning to login screen
    if (name === 'login') {
      const submitBtn = document.getElementById('login-submit');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Start Training';
      }
    }
  },

  /**
   * Load and cache available scenarios.
   * The home screen is now stage-based (rendered by progress.js).
   * This method just fetches and caches data needed for selectScenario().
   */
  async loadScenarios() {
    try {
      const res = await fetch('/api/scenarios');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `Failed to load scenarios: ${res.status}`);
      }
      const envelope = await res.json();
      this.scenarios = envelope.data.scenarios || [];

    } catch (err) {
    }
  },



  /**
   * User selected a scenario - fetch full details and start lobby.
   */
  async selectScenario(scenarioId) {
    // H6 fix: Guard against double-clicks / concurrent selections
    if (this._selectingScenario) return;
    this._selectingScenario = true;

    try {
      const res = await fetch('/api/scenarios/' + scenarioId);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `Scenario not found: ${res.status}`);
      }
      const envelope = await res.json();
      this.currentScenario = envelope.data;

      document.getElementById('lobby-scenario-name').textContent = this.currentScenario.name;
      document.getElementById('lobby-status').textContent = 'Setting up the conversation...';
      this.showScreen('lobby');

      await callManager.startCall(this.currentScenario);
    } catch (err) {

      toast(err.message || 'Failed to start scenario. Please try again.', 'error');
      this.showScreen('scenarios');
    } finally {
      this._selectingScenario = false;
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
    // Reset debrief to live-call mode (hide back button, show Try Another/Retry, hide tabs)
    if (typeof resetDebriefForLiveCall === 'function') resetDebriefForLiveCall();

    this.showScreen('debrief');
    const scenarioName = this.currentScenario ? this.currentScenario.name : 'Sales Call Simulation';
    const debriefScenarioNameEl = document.getElementById('debrief-scenario-name');
    if (debriefScenarioNameEl) {
      debriefScenarioNameEl.textContent = scenarioName;
    }
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

        scoring.renderManualDebrief(callData, this.currentScenario);
        return;
      }

      // Poll for completion with progressive UX updates
      const finalStatus = await this.pollSessionStatus(callData.sessionId);

      if (finalStatus === 'completed') {
        // Fetch and render the scorecard
        const scorecard = await this.fetchScorecard(callData.sessionId);
        if (scorecard) {
          scoring.renderScorecard(scorecard, this.currentScenario);

          // Wire up context for Transcript/Coaching tabs
          if (typeof currentDetailSessionId !== 'undefined') {
            currentDetailSessionId = callData.sessionId;
            cachedTranscript = null;
            cachedCoaching = null;
            if (typeof switchDebriefTab === 'function') switchDebriefTab('scorecard');
          }

          toast('Performance evaluation complete', 'success');
        } else {
          scoring.renderManualDebrief(callData, this.currentScenario);
        }
      } else if (finalStatus === 'timeout') {
        toast('Evaluation is taking longer than expected. Check back later for results.', 'info');
        setTimeout(() => this.showScreen('scenarios'), 4000);
      } else {

        toast('Automated scoring unavailable — showing self-assessment', 'info');
        scoring.renderManualDebrief(callData, this.currentScenario);
      }
    } catch (err) {

      toast('Automated scoring unavailable — showing self-assessment', 'info');
      scoring.renderManualDebrief(callData, this.currentScenario);
    }
  },

  /**
   * Poll session status until it reaches a terminal state (completed or failed).
   * Returns the final status string.
   */
  async pollSessionStatus(sessionId) {
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLLS = 150; // 5 minutes max
    const loadingText = document.querySelector('#debrief-loading p');

    // H7 fix: Reset abort flag when starting a new poll
    this._pollAborted = false;

    for (let poll = 1; poll <= MAX_POLLS; poll++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      // H7 fix: Check abort flag at each iteration
      if (this._pollAborted) return 'aborted';

      // Progressive UX messages
      const elapsed = poll * 2;
      if (loadingText) {
        if (elapsed >= 90) {
          loadingText.textContent = 'Still processing... you can leave this tab open in the background.';
        } else if (elapsed >= 30) {
          loadingText.textContent = 'Evaluating your call - this may take a minute or two.';
        }
      }

      try {
        const res = await fetchWithAuth(`/api/sessions/${sessionId}`);

        if (!res.ok) continue;

        const envelope = await res.json();
        const session = envelope.data;

        if (session.status === 'completed' || session.status === 'failed') {
          return session.status;
        }


      } catch (err) {
      }
    }


    return 'timeout';
  },

  /**
   * Fetch the stored scorecard from the backend.
   * Returns the scorecard object, or null if not found.
   */
  async fetchScorecard(sessionId) {
    try {
      const res = await fetchWithAuth(`/api/sessions/${sessionId}/score`);

      if (!res.ok) {

        return null;
      }

      const envelope = await res.json();
      return envelope.data;
    } catch (err) {
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
