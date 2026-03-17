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

    // Verdict text (H4: includes text label, not color-only)
    const verdictEl = document.getElementById('score-verdict');
    const verdictMap = {
      pass: 'Great Job!',
      needs_work: 'Needs Improvement',
      fail: 'Keep Practicing',
    };
    verdictEl.textContent = verdictMap[scorecard.overall_verdict] || 'Reviewed';

    // Coaching tip
    document.getElementById('score-coaching-tip').textContent =
      scorecard.coaching_tip || '';

    // Category breakdown
    this.renderCategories(scorecard.categories || {});

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

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  },

  /**
   * Animate the score ring to the target value.
   */
  animateScoreRing(score, verdict) {
    const circumference = SCORE_RING_CIRCUMFERENCE;
    const offset = circumference - (score / 100) * circumference;

    const fillEl = document.getElementById('score-ring-fill');
    const numberEl = document.getElementById('score-number');

    // Set color using CSS custom property (not color-only - verdict text exists)
    if (verdict === 'fail') {
      fillEl.style.stroke = 'var(--red)';
    } else if (verdict === 'needs_work') {
      fillEl.style.stroke = 'var(--orange)';
    } else {
      fillEl.style.stroke = 'var(--green)';
    }

    // Animate after a brief delay
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
   * Render category score rows (H4: text labels alongside color bars).
   */
  renderCategories(categories) {
    const container = document.getElementById('score-categories');
    container.innerHTML = Object.entries(categories)
      .map(([name, data]) => {
        // M6 fix: explicit parentheses for ternary clarity
        const verdict = data.verdict || ((data.score >= 70) ? 'Strong' : ((data.score >= 50) ? 'Adequate' : 'Weak'));
        const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        // Bar color
        const barColor = (data.score >= 70) ? 'var(--green)' : ((data.score >= 50) ? 'var(--orange)' : 'var(--red)');
        return `
          <div class="category-row">
            <span class="category-name">${esc(displayName)}</span>
            <div class="category-bar-wrap">
              <div class="category-bar" style="width:0;background:${barColor}" data-target="${data.score}%"></div>
            </div>
            <span class="category-score">${data.score}/100 · ${esc(verdict)}</span>
          </div>`;
      })
      .join('');

    // Animate bars
    setTimeout(() => {
      container.querySelectorAll('.category-bar').forEach(bar => {
        bar.style.width = bar.dataset.target;
      });
    }, 200);
  },

  /**
   * Render coaching notes from the scenario JSON.
   */
  renderCoachingNotes(scenario) {
    const notes = scenario?.coaching_notes;
    const notesEl = document.getElementById('coaching-notes');

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
   * M10 fix: uses CSS classes instead of inline styles.
   */
  renderManualDebrief(callData, scenario) {
    const loadingEl = document.getElementById('debrief-loading');
    const contentEl = document.getElementById('debrief-content');

    // Show a simplified debrief without AI scoring
    document.getElementById('score-number').textContent = '—';
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
