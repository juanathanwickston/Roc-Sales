/**
 * Sales Call Simulator - Scoring Display
 * Renders scorecard and debrief UI from backend-processed results.
 * All scoring logic runs server-side via postCallProcessor.
 */

// SVG score ring circumference (2 * PI * 54)
const SCORE_RING_CIRCUMFERENCE = 339.29;

// C7 fix: Store click handler reference to avoid listener accumulation
let _categoriesClickHandler = null;

// H5 fix: Store rAF ID to cancel on navigation
let _countUpRAF = null;

const scoring = {

  /**
   * Render the full scorecard.
   */
  renderScorecard(scorecard, scenario) {
    const loadingEl = document.getElementById('debrief-loading');
    const contentEl = document.getElementById('debrief-content');

    // Overall score ring
    const score = scorecard.overall_score || 0;
    this.animateScoreRing(score, scorecard.overall_verdict);

    // Verdict text
    const verdictEl = document.getElementById('score-verdict');
    const verdictMap = {
      pass: 'Great Job',
      needs_work: 'Needs Improvement',
      fail: 'Keep Practicing',
    };
    verdictEl.textContent = verdictMap[scorecard.overall_verdict] || 'Reviewed';

    // Coaching tip
    document.getElementById('score-coaching-tip').textContent =
      scorecard.coaching_tip || '';

    // Category breakdown (pass rubric for expandable details)
    const rubric = scenario?.rubric ?? {};
    const checklist = scorecard.checklist || {};
    const rubricType = scorecard.rubric_type || scenario?.rubric_type || 'binary';
    this.renderCategories(scorecard.categories || {}, rubric, checklist, rubricType);

    // Strengths
    const strengthsEl = document.getElementById('score-strengths');
    strengthsEl.innerHTML = (scorecard.top_strengths || [])
      .map(s => `<li>${esc(s)}</li>`)
      .join('');

    // Improvements
    const improvEl = document.getElementById('score-improvements');
    improvEl.innerHTML = (scorecard.critical_improvements || [])
      .map(s => `<li>${esc(s)}</li>`)
      .join('');

    // Coaching notes from scenario
    this.renderCoachingNotes(scenario);

    // Show content and ensure tabs are visible
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    
    const tabsEl = document.getElementById('debrief-tabs');
    if (tabsEl) tabsEl.style.display = 'flex';
  },

  /**
   * Animate the score ring to the target value.
   */
  animateScoreRing(score, verdict) {
    const fillEl = document.getElementById('score-ring-fill');
    const numberEl = document.getElementById('score-number');

    // Color based on score
    const color = (score >= window.SCORE_PASS_THRESHOLD) ? 'var(--green)' : ((score >= window.SCORE_WARNING_THRESHOLD) ? 'var(--orange)' : 'var(--red)');
    fillEl.style.stroke = color;

    // Calculate offset for ring
    const offset = SCORE_RING_CIRCUMFERENCE - (score / 100) * SCORE_RING_CIRCUMFERENCE;

    setTimeout(() => {
      fillEl.style.strokeDashoffset = offset;
    }, 100);

    // Count up the number
    this.countUp(numberEl, 0, score, 1200);
  },

  /**
   * Count up animation for score number.
   */
  countUp(element, start, end, duration) {
    // H5 fix: Cancel any existing rAF loop before starting a new one
    if (_countUpRAF) {
      cancelAnimationFrame(_countUpRAF);
      _countUpRAF = null;
    }

    const startTime = performance.now();
    const update = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      element.textContent = Math.round(start + (end - start) * eased);
      if (progress < 1) {
        _countUpRAF = requestAnimationFrame(update);
      } else {
        _countUpRAF = null;
      }
    };
    _countUpRAF = requestAnimationFrame(update);
  },

  /**
   * Render expandable category score rows with behavior details.
   * Collapsed by default. Clicking expands to show individual behaviors.
   */
  renderCategories(categories, rubric, checklist, rubricType) {
    const container = document.getElementById('score-categories');
    const isThreeTier = rubricType === 'three_tier';

    container.innerHTML = Object.entries(categories)
      .map(([name, data]) => {
        const displayName = data.display_name || formatCategoryName(name);
        const barColor = (data.score >= window.SCORE_PASS_THRESHOLD) ? 'var(--green)' : ((data.score >= window.SCORE_WARNING_THRESHOLD) ? 'var(--orange)' : 'var(--red)');
        const chevronSvg = '<svg class="category-chevron" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>';

        let detailsHtml = '';

        if (isThreeTier && data.tiers) {
          // 3-tier rendering: show all three tiers with the graded one highlighted
          const grade = data.grade || 'not_met';
          const gradeColors = { met: 'var(--green)', partially_met: 'var(--orange)', not_met: 'var(--red)' };
          const gradeLabels = { met: 'Met', partially_met: 'Partially Met', not_met: 'Not Met' };

          let tiersHtml = Object.entries(data.tiers).map(([tierKey, tierData]) => {
            const isActive = tierKey === grade;
            const activeClass = isActive ? 'tier-active' : 'tier-inactive';
            const tierColor = gradeColors[tierKey] || 'var(--text-muted)';
            return `<div class="tier-row ${activeClass}" style="${isActive ? `border-left: 3px solid ${tierColor}; background: ${tierColor}10;` : 'border-left: 3px solid transparent; opacity: 0.5;'}">
              <div class="tier-label" style="${isActive ? `color: ${tierColor}; font-weight: 600;` : ''}">${esc(tierData.label)} (${tierData.points} pt${tierData.points !== 1 ? 's' : ''})</div>
              <div class="tier-criteria">${esc(tierData.criteria)}</div>
            </div>`;
          }).join('');

          // Evidence and rationale
          const evidenceHtml = data.evidence
            ? `<div class="three-tier-evidence"><strong>Evidence:</strong> "${esc(data.evidence)}"</div>`
            : '';
          const rationaleHtml = data.rationale
            ? `<div class="three-tier-rationale"><strong>Rationale:</strong> ${esc(data.rationale)}</div>`
            : '';

          detailsHtml = `<div class="category-behaviors">
            <div class="grade-badge" style="background: ${gradeColors[grade]}20; color: ${gradeColors[grade]}; border: 1px solid ${gradeColors[grade]}40;">
              ${esc(gradeLabels[grade])} (${data.earned}/${data.possible} pts)
            </div>
            ${tiersHtml}
            ${evidenceHtml}
            ${rationaleHtml}
          </div>`;

        } else if (rubric[name] && rubric[name].behaviors && Object.keys(checklist).length > 0) {
          // Legacy binary rendering
          const behaviorsHtml = rubric[name].behaviors.map(b => {
            const result = checklist[b.id];
            const observed = result && result.observed === true;
            const statusClass = observed ? 'observed' : 'missed';
            const statusIcon = observed ? '&#10003;' : '&#10005;';
            const evidenceText = (observed && result.evidence && result.evidence !== 'NOT OBSERVED')
              ? `<div class="behavior-evidence">"${esc(result.evidence)}"</div>`
              : '';
            return `<div class="behavior-item">
              <div class="behavior-status ${statusClass}">${statusIcon}</div>
              <div>
                <div class="behavior-desc">${esc(b.description)}</div>
                ${evidenceText}
              </div>
            </div>`;
          }).join('');
          detailsHtml = `<div class="category-behaviors">${behaviorsHtml}</div>`;
        }

        const hasDetails = detailsHtml.length > 0;
        const scoreText = isThreeTier ? `${data.earned}/${data.possible}` : `${data.score}/100`;

        return `
          <div class="category-row">
            <div class="category-header"${hasDetails ? ' data-expandable="true"' : ''}>
              ${hasDetails ? chevronSvg : '<span style="width:16px"></span>'}
              <span class="category-name">${esc(displayName)}</span>
              <div class="category-bar-wrap">
                <div class="category-bar" style="width:0;background:${barColor}" data-target="${data.score}%"></div>
              </div>
              <span class="category-score">${scoreText}</span>
            </div>
            ${detailsHtml}
          </div>`;
      })
      .join('');

    // Animate bars
    setTimeout(() => {
      container.querySelectorAll('.category-bar').forEach(bar => {
        bar.style.width = bar.dataset.target;
      });
    }, 200);

    // C7 fix: Remove previous listener before adding a new one to prevent accumulation
    if (_categoriesClickHandler) {
      container.removeEventListener('click', _categoriesClickHandler);
    }
    _categoriesClickHandler = function(e) {
      const header = e.target.closest('[data-expandable]');
      if (header) {
        header.parentElement.classList.toggle('expanded');
      }
    };
    container.addEventListener('click', _categoriesClickHandler);
  },

  /**
   * Render coaching notes from the scenario JSON.
   */
  renderCoachingNotes(scenario) {
    const notes = scenario?.coaching_notes;
    const notesEl = document.getElementById('coaching-notes');

    if (!notesEl) return;

    if (!notes) {
      notesEl.style.display = 'none';
      return;
    }

    const conceptsEl = document.getElementById('coaching-concepts');
    const mistakesEl = document.getElementById('coaching-mistakes');

    if (notes.key_concepts) {
      conceptsEl.innerHTML = notes.key_concepts
        .map(c => `<li>${esc(c)}</li>`)
        .join('');
    }
    if (notes.common_mistakes) {
      mistakesEl.innerHTML = notes.common_mistakes
        .map(m => `<li>${esc(m)}</li>`)
        .join('');
    }

    notesEl.style.display = 'block';
  },

  /**
   * Render a manual debrief when scoring is unavailable.
   */
  renderManualDebrief(callData, scenario) {
    const loadingEl = document.getElementById('debrief-loading');
    const contentEl = document.getElementById('debrief-content');

    // Show a simplified debrief without automated scoring
    document.getElementById('score-number').textContent = '\u2014';
    document.getElementById('score-verdict').textContent = 'Self-Assessment Required';
    document.getElementById('score-coaching-tip').textContent =
      'Automated scoring is unavailable for this call. Review the coaching notes below and rate your own performance.';

    // Clear categories with empty state
    document.getElementById('score-categories').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <div class="empty-title">Automated scoring unavailable</div>
        <div class="empty-desc">
          Complete a full call session for detailed feedback.
          Call duration: ${this.formatDuration(callData.duration || 0)}
        </div>
      </div>`;
    document.getElementById('score-strengths').innerHTML = '';
    document.getElementById('score-improvements').innerHTML = '';

    // Show coaching notes
    this.renderCoachingNotes(scenario);

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  },

  /**
   * Format seconds to mm:ss.
   */
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}m ${secs}s`;
  },
};
