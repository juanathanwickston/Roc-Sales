/**
 * Sales Call Simulator - Scoring Display
 * Renders scorecard and debrief UI from backend-processed results.
 * All scoring logic runs server-side via postCallProcessor.
 */

// SVG score ring circumference (2 * PI * 54)
const SCORE_RING_CIRCUMFERENCE = 339.29;

const scoring = {

  /**
   * Render the full AI-generated scorecard.
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
    const rubric = (scenario && scenario.rubric) ? scenario.rubric : {};
    const checklist = scorecard.checklist || {};
    this.renderCategories(scorecard.categories || {}, rubric, checklist);

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
    const color = (score >= 70) ? 'var(--green)' : ((score >= 50) ? 'var(--orange)' : 'var(--red)');
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
    const startTime = performance.now();
    const update = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      element.textContent = Math.round(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  /**
   * Render expandable category score rows with behavior details.
   * Collapsed by default. Clicking expands to show individual behaviors.
   */
  renderCategories(categories, rubric, checklist) {
    const container = document.getElementById('score-categories');
    container.innerHTML = Object.entries(categories)
      .map(([name, data]) => {
        const verdict = data.verdict || ((data.score >= 70) ? 'Strong' : ((data.score >= 50) ? 'Adequate' : 'Weak'));
        const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const barColor = (data.score >= 70) ? 'var(--green)' : ((data.score >= 50) ? 'var(--orange)' : 'var(--red)');
        const countText = (data.observed_count !== undefined && data.total_count !== undefined)
          ? ` (${data.observed_count}/${data.total_count})`
          : '';

        // Build behavior detail rows from rubric
        const rubricCat = rubric[name];
        let behaviorsHtml = '';
        if (rubricCat && rubricCat.behaviors && Object.keys(checklist).length > 0) {
          behaviorsHtml = rubricCat.behaviors.map(b => {
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
        }

        const hasBehaviors = behaviorsHtml.length > 0;
        const chevronSvg = '<svg class="category-chevron" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>';

        return `
          <div class="category-row">
            <div class="category-header"${hasBehaviors ? ' data-expandable="true"' : ''}>
              ${hasBehaviors ? chevronSvg : '<span style="width:16px"></span>'}
              <span class="category-name">${esc(displayName)}</span>
              <div class="category-bar-wrap">
                <div class="category-bar" style="width:0;background:${barColor}" data-target="${data.score}%"></div>
              </div>
              <span class="category-score">${data.score}/100${countText}</span>
            </div>
            ${hasBehaviors ? `<div class="category-behaviors">${behaviorsHtml}</div>` : ''}
          </div>`;
      })
      .join('');

    // Animate bars
    setTimeout(() => {
      container.querySelectorAll('.category-bar').forEach(bar => {
        bar.style.width = bar.dataset.target;
      });
    }, 200);

    // Event delegation for expandable category rows
    container.addEventListener('click', function(e) {
      var header = e.target.closest('[data-expandable]');
      if (header) {
        header.parentElement.classList.toggle('expanded');
      }
    });
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

    // Show a simplified debrief without AI scoring
    document.getElementById('score-number').textContent = '\u2014';
    document.getElementById('score-verdict').textContent = 'Self-Assessment Required';
    document.getElementById('score-coaching-tip').textContent =
      'AI scoring is unavailable for this call. Review the coaching notes below and rate your own performance.';

    // Clear categories with empty state
    document.getElementById('score-categories').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <div class="empty-title">Automated scoring unavailable</div>
        <div class="empty-desc">
          Complete a full call session for AI-powered feedback.
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
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  },
};
