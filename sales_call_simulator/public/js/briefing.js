/**
 * briefing.js: Pre-call Briefing Dashboard Logic
 * Handles persona data rendering, CHAMP interactions, MCQ drills, and completion flow.
 */

(function () {
  'use strict';

  // ─── MODULE DATA BINDINGS ───

  let DRILL_QUESTIONS = {};
  let PERSONA_DATA = {};
  let CHAMP_EXPLORER_CONTENT = {};
  let UI_COPY = {};
  let FRAMEWORK_SECTIONS = [];

  // Active configurations for Module 4 (not fallback, strictly loaded for Module 4)
  const MODULE4_UI_CONFIG = {
    step1Heading: 'Pre-Call Research',
    step2HudLabel: 'CHAMP Mapping',
    step2CardTitle: 'CHAMP Framework Explorer',
    step2CardSubtitle: "Explore each pillar to map {displayName}'s specific situation to our product features and financial ROI.",
    step3Header: 'Playbook & Objection Handling Guidelines',
    step3CommitmentLabel: 'Closing & Commitment (2-Option Close)',
    strategyLabel: 'Discovery Strategy',
    criticalGuidelinesLabel: 'Critical Guidelines & Instant Fails',
    continuityGuidance: 'Reference Prior Connection: Establish continuity by referencing the previous scheduled appointment. Do not open the call as a cold call.',
  };

  const MODULE4_FRAMEWORK_SECTIONS = [
    { key: 'challenges', letter: 'CH', label: 'Challenges' },
    { key: 'authority', letter: 'A', label: 'Authority' },
    { key: 'money', letter: 'M', label: 'Money' },
    { key: 'prioritization', letter: 'P', label: 'Prioritization' }
  ];

  // ─── STATE ───
 
  let state = {
    token: '',
    scenarioId: '',
    userId: '',
    moduleId: '',
    personaId: '',
    scenario: null,
    correctCount: 0,
    answered: new Set(),
    completed: false,
    currentStep: 1,
    champReviewed: new Set(),
    quizCurrentQuestionIndex: 0,
  };
 
  // ─── INIT ───
 
  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.token = params.get('token') || '';
    state.scenarioId = params.get('scenarioId') || '';
    state.userId = params.get('userId') || '';
    state.moduleId = params.get('moduleId') || '';

    // 1. Validate moduleId
    if (state.moduleId !== 'module4' && state.moduleId !== 'module5') {
      showError('Invalid or missing module parameter. Please relaunch from the LMS.');
      return;
    }

    // 2. Validate required launch parameters
    if (!state.token || !state.scenarioId) {
      showError('Missing launch parameters. Please relaunch from the LMS.');
      return;
    }

    // 3. Bind loaded data files
    if (state.moduleId === 'module4') {
      if (!window.module4BriefingData) {
        showError('Module 4 briefing data failed to load. Please relaunch.');
        return;
      }
      DRILL_QUESTIONS = window.module4BriefingData.DRILL_QUESTIONS;
      PERSONA_DATA = window.module4BriefingData.PERSONA_DATA;
      CHAMP_EXPLORER_CONTENT = window.module4BriefingData.CHAMP_EXPLORER_CONTENT;
      UI_COPY = MODULE4_UI_CONFIG;
      FRAMEWORK_SECTIONS = MODULE4_FRAMEWORK_SECTIONS;
    } else {
      if (!window.module5BriefingData) {
        showError('Module 5 briefing data failed to load. Please relaunch.');
        return;
      }
      DRILL_QUESTIONS = window.module5BriefingData.DRILL_QUESTIONS;
      PERSONA_DATA = window.module5BriefingData.PERSONA_DATA;
      CHAMP_EXPLORER_CONTENT = window.module5BriefingData.FRAMEWORK_CONTENT;
      UI_COPY = window.module5BriefingData.UI_COPY;
      FRAMEWORK_SECTIONS = window.module5BriefingData.FRAMEWORK_SECTIONS;
    }

    // 4. Resolve personaId
    state.personaId = state.scenarioId.replace(`${state.moduleId}_`, '');

    // 5. Confirm persona and quiz data exist in bound objects
    if (!PERSONA_DATA[state.personaId] || !DRILL_QUESTIONS[state.personaId]) {
      showError(`Unknown persona: ${state.personaId}. Please contact your administrator.`);
      return;
    }

    try {
      // Fetch scenario data
      const res = await fetch(`/api/scenarios/${state.scenarioId}`, {
        headers: { 'Authorization': `Bearer ${state.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        state.scenario = json.data || json;
      }
    } catch (err) {
      console.warn('Failed to fetch scenario config, using local data:', err);
    }

    // All personas use the wizard-style pre-call briefing
    const mainEl = document.getElementById('briefingMain');
    if (mainEl) mainEl.classList.add('wizard-layout');
    const appEl = document.getElementById('briefingApp');
    if (appEl) appEl.classList.add('wizard-mode');
    const container = document.getElementById('wizardContainer');
    if (container) container.style.display = 'block';
    renderWizard();
  }

  // ─── WIZARD RENDER ───

  function renderWizard() {
    const persona = PERSONA_DATA[state.personaId];
    
    // Hide loading screen, show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('briefingApp').style.display = 'block';

    // Header
    document.getElementById('headerPersonaName').textContent = `${persona.displayName} (${persona.product})`;

    // Update HUD step indicators
    const hud = document.getElementById('wizardHud');
    if (hud) {
      hud.querySelectorAll('.hud-step').forEach(stepEl => {
        const stepNum = parseInt(stepEl.dataset.step, 10);
        stepEl.classList.remove('active', 'completed');
        if (stepNum === state.currentStep) {
          stepEl.classList.add('active');
        } else if (stepNum < state.currentStep) {
          stepEl.classList.add('completed');
        }
      });
      // Step 2 HUD label update
      const step2Label = hud.querySelector('.hud-step[data-step="2"] .hud-step-label');
      if (step2Label && UI_COPY.step2HudLabel) {
        step2Label.textContent = UI_COPY.step2HudLabel;
      }
    }

    // Render Step Content
    const container = document.getElementById('wizardContainer');
    let stepHtml = '';

    if (state.currentStep === 1) {
      stepHtml = `
        <div class="card" style="padding: 0; overflow: hidden; max-width: 960px; margin: 0 auto 16px auto;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-main);">${UI_COPY.step1Heading}: ${persona.displayName}</h3>
              <p style="font-size: 11px; color: var(--color-text-muted);">${persona.subtitle}</p>
            </div>
          </div>
          
          <div style="position: relative; width: 100%; background: #000; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;">
            <video id="briefingVideo" controls preload="metadata" style="width: 100%; height: 100%; object-fit: cover;">
              <source id="briefingVideoSource" src="${persona.videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>

          <div style="border-top: 1px solid var(--border-color); background: #f8fafc;">
            <button id="toggleTranscriptBtn" style="width: 100%; padding: 12px 20px; background: transparent; border: none; font-family: var(--font-family); font-size: 13px; font-weight: 600; color: var(--color-primary); cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
              <span>Show Transcript</span>
              <span id="transcriptArrow">▼</span>
            </button>
            <div id="transcriptBody" style="display: none; padding: 0 20px 20px 20px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--border-color); background: #ffffff; max-height: 220px; overflow-y: auto;">
              <div style="display: flex; gap: 12px; margin-top: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #001D4E; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">${persona.initials}</div>
                <div style="background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 12px 16px; font-size: 13px; color: var(--color-text-main); line-height: 1.5; border: 1px solid var(--border-color);">
                  <div style="font-weight: 700; font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${persona.displayName} (Owner)</div>
                  "${persona.transcript}"
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (state.currentStep === 2) {
      stepHtml = `
        <div class="card" style="padding: 24px;">
          <div class="card-title" style="margin-bottom: 8px;">${UI_COPY.step2CardTitle}</div>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 20px;">
            ${UI_COPY.step2CardSubtitle.replace('{displayName}', persona.displayName)}
          </p>
          <div class="champ-selector ${state.moduleId === 'module5' ? 'module5-grid' : ''}" id="champSelector">
            ${FRAMEWORK_SECTIONS.map(sec => `
              <button class="champ-btn" data-champ="${sec.key}">
                <span class="champ-letter">${sec.letter}</span>
                <span class="champ-label">${sec.label}</span>
              </button>
            `).join('')}
          </div>
          <div id="champExplorerContent" style="margin-top: 24px;">
            <!-- Populated dynamically via JS -->
          </div>
        </div>
      `;
    } else if (state.currentStep === 3) {
      let continuityHtml = '';
      if (UI_COPY.continuityGuidance) {
        const parts = UI_COPY.continuityGuidance.split(':');
        const boldLabel = parts[0];
        const normalText = parts.slice(1).join(':');
        continuityHtml = `<div>• <strong>${boldLabel}:</strong>${normalText}</div>`;
      }

      stepHtml = `
        <div class="handout-snippet" style="margin: 0 auto;">
          <div class="handout-snippet-header" style="flex-shrink: 0;">
            <span>${UI_COPY.step3Header}</span>
          </div>
          <div class="handout-snippet-body" style="padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;">
            <!-- Row 1: Context & Objection -->
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; flex-shrink: 0;">
              <div>
                <div class="explorer-label">Buyer Behavioral Profile</div>
                <div class="explorer-value" style="font-size: 12.5px;">
                  ${persona.behavioralProfile}
                </div>
              </div>
              <div>
                <div class="explorer-label">Expected Objection</div>
                <div class="explorer-value" style="font-style: italic; font-weight: 500; font-size: 12.5px; border-left: 3px solid var(--border-color); padding-left: 10px;">
                  "${persona.stage3.expectedObjection}"
                </div>
              </div>
            </div>
            
            <!-- Row 2: Chronological Objection Handling Flow -->
            <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: flex; flex-direction: column; gap: 8px;">
              <div class="explorer-label">Tactical Objection Handling Flow</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                ${persona.objectionFlow.map(step => `
                <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: ${step.color}; letter-spacing: 0.3px;">${step.label}</div>
                  <div style="font-size: 11.5px; font-weight: 500; color: var(--color-text-main); line-height: 1.3;">${step.quote}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">${step.desc}</div>
                </div>
                `).join('')}
              </div>
            </div>

            <!-- Row 3: Next Step Commitment & Fails -->
            <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex-shrink: 0;">
              <div>
                <div class="explorer-label">${UI_COPY.step3CommitmentLabel}</div>
                <div class="explorer-value" style="font-size: 12.5px;">
                  Target: ${persona.stage3.targetCommitment}<br>
                  <div style="margin-top: 6px; padding: 10px 14px; background: #f0f7ff; border-left: 3px solid var(--color-primary); border-radius: 4px; font-style: italic; font-weight: 500; line-height: 1.4;">
                    "${persona.stage3.closingStatement}"
                  </div>
                </div>
              </div>
              <div>
                <div class="explorer-label">${UI_COPY.criticalGuidelinesLabel}</div>
                <div style="font-size: 11.5px; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 4px; line-height: 1.4;">
                  <div>• <strong>Product Focus:</strong> ${persona.productFocusGuideline}</div>
                  ${continuityHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (state.currentStep === 4) {
      stepHtml = `
        <div class="card">
          <div class="card-title">Pre-call Knowledge Check</div>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 20px;">Complete the quiz to unlock your live simulation session.</p>
          <div class="drill-progress">
            <div class="drill-progress-bar"><div class="drill-progress-fill" id="progressFill"></div></div>
            <div class="drill-progress-text" id="progressText">0 / 4 correct</div>
          </div>
          <div id="quizContainer">
            <!-- Populated by JS -->
          </div>
        </div>
      `;
    }

    // Determine disabled states
    const isChampStep = state.currentStep === 2;
    const champCompleted = state.champReviewed.size === FRAMEWORK_SECTIONS.length;
    const isQuizStep = state.currentStep === 4;
    const quizPassed = state.correctCount === DRILL_QUESTIONS[state.personaId].length;
    
    let isNextDisabled = false;
    if (isChampStep && !champCompleted) isNextDisabled = true;
    if (isQuizStep && !quizPassed) isNextDisabled = true;

    container.innerHTML = stepHtml;

    // Update Header Navigation buttons
    const backBtn = document.getElementById('wizardBackBtn');
    const nextBtn = document.getElementById('wizardNextBtn');
    const warningEl = document.getElementById('headerWizardWarning');

    if (backBtn && nextBtn) {
      backBtn.disabled = state.currentStep === 1;
      nextBtn.disabled = state.currentStep === 4 || isNextDisabled;
      nextBtn.textContent = 'Next Step →';

      if (warningEl) {
        warningEl.textContent = '';
        warningEl.style.display = 'none';
      }
    }

    // Bind event listeners for steps
    if (state.currentStep === 1) {
      // Bind toggleable transcript (video auto-loads via preload="metadata")

      const transcriptBody = document.getElementById('transcriptBody');
      const toggleBtn = document.getElementById('toggleTranscriptBtn');
      const arrow = document.getElementById('transcriptArrow');

      if (toggleBtn && transcriptBody && arrow) {
        toggleBtn.onclick = () => {
          const isHidden = transcriptBody.style.display === 'none';
          transcriptBody.style.display = isHidden ? 'block' : 'none';
          toggleBtn.querySelector('span').textContent = isHidden ? 'Hide Transcript' : 'Show Transcript';
          arrow.textContent = isHidden ? '▲' : '▼';
        };
      }
    } else if (state.currentStep === 2) {
      setupChampSelector();
      const firstActive = state.champReviewed.size > 0 ? Array.from(state.champReviewed)[state.champReviewed.size - 1] : FRAMEWORK_SECTIONS[0].key;
      const activeBtn = document.querySelector(`.champ-btn[data-champ="${firstActive}"]`);
      if (activeBtn) activeBtn.click();
    } else if (state.currentStep === 3) {
      // Step 3 content is rendered inline in the stepHtml template above
    } else if (state.currentStep === 4) {
      renderQuiz();
    }

    // Bind Back / Next buttons
    document.getElementById('wizardBackBtn').onclick = handleWizardBack;
    document.getElementById('wizardNextBtn').onclick = handleWizardNext;
  }

  function handleWizardBack() {
    if (state.currentStep > 1) {
      state.currentStep--;
      renderWizard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleWizardNext() {
    if (state.currentStep < 4) {
      state.currentStep++;
      renderWizard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Step 4 "Enter Simulation" acts as completion
      handleComplete();
    }
  }

  function renderChampExplorerContent(champKey) {
    const container = document.getElementById('champExplorerContent');
    if (!container) return;

    const content = CHAMP_EXPLORER_CONTENT[state.personaId]?.[champKey];
    if (!content) return;

    container.innerHTML = `
      <div class="champ-explorer-stack">
        <div class="champ-pillar-card">
          <div class="champ-detail-section">
            <div class="explorer-label">Pillar Focus</div>
            <div class="explorer-value">${content.pillarFocus}</div>
          </div>
          
          <div class="champ-detail-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
            <div class="explorer-label">${content.sectionLabel}</div>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
              ${content.items.map(item => `
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--color-text-main);">${item.title}</div>
                  <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">${item.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="champ-strategy-box">
            <div class="explorer-label" style="color: var(--color-primary); margin-bottom: 4px;">${UI_COPY.strategyLabel}</div>
            <div class="explorer-value" style="font-weight: 500;">${content.discoveryStrategy}</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = container.innerHTML;
  }



  function renderQuiz() {
    const questions = DRILL_QUESTIONS[state.personaId];
    if (!questions) return;

    const container = document.getElementById('quizContainer');
    if (!container) return;

    const qIdx = state.quizCurrentQuestionIndex || 0;
    const q = questions[qIdx];
    const isAnswered = state.answered.has(qIdx);

    container.innerHTML = `
      <div class="quiz-question show" id="quiz-q-${qIdx}" style="animation: fadeSlideIn var(--transition-fast) forwards; display: flex; flex-direction: column; gap: 16px;">
        <div class="quiz-q-number" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.5px;">Question ${qIdx + 1} of ${questions.length}</div>
        <div class="quiz-q-text" style="font-size: 15px; font-weight: 700; color: var(--color-text-main); margin-bottom: 4px; line-height: 1.4;">${q.question}</div>
        <div class="quiz-options" style="display: flex; flex-direction: column; gap: 10px;">
          ${q.options.map((opt, oIdx) => {
            let extraClass = '';
            if (isAnswered) {
              const isCorrectOpt = opt === q.answer;
              extraClass = isCorrectOpt ? ' correct locked' : ' locked';
            }
            return `
              <div class="quiz-option${extraClass}" data-question="${qIdx}" data-option="${oIdx}">
                <span class="radio"></span>
                <span style="font-size: 13px; line-height: 1.4;">${opt}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="quiz-feedback" id="feedback-${qIdx}" style="min-height: 20px;"></div>
        <div id="quizActionContainer" style="display: flex; justify-content: flex-end; margin-top: 8px; min-height: 38px;">
          <!-- Populated dynamically with Next Question or Completion button -->
        </div>
      </div>
    `;

    // Bind event listeners
    container.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        const oIdx = parseInt(el.dataset.option, 10);
        handleQuizClick(qIdx, oIdx);
      });
    });

    // If already answered, show feedback and actions
    if (isAnswered) {
      showFeedback(qIdx, true, "Correct! You're locked in on this detail.");
      renderQuizActionButton(qIdx, questions.length);
    }
  }

  function renderQuizActionButton(qIdx, totalQuestions) {
    const actionContainer = document.getElementById('quizActionContainer');
    if (!actionContainer) return;

    const isLast = qIdx + 1 === totalQuestions;
    if (isLast) {
      actionContainer.innerHTML = '';
      return;
    }

    actionContainer.innerHTML = `
      <button class="btn btn-primary" id="quizNextBtn" style="padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all var(--transition-fast);">
        Next Question →
      </button>
    `;

    document.getElementById('quizNextBtn').onclick = () => {
      state.quizCurrentQuestionIndex++;
      renderQuiz();
    };
  }

  // ─── INTERACTIONS ───



  function setupChampSelector() {
    document.querySelectorAll('.champ-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const champ = btn.dataset.champ;
        const wasActive = btn.classList.contains('active');

        if (!wasActive) {
          document.querySelectorAll('.champ-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          if (state.currentStep === 2) {
            state.champReviewed.add(champ);
            renderChampExplorerContent(champ);
            if (state.champReviewed.size === FRAMEWORK_SECTIONS.length) {
              const nextBtn = document.getElementById('wizardNextBtn');
              if (nextBtn) {
                nextBtn.disabled = false;
                const warnText = nextBtn.previousElementSibling;
                if (warnText && warnText.tagName === 'SPAN') {
                  warnText.style.display = 'none';
                }
              }
            }
          } else {
            document.querySelectorAll('.champ-detail').forEach(d => d.classList.remove('active'));
            document.querySelectorAll('.blueprint-champ-zone').forEach(z => z.classList.remove('glow'));
            
            const detail = document.querySelector(`.champ-detail[data-champ-detail="${champ}"]`);
            if (detail) detail.classList.add('active');

            const zones = document.querySelectorAll(`.blueprint-champ-zone[data-zone="${champ}"]`);
            zones.forEach(z => z.classList.add('glow'));
            if (zones.length > 0) {
              zones[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      });
    });
  }

  // Quiz click handler (local binding)
  function handleQuizClick(qIdx, oIdx) {
    if (state.answered.has(qIdx)) return;

    const questions = DRILL_QUESTIONS[state.personaId];
    const question = questions[qIdx];
    const selectedOpt = question.options[oIdx];
    const isCorrect = selectedOpt === question.answer;

    const options = document.querySelectorAll(`.quiz-option[data-question="${qIdx}"]`);
    options.forEach(opt => {
      opt.classList.remove('selected', 'incorrect');
    });

    const selectedEl = document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${oIdx}"]`);

    if (isCorrect) {
      options.forEach(opt => opt.classList.add('locked'));
      selectedEl.classList.add('correct');
      state.correctCount++;
      state.answered.add(qIdx);
      showFeedback(qIdx, true, "Correct! You're locked in on this detail.");
      renderQuizActionButton(qIdx, questions.length);
    } else {
      selectedEl.classList.add('incorrect');
      showFeedback(qIdx, false, "Not quite. Try another option!");
    }

    updateProgress();
  }

  function showFeedback(qIdx, success, message) {
    const fb = document.getElementById(`feedback-${qIdx}`);
    if (!fb) return;
    fb.className = `quiz-feedback show ${success ? 'success' : 'error'}`;
    fb.textContent = message;
  }

  function updateProgress() {
    const total = DRILL_QUESTIONS[state.personaId].length;
    const pct = (state.correctCount / total) * 100;
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `${state.correctCount} / ${total} correct`;

    if (state.correctCount === total) {
      unlockCompletion();
    }
  }

  function unlockCompletion() {
    const btn = document.getElementById('completeBtn');
    btn.classList.add('unlocked');
    btn.disabled = false;
    document.getElementById('statusText').textContent = 'Knowledge check complete: ready to proceed!';

    btn.addEventListener('click', handleComplete);
  }

  async function handleComplete() {
    const btn = document.getElementById('completeBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/briefing/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          scenarioId: state.scenarioId,
          moduleId: state.moduleId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      state.completed = true;

      // Close the window to return to the LMS
      window.close();

      // Fallback: if the browser blocks window.close(), show a message
      setTimeout(() => {
        btn.textContent = 'Briefing Complete';
        btn.disabled = true;
        document.getElementById('statusText').textContent = 'Briefing submitted successfully. You may close this tab to return to the LMS.';
      }, 500);
    } catch (err) {
      console.error('Completion failed:', err);
      btn.textContent = 'Retry Submission';
      btn.disabled = false;
      btn.classList.add('unlocked');
    }
  }

  function showSuccess() {
    const overlay = document.getElementById('successOverlay');
    overlay.classList.add('show');
    document.getElementById('successTimestamp').textContent = `Completed: ${new Date().toLocaleString()}`;
    document.querySelector('.bottom-bar').style.display = 'none';

    // Confetti
    spawnConfetti();

    // Enter sim button
    document.getElementById('enterSimBtn').addEventListener('click', () => {
      const params = new URLSearchParams({
        token: state.token,
        scenarioId: state.scenarioId,
        userId: state.userId,
        moduleId: state.moduleId,
      });
      window.location.href = `/?${params.toString()}`;
    });
  }

  function spawnConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#4f46e5', '#00e0b8', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#7c3aed', '#fde047'];

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty('--duration', `${1.5 + Math.random() * 2}s`);
      piece.style.animationDelay = `${Math.random() * 1}s`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      container.appendChild(piece);
    }
  }

  // ─── ERROR ───

  function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
  }

  // ─── BOOT ───

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
