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
  el.style.cssText = 'pointer-events:auto;padding:8px 16px;border-radius:var(--rs,8px);background:var(--bg-card,#fff);border:1px solid ' + (colors[type] || colors.success) + ';color:var(--text-primary,#001D4E);font-size:var(--fs-sm,13px);font-family:var(--font,Geist,sans-serif);box-shadow:var(--shadow-card-hover);transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;max-width:340px;';
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
   * Initialize - load scenarios, bind events, load progress, check for launch context.
   */
  async init() {
    await this.loadScenarios();
    this.bindEvents();

    // Load progress dashboard (non-blocking)
    if (typeof loadProgress === 'function') {
      loadProgress().catch(function(err) { console.warn('[App] Progress load failed:', err); });
    }

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

    // Stage card CTA clicks - event delegation on the stage cards container
    const stageCards = document.getElementById('stage-cards');
    if (stageCards) {
      stageCards.addEventListener('click', function(e) {
        const cta = e.target.closest('[data-scenario-id]');
        if (cta) {
          const sid = cta.dataset.scenarioId;
          // Pilot: Route Module 1 to Course Player instead of AI Simulator
          if (sid === 'module1_identifying_customer') {
              app.startCoursePilot();
          } else {
              app.selectScenario(sid);
          }
        }
      });
    }

    // --- Course Player Binding ---
    const btnCourseBack = document.getElementById('btn-course-back');
    if (btnCourseBack) {
       btnCourseBack.addEventListener('click', function() { app.showScreen('scenarios'); });
    }
    const btnSubmitCourse = document.getElementById('btn-submit-course');
    if (btnSubmitCourse) {
       btnSubmitCourse.addEventListener('click', function() { app.submitCoursePilot(); });
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
          var totalPages = Math.ceil(historyTotalSessions / HISTORY_PAGE_SIZE);
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
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    const screen = document.getElementById('screen-' + name);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = name;
    }
  },

  /**
   * Load and cache available scenarios.
   * The home screen is now stage-based (rendered by progress.js).
   * This method just fetches and caches data needed for selectScenario().
   */
  async startCoursePilot() {
      // Hardcoded Pilot payload for Module 1
      document.getElementById('course-title').textContent = "Identify the Customer";
      document.getElementById('course-stage-name').textContent = "Module 1 – Discovery Framework";
      document.getElementById('course-description').textContent = "Learn to qualify suspects through discovery calls before ever launching into your product pitch.";

      const quizHTML = `
        <div class="quiz-question" style="margin-bottom:20px;">
          <p style="margin-bottom:8px;font-weight:600;">1. What is the primary goal of the initial discovery call?</p>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q1" value="wrong"> To pitch the Payroc product catalog immediately</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q1" value="correct"> To qualify the prospect and uncover their pain points</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q1" value="wrong"> To close the sale on the first interaction</label>
        </div>
        <div class="quiz-question" style="margin-bottom:20px;">
          <p style="margin-bottom:8px;font-weight:600;">2. In the BANT qualification framework, what does 'A' stand for?</p>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q2" value="wrong"> Assets</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q2" value="correct"> Authority</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q2" value="wrong"> Awareness</label>
        </div>
        <div class="quiz-question" style="margin-bottom:20px;">
          <p style="margin-bottom:8px;font-weight:600;">3. Which is the best closing sequence for a module 1 interaction?</p>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q3" value="wrong"> "Can I get your credit card to process the setup fee today?"</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q3" value="wrong"> "How does our tier-pricing look compared to Square?"</label>
          <label style="display:block;margin-bottom:8px;cursor:pointer;"><input type="radio" name="q3" value="correct"> "Would it make sense to set up a follow-up call with the rest of your decision-makers?"</label>
        </div>
      `;
      document.getElementById('course-quiz-form').innerHTML = quizHTML;
      this.showScreen('course-player');
  },

  async submitCoursePilot() {
      const form = document.getElementById('course-quiz-form');
      const formData = new FormData(form);
      
      let score = 0;
      if (formData.get('q1') === 'correct') score += 33.3;
      if (formData.get('q2') === 'correct') score += 33.3;
      if (formData.get('q3') === 'correct') score += 33.4;

      score = Math.round(score);

      // JSON mapping masking as AI evaluation hook
      const payload = {
        session_id: 'lms_' + Date.now(),
        scenario_id: 'module1_identifying_customer', // Bind identically to AI stage payload map
        overall_score: score,
        duration_seconds: 300,
        categories: {
            "Discovery Questions": {
                score: score > 33 ? 100 : 0, 
                feedback: ["Module 1 Knowledge Exam Completed."]
            },
            "Qualification Framework": {
                score: score,
                feedback: ["Module 1 Knowledge Exam Completed."]
            }
        }
      };

      try {
          const btn = document.getElementById('btn-submit-course');
          const originalText = btn.textContent;
          btn.textContent = "Grading & Saving to Database...";
          btn.disabled = true;

          await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          
          btn.textContent = originalText;
          btn.disabled = false;
          
          showToast(`Course Passed! You scored ${score}%`, 'success');
          
          if (typeof fetchProgress === 'function') {
             await fetchProgress(); // Dynamically re-hydrate Dashboard chart vectors
          }
          this.showScreen('scenarios');
          
      } catch(e) {
          console.error(e);
          showToast('Database error while saving LMS record.', 'error');
      }
  },

  async loadScenarios() {
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      this.scenarios = data.scenarios || [];
      console.log('[App] Loaded ' + this.scenarios.length + ' scenario(s)');
    } catch (err) {
      console.error('[App] Failed to load scenarios:', err);
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
          (scenario.module ? '<span>' + esc(scenario.module) + '</span>' : '') +
          (duration ? '<span>' + duration + ' min</span>' : '') +
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
    // Reset debrief to live-call mode (hide back button, show Try Another/Retry, hide tabs)
    if (typeof resetDebriefForLiveCall === 'function') resetDebriefForLiveCall();

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
    const MAX_POLLS = 150; // 5 minutes max
    const token = localStorage.getItem('roc_token');
    const loadingText = document.querySelector('#debrief-loading p');

    for (let poll = 1; poll <= MAX_POLLS; poll++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

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
