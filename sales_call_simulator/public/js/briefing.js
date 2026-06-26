/**
 * briefing.js — Pre-call Mission Briefing Dashboard Logic
 * Handles persona data rendering, CHAMP interactions, MCQ drills, and completion flow.
 */

(function () {
  'use strict';

  // ─── QUIZ DATA (hardcoded per plan) ───

  const DRILL_QUESTIONS = {
    sam_patel: [
      {
        question: "What is Sam Patel's primary behavioral style?",
        options: ['Controller', 'Supporter', 'Doer', 'Talker'],
        answer: 'Controller',
      },
      {
        question: 'What is the correct Payroc product to recommend for QuickStop Market?',
        options: ['Bodega AI', 'Roc Terminal+', 'Roc Services', 'Roc Giving'],
        answer: 'Bodega AI',
      },
      {
        question: "What is Sam's primary operational bottleneck that drains his time?",
        options: [
          'Manual price updates and spreadsheet inventory tracking',
          'Delayed billing collections',
          'Checkout confusion at shared desk',
          'Inconsistent donations',
        ],
        answer: 'Manual price updates and spreadsheet inventory tracking',
      },
      {
        question: "What recent regulatory event represents Sam's highest compliance risk?",
        options: [
          'An EBT compliance warning for age-verification errors',
          'A health department audit',
          'An IRS tax compliance warning',
          'A credit card processing breach',
        ],
        answer: 'An EBT compliance warning for age-verification errors',
      },
    ],
    carla_reyes: [
      {
        question: "What is Carla Reyes' primary behavioral style?",
        options: ['Supporter', 'Controller', 'Doer', 'Talker'],
        answer: 'Supporter',
      },
      {
        question: 'What is the correct Payroc product to recommend for Studio Collective Salon?',
        options: ['Roc Terminal+', 'Bodega AI', 'Roc Services', 'Roc Giving'],
        answer: 'Roc Terminal+',
      },
      {
        question: "What is Carla's biggest underlying fear about changing the salon's checkout system?",
        options: [
          'Losing her top stylists due to onboarding disruption',
          'Increased processing fees',
          'Losing client data',
          'Regulatory compliance issues',
        ],
        answer: 'Losing her top stylists due to onboarding disruption',
      },
      {
        question: 'How many independent stylists rent booths at Studio Collective Salon?',
        options: ['6', '4', '8', '10'],
        answer: '6',
      },
    ],
    mike_turner: [
      {
        question: "What is Mike Turner's primary behavioral style?",
        options: ['Doer', 'Supporter', 'Controller', 'Talker'],
        answer: 'Doer',
      },
      {
        question: 'What is the correct Payroc product to recommend for Precision Plumbing & Drain?',
        options: ['Roc Services', 'Bodega AI', 'Roc Terminal+', 'Roc Giving'],
        answer: 'Roc Services',
      },
      {
        question: 'What is the primary cash flow bottleneck that Precision Plumbing faces?',
        options: [
          'Delayed billing collections taking 2-3 weeks to clear',
          'Manual price updates',
          'Inconsistent donations',
          'Checkout confusion',
        ],
        answer: 'Delayed billing collections taking 2-3 weeks to clear',
      },
      {
        question: 'How many trucks and field technicians does Mike manage?',
        options: [
          '4 trucks and 4 technicians',
          '6 trucks and 6 technicians',
          '3 trucks and 5 technicians',
          '8 trucks and 8 technicians',
        ],
        answer: '4 trucks and 4 technicians',
      },
    ],
    david_miller: [
      {
        question: "What is Pastor David Miller's primary behavioral style?",
        options: ['Talker-Supporter Hybrid', 'Controller', 'Doer', 'Supporter'],
        answer: 'Talker-Supporter Hybrid',
      },
      {
        question: 'What is the correct Payroc product/platform to recommend for the church?',
        options: ['Roc Giving', 'Bodega AI', 'Roc Terminal+', 'Roc Services'],
        answer: 'Roc Giving',
      },
      {
        question: 'What specific fundraising goal is the church currently trying to achieve?',
        options: [
          'Repairing the community basketball court for their youth basketball program',
          'Building a new sanctuary',
          'Funding a food pantry',
          'Renovating the parking lot',
        ],
        answer: 'Repairing the community basketball court for their youth basketball program',
      },
      {
        question: 'What primary administrative burden is burning out church volunteers?',
        options: [
          'Manual tracking of cash/checks and generating tax receipts',
          'Scheduling services',
          'Managing social media',
          'Coordinating transportation',
        ],
        answer: 'Manual tracking of cash/checks and generating tax receipts',
      },
    ],
  };

  // ─── PERSONA DISPLAY DATA ───

  const PERSONA_DATA = {
    sam_patel: {
      displayName: 'Sam Patel',
      initials: 'SP',
      business: 'QuickStop Market — Independent Convenience Store',
      location: 'Suburban Michigan',
      style: 'Controller',
      styleDesc: 'Analytical, efficient, highly skeptical',
      product: 'Bodega AI',
      segment: 'Convenience / Bodega',
      info: [
        { label: 'Industry', value: 'Convenience Store' },
        { label: 'Product Fit', value: 'Bodega AI' },
        { label: 'Behavioral Style', value: 'Controller' },
        { label: 'Risk Level', value: 'High Skepticism' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Manual price updates drain hours every week. Spreadsheet inventory tracking leads to leakage. Credit card processing fees are eating into thin margins. Recent EBT compliance warning threatens his license.',
          action: 'Ask about how he currently handles price changes and inventory counts. Follow up on compliance concerns.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Sam is the sole owner and decision-maker. No board or partners to consult. Decisions are fast when he sees hard data, but he will not act on vague promises.',
          action: 'Speak in terms of ROI, data, and measurable outcomes. Avoid fluff.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Thin margins (2-5% on most items). Every dollar matters. Processing fees are a known pain point. He has been quoted cheaper rates before and is skeptical of "savings" claims.',
          action: 'Lead with margin protection and cost avoidance, not just lower rates.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Sam is in "survive" mode — day-to-day operations consume him. He will not prioritize a new system unless the pain of the status quo is clearly worse. The EBT warning created urgency.',
          action: 'Connect automation to time savings he can feel immediately. Use the compliance urgency.',
        },
      },
      questions: [
        'How do you currently handle price changes across your store?',
        'Walk me through what inventory management looks like week-to-week.',
        'How much time does your team spend on manual counts and restocking?',
        'Tell me about the compliance situation — I heard there may have been a warning?',
        'What would it mean for the business if you lost your EBT license?',
      ],
      objections: [
        { trigger: "We've always done it this way.", response: 'Acknowledge the comfort of routine, then quantify the cost of manual work. "Totally fair — when you add up the hours on pricing alone, what does that look like each week?"' },
        { trigger: 'I already got quoted cheaper rates.', response: "Don't compete on rate. Pivot to total cost of ownership. \"Rates are one piece — what about the shrink and labor cost from manual inventory?\"" },
        { trigger: "I don't have time for a new system.", response: "Mirror his time pressure back. \"That's exactly the problem we solve — the current system is what's stealing your time.\"" },
      ],
    },
    carla_reyes: {
      displayName: 'Carla Reyes',
      initials: 'CR',
      business: 'Studio Collective Salon — Multi-booth Beauty Salon',
      location: 'Denver, Colorado',
      style: 'Supporter',
      styleDesc: 'Relationship-driven, warm, collaborative, cautious of disruption',
      product: 'Roc Terminal+',
      segment: 'Beauty / Salon',
      info: [
        { label: 'Industry', value: 'Beauty Salon' },
        { label: 'Product Fit', value: 'Roc Terminal+' },
        { label: 'Behavioral Style', value: 'Supporter' },
        { label: 'Team Size', value: '6 Booth Renters' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Shared checkout desk creates confusion among 6 stylists. Manual reconciliation at end of day is tedious and error-prone. Stylists occasionally lose track of client payments. Fear of disruption if new systems are introduced.',
          action: 'Ask how checkout currently works when multiple stylists have clients finishing at the same time.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Carla owns the salon but the stylists are independent renters. She needs their buy-in — any change that feels forced will cause pushback or walkouts. Decisions are collaborative.',
          action: 'Frame the solution as something that helps the TEAM, not just Carla. Use inclusive language.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Each stylist manages their own revenue through shared infrastructure. The current single-terminal setup means Carla absorbs reconciliation costs. Stylists want transparent payment tracking.',
          action: 'Show how split payments give each stylist their own transparent revenue stream with no extra hardware.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Carla will not rush a decision. She needs to feel confident that her team is onboard. The biggest fear is losing top stylists to disruption. Timeline depends on team comfort.',
          action: 'Propose a low-pressure trial or demo that stylists can experience before committing.',
        },
      },
      questions: [
        'How does the checkout process work when multiple stylists finish with clients at the same time?',
        'What does end-of-day reconciliation look like for you and the stylists?',
        'Have any stylists ever had issues with payment tracking or missing transactions?',
        'If you could change one thing about how payments work in the salon, what would it be?',
        'How do your stylists feel about trying new tools or technology?',
      ],
      objections: [
        { trigger: 'My stylists won\'t want to learn something new.', response: "Validate the concern, then reframe. \"I hear you — that's why this is designed to be simpler than what they do now, not more complex.\"" },
        { trigger: 'We\'ve managed fine so far.', response: 'Agree and elevate. "You\'ve built something great — this is about protecting that by reducing the friction points that could frustrate your team."' },
        { trigger: 'I need to talk to my stylists first.', response: "Support the collaborative process. \"Absolutely, I'd expect nothing less. Would a quick demo for the team make that conversation easier?\"" },
      ],
    },
    mike_turner: {
      displayName: 'Mike Turner',
      initials: 'MT',
      business: 'Precision Plumbing & Drain — Residential Plumbing',
      location: 'Columbus, Ohio',
      style: 'Doer',
      styleDesc: 'Fast-paced, direct, results-oriented, highly impatient',
      product: 'Roc Services',
      segment: 'Field Services / Plumbing',
      info: [
        { label: 'Industry', value: 'Plumbing Services' },
        { label: 'Product Fit', value: 'Roc Services' },
        { label: 'Behavioral Style', value: 'Doer' },
        { label: 'Fleet Size', value: '4 Trucks, 4 Techs' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Technicians leave jobs without collecting payment. Paper invoices are sent days after job completion. Payments take 2-3 weeks to arrive. Office staff spend hours chasing unpaid invoices manually.',
          action: 'Ask how techs currently handle billing when they finish a job in the field.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Mike is the sole owner and makes all decisions quickly. He values directness — get to the point fast or he\'ll cut you off. No committee, no approval chain.',
          action: 'Be direct. Lead with the result, then explain how. Skip the small talk.',
        },
        money: {
          title: 'Money & Budget',
          body: 'Cash flow gaps create severe stress during winter slow season. Delayed invoicing means delayed revenue. Lost estimates to faster competitors cost real money.',
          action: 'Quantify the cash flow impact: "If 4 techs run 3 jobs/day and each invoice is delayed 2 weeks..."',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'Mike knows operations are inefficient but hates dealing with new technology. He\'ll prioritize a change only if it\'s dead simple for his crew and solves an immediate pain.',
          action: 'Emphasize crew-friendly design. "Your guys tap 3 buttons on their phone and the invoice goes out."',
        },
      },
      questions: [
        'When a tech finishes a job, what happens with billing right now?',
        'How long does it typically take from job completion to payment received?',
        'How does your office handle the follow-up on unpaid invoices?',
        'Have you lost any jobs recently because a competitor got an estimate out faster?',
        'What does cash flow look like during the slow season with these delays?',
      ],
      objections: [
        { trigger: "We've always done it this way.", response: "Don't argue. Validate and redirect. \"Makes sense — when you look at the 2-3 week delay on getting paid, what's that costing you over a quarter?\"" },
        { trigger: 'My guys won\'t use it. They\'re plumbers, not computer guys.', response: "Meet the objection head-on. \"Exactly — this is built for field crews, not office workers. Three taps and the invoice is sent.\"" },
        { trigger: 'I already use QuickBooks.', response: "Don't compete. Complement. \"QuickBooks is great for the back office — this gets the data to QuickBooks faster by capturing it in the field.\"" },
      ],
    },
    david_miller: {
      displayName: 'Pastor David Miller',
      initials: 'DM',
      business: 'New Hope Community Church — Church & Nonprofit',
      location: 'Western Pennsylvania',
      style: 'Talker-Supporter Hybrid',
      styleDesc: 'Warm, relational, deeply mission-focused',
      product: 'Roc Giving',
      segment: 'Church / Nonprofit',
      info: [
        { label: 'Organization', value: 'Church & Nonprofit' },
        { label: 'Product Fit', value: 'Roc Giving' },
        { label: 'Behavioral Style', value: 'Talker-Supporter Hybrid' },
        { label: 'Congregation', value: '~350 Active Members' },
      ],
      champ: {
        challenges: {
          title: 'Challenges',
          body: 'Donations are inconsistent — heavily reliant on Sunday collections. Manual tracking of cash and checks is time-consuming. Volunteers are burning out generating handwritten tax receipts. Younger families want digital giving options.',
          action: 'Ask about how the church currently collects and tracks donations week-to-week.',
        },
        authority: {
          title: 'Authority (Decision-Making)',
          body: 'Pastor David leads the church but values community input. Major decisions involve the church board. He needs to feel personally aligned with the mission before advocating.',
          action: 'Connect the solution to the church\'s mission and community impact. Make him a champion.',
        },
        money: {
          title: 'Money & Budget',
          body: 'The church operates on tight budgets funded by donations. The basketball court fundraiser is the current priority. Processing fees are a concern but secondary to engagement.',
          action: 'Frame costs as an investment in the basketball court project. Show how digital giving increases total donations.',
        },
        prioritization: {
          title: 'Prioritization & Timeline',
          body: 'The basketball court repair is the immediate priority. Volunteer burnout is a growing concern. Pastor David will move when he believes the solution genuinely serves his community.',
          action: 'Tie everything to the basketball court timeline. "What if you could fund the court project by Q4?"',
        },
      },
      questions: [
        'How does the church currently collect donations on a typical Sunday?',
        'What does the process look like after service for counting and recording donations?',
        'Have younger families mentioned wanting other ways to give?',
        'How\'s the basketball court fundraiser going? Are you on track?',
        'How many volunteer hours go into donation tracking and receipts each week?',
      ],
      objections: [
        { trigger: 'We already have ways to collect donations.', response: "Honor the tradition. \"Your congregation's generosity is clear — this is about making it easier for everyone to give in the way that's most comfortable for them.\"" },
        { trigger: "We don't want giving to feel transactional.", response: "Align with the mission. \"100% — this is about deepening engagement, not processing payments. Think of it as extending the giving experience beyond Sunday.\"" },
        { trigger: "We're not very tech-savvy.", response: "Remove the burden. \"Your volunteers won't need to be. The system handles tracking and receipts automatically — it actually reduces the tech burden on your team.\"" },
      ],
    },
  };

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
  };

  // ─── INIT ───

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.token = params.get('token') || '';
    state.scenarioId = params.get('scenarioId') || '';
    state.userId = params.get('userId') || '';
    state.moduleId = params.get('moduleId') || '';

    if (!state.token || !state.scenarioId) {
      showError('Missing launch parameters. Please relaunch from the LMS.');
      return;
    }

    // Extract personaId from scenarioId (e.g., 'module4_sam_patel' -> 'sam_patel')
    state.personaId = state.scenarioId.replace(`${state.moduleId}_`, '');

    if (!PERSONA_DATA[state.personaId]) {
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

    renderDashboard();
  }

  // ─── RENDER ───

  function renderDashboard() {
    const persona = PERSONA_DATA[state.personaId];

    // Hide loading, show app
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('briefingApp').style.display = 'block';

    // Header
    document.getElementById('headerPersonaName').textContent = `${persona.displayName} — ${persona.product}`;

    // Persona profile
    document.getElementById('personaAvatar').textContent = persona.initials;
    document.getElementById('personaFullName').textContent = persona.displayName;
    document.getElementById('personaBusiness').textContent = persona.business + ' • ' + persona.location;
    document.getElementById('behavioralStyle').textContent = `${persona.style} — ${persona.styleDesc}`;

    // Info grid
    const infoGrid = document.getElementById('infoGrid');
    infoGrid.innerHTML = persona.info.map(item => `
      <div class="info-item">
        <div class="info-label">${item.label}</div>
        <div class="info-value">${item.value}</div>
      </div>
    `).join('');

    // CHAMP details
    renderChampDetails(persona);

    // Playbook
    renderPlaybook(persona);

    // Blueprint
    renderBlueprint(persona);

    // Quiz
    renderQuiz();

    // Download link
    document.getElementById('downloadPdf').href = `/handouts/${state.personaId}_handout.pdf`;

    // Tabs
    setupTabs();

    // CHAMP selector
    setupChampSelector();

    // Blueprint title
    document.getElementById('blueprintTitle').textContent = `${persona.displayName} — Pre-call Handout`;
    document.getElementById('blueprintSubtitle').textContent = `${persona.business}`;
  }

  function renderChampDetails(persona) {
    const container = document.getElementById('champDetails');
    container.innerHTML = Object.entries(persona.champ).map(([key, data]) => `
      <div class="champ-detail" data-champ-detail="${key}">
        <div class="champ-detail-box">
          <div class="champ-detail-header">${data.title}</div>
          <div class="champ-detail-body">${data.body}</div>
          <div class="champ-detail-action">💡 ${data.action}</div>
        </div>
      </div>
    `).join('');
  }

  function renderPlaybook(persona) {
    // Questions
    const questionList = document.getElementById('questionList');
    questionList.innerHTML = persona.questions.map((q, i) => `
      <div class="question-item">
        <span class="question-number">${i + 1}.</span> ${q}
      </div>
    `).join('');

    // Objections
    const objectionList = document.getElementById('objectionList');
    objectionList.innerHTML = persona.objections.map(obj => `
      <div class="objection-item">
        <div class="objection-trigger">
          <div class="objection-label">🔴 They Say</div>
          "${obj.trigger}"
        </div>
        <div class="objection-response">
          <div class="objection-label">🟢 You Say</div>
          ${obj.response}
        </div>
      </div>
    `).join('');
  }

  function renderBlueprint(persona) {
    const body = document.getElementById('blueprintBody');
    body.innerHTML = `
      <div class="blueprint-section">
        <div class="blueprint-section-title">Merchant Profile</div>
        <div class="blueprint-row"><span class="blueprint-label">Name</span><span class="blueprint-value">${persona.displayName}</span></div>
        <div class="blueprint-row"><span class="blueprint-label">Business</span><span class="blueprint-value">${persona.business.split('—')[0].trim()}</span></div>
        <div class="blueprint-row"><span class="blueprint-label">Location</span><span class="blueprint-value">${persona.location}</span></div>
        <div class="blueprint-row"><span class="blueprint-label">Style</span><span class="blueprint-value">${persona.style}</span></div>
        <div class="blueprint-row"><span class="blueprint-label">Product</span><span class="blueprint-value">${persona.product}</span></div>
      </div>

      <div class="blueprint-champ-zone" data-zone="challenges">
        <span class="zone-tag">Challenges</span>
        <div class="blueprint-section-title" style="border:0;margin:0;padding:0;">Key Challenges</div>
        <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:4px;">${persona.champ.challenges.body}</div>
      </div>

      <div class="blueprint-champ-zone" data-zone="authority">
        <span class="zone-tag">Authority</span>
        <div class="blueprint-section-title" style="border:0;margin:0;padding:0;">Decision Authority</div>
        <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:4px;">${persona.champ.authority.body}</div>
      </div>

      <div class="blueprint-champ-zone" data-zone="money">
        <span class="zone-tag">Money</span>
        <div class="blueprint-section-title" style="border:0;margin:0;padding:0;">Budget & Financial Context</div>
        <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:4px;">${persona.champ.money.body}</div>
      </div>

      <div class="blueprint-champ-zone" data-zone="prioritization">
        <span class="zone-tag">Priority</span>
        <div class="blueprint-section-title" style="border:0;margin:0;padding:0;">Prioritization & Timeline</div>
        <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:4px;">${persona.champ.prioritization.body}</div>
      </div>
    `;
  }

  function renderQuiz() {
    const questions = DRILL_QUESTIONS[state.personaId];
    if (!questions) return;

    const container = document.getElementById('quizContainer');
    container.innerHTML = questions.map((q, qIdx) => `
      <div class="quiz-question" id="quiz-q-${qIdx}">
        <div class="quiz-q-number">Question ${qIdx + 1} of ${questions.length}</div>
        <div class="quiz-q-text">${q.question}</div>
        <div class="quiz-options">
          ${q.options.map((opt, oIdx) => `
            <div class="quiz-option" data-question="${qIdx}" data-option="${oIdx}" onclick="window.__handleQuizClick(${qIdx}, ${oIdx})">
              <span class="radio"></span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
        <div class="quiz-feedback" id="feedback-${qIdx}"></div>
      </div>
    `).join('');
  }

  // ─── INTERACTIONS ───

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  function setupChampSelector() {
    document.querySelectorAll('.champ-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const champ = btn.dataset.champ;
        const wasActive = btn.classList.contains('active');

        // Toggle off all
        document.querySelectorAll('.champ-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.champ-detail').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.blueprint-champ-zone').forEach(z => z.classList.remove('glow'));

        if (!wasActive) {
          btn.classList.add('active');
          const detail = document.querySelector(`.champ-detail[data-champ-detail="${champ}"]`);
          if (detail) detail.classList.add('active');
          const zone = document.querySelector(`.blueprint-champ-zone[data-zone="${champ}"]`);
          if (zone) {
            zone.classList.add('glow');
            zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  }

  // Quiz click handler (global for inline onclick)
  window.__handleQuizClick = function (qIdx, oIdx) {
    if (state.answered.has(qIdx)) return;

    const questions = DRILL_QUESTIONS[state.personaId];
    const question = questions[qIdx];
    const selectedOpt = question.options[oIdx];
    const isCorrect = selectedOpt === question.answer;

    // Lock all options for this question
    const options = document.querySelectorAll(`.quiz-option[data-question="${qIdx}"]`);
    options.forEach(opt => opt.classList.add('locked'));

    // Mark selected
    const selectedEl = document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${oIdx}"]`);

    if (isCorrect) {
      selectedEl.classList.add('correct');
      state.correctCount++;
      state.answered.add(qIdx);
      showFeedback(qIdx, true, 'Correct! You\'re locked in on this detail.');
    } else {
      selectedEl.classList.add('incorrect');
      // Show correct answer
      const correctIdx = question.options.indexOf(question.answer);
      document.querySelector(`.quiz-option[data-question="${qIdx}"][data-option="${correctIdx}"]`).classList.add('correct');
      state.answered.add(qIdx);
      showFeedback(qIdx, false, `Not quite. The correct answer is: ${question.answer}`);
    }

    updateProgress();
  };

  function showFeedback(qIdx, success, message) {
    const fb = document.getElementById(`feedback-${qIdx}`);
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
    document.getElementById('statusIcon').textContent = '✅';
    document.getElementById('statusText').textContent = 'All drills passed — ready to proceed!';

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
      showSuccess();
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
