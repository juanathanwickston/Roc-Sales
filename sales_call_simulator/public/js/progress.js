/**
 * Progress Dashboard — Rendering Module
 * Renders the stage-based home screen: pipeline bar, stage cards, 
 * performance stats, SVG trend chart, and skill bars.
 * All data comes from GET /api/sessions/progress and GET /api/scenarios/stages.
 */

/* global esc, app */

/**
 * Load progress data from the server and render the dashboard.
 * Called from app.init() after scenarios are loaded.
 */
async function loadProgress() {
  try {
    const [progressRes, stagesRes] = await Promise.all([
      fetch('/api/sessions/progress'),
      fetch('/api/scenarios/stages'),
    ]);

    const progressData = await progressRes.json();
    const stagesData = await stagesRes.json();

    renderPipeline(stagesData.stages, progressData);
    renderStageCards(stagesData.stages, progressData);
    renderPerformanceSidebar(progressData);
  } catch (err) {
    console.error('[Progress] Failed to load progress:', err);
  }
}

/**
 * Render the horizontal pipeline bar showing all 6 stages.
 */
function renderPipeline(stages, progress) {
  var container = document.getElementById('pipeline-bar');
  if (!container) return;

  var currentStage = (progress && progress.overall) ? progress.overall.currentStage : 1;
  var html = '<div class="pipeline-track">';

  for (var i = 0; i < stages.length; i++) {
    var stage = stages[i];
    var stateClass = 'pipeline-locked';
    if (stage.available && stage.id <= currentStage) {
      stateClass = 'pipeline-active';
    } else if (stage.id < currentStage) {
      stateClass = 'pipeline-done';
    }

    html += '<div class="pipeline-step ' + stateClass + '">' +
      '<div class="pipeline-dot">' +
        '<span class="pipeline-number">' + String(stage.id).padStart(2, '0') + '</span>' +
      '</div>' +
      '<span class="pipeline-label">' + esc(stage.shortName) + '</span>' +
    '</div>';

    if (i < stages.length - 1) {
      html += '<div class="pipeline-connector ' + (stage.id < currentStage ? 'pipeline-connector-filled' : '') + '"></div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Render the stage cards in the journey column.
 */
function renderStageCards(stages, progress) {
  var container = document.getElementById('stage-cards');
  if (!container) return;

  var perScenario = (progress && progress.perScenario) ? progress.perScenario : {};

  var html = '';
  for (var i = 0; i < stages.length; i++) {
    var stage = stages[i];
    var scenarioStats = stage.scenarioId ? (perScenario[stage.scenarioId] || null) : null;

    if (stage.available) {
      // Active stage card
      html += '<div class="stage-card stage-card-active" data-stage-id="' + stage.id + '">' +
        '<div class="stage-card-number">' + String(stage.id).padStart(2, '0') + '</div>' +
        '<div class="stage-card-body">' +
          '<div class="stage-card-header">' +
            '<h3 class="stage-card-title">' + esc(stage.name) + '</h3>' +
            '<span class="stage-status-badge stage-status-active">Active</span>' +
          '</div>' +
          (stage.scenario ? '<p class="stage-card-scenario">' + esc(stage.scenario.name) + '</p>' : '') +
          '<p class="stage-card-desc">' + esc(stage.description) + '</p>' +
          '<div class="stage-card-footer">' +
            (stage.scenario && stage.scenario.durationMinutes ? '<span class="stage-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ' + stage.scenario.durationMinutes + ' min</span>' : '') +
            (scenarioStats ? '<span class="stage-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg> Best: ' + scenarioStats.bestScore + '/100</span>' : '') +
            (scenarioStats ? '<span class="stage-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14"/></svg> ' + scenarioStats.attempts + ' attempt' + (scenarioStats.attempts !== 1 ? 's' : '') + '</span>' : '') +
          '</div>' +
          '<button class="btn btn-primary stage-card-cta" data-scenario-id="' + esc(stage.scenarioId) + '" type="button">Practice Now</button>' +
        '</div>' +
      '</div>';
    } else {
      // Locked stage card
      html += '<div class="stage-card stage-card-locked">' +
        '<div class="stage-card-number stage-number-locked">' + String(stage.id).padStart(2, '0') + '</div>' +
        '<div class="stage-card-body">' +
          '<div class="stage-card-header">' +
            '<h3 class="stage-card-title">' + esc(stage.name) + '</h3>' +
            '<span class="stage-status-badge stage-status-locked">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>' +
              ' Coming Soon' +
            '</span>' +
          '</div>' +
          '<p class="stage-card-desc">' + esc(stage.description) + '</p>' +
        '</div>' +
      '</div>';
    }
  }

  container.innerHTML = html;
}

/**
 * Render the performance sidebar: score ring, stat cards, trend chart, skill bars.
 */
function renderPerformanceSidebar(progress) {
  var sidebar = document.getElementById('performance-sidebar');
  if (!sidebar) return;

  var overall = progress.overall || {};
  var categories = progress.categories || {};
  var streaks = progress.streaks || {};
  var hasSessions = overall.scoredAttempts > 0;

  if (!hasSessions) {
    sidebar.innerHTML = '<div class="perf-empty">' +
      '<div class="perf-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M12 20V10M18 20V4M6 20v-4"/></svg></div>' +
      '<p class="perf-empty-title">No progress yet</p>' +
      '<p class="perf-empty-desc">Complete your first practice call to start tracking your performance.</p>' +
    '</div>';
    return;
  }

  var html = '';

  // Score ring
  var latestScore = overall.latestScore || 0;
  var delta = overall.latestScore - overall.previousScore;
  var deltaClass = delta > 0 ? 'delta-up' : (delta < 0 ? 'delta-down' : 'delta-same');
  var deltaText = delta > 0 ? ('+' + delta) : (delta === 0 ? '—' : String(delta));
  var ringColor = latestScore >= 80 ? 'var(--color-pass)' : (latestScore >= 50 ? 'var(--color-warning)' : 'var(--color-fail)');
  var circumference = 2 * Math.PI * 54; // r=54
  var offset = circumference - (latestScore / 100) * circumference;

  html += '<div class="perf-score-ring">' +
    '<svg viewBox="0 0 120 120" width="100" height="100">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-light)" stroke-width="8"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + ringColor + '" stroke-width="8" ' +
        'stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(2) + '" ' +
        'stroke-dashoffset="' + offset.toFixed(2) + '" ' +
        'style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1.5s ease"/>' +
    '</svg>' +
    '<div class="perf-score-text">' +
      '<span class="perf-score-number">' + latestScore + '</span>' +
      '<span class="perf-score-label">Latest</span>' +
    '</div>' +
  '</div>' +
  (overall.previousScore > 0 ? '<div class="perf-delta ' + deltaClass + '">' + deltaText + ' from last</div>' : '');

  // Stat cards (2x2 grid)
  html += '<div class="perf-stats-grid">' +
    '<div class="perf-stat"><div class="perf-stat-value">' + overall.bestScore + '</div><div class="perf-stat-label">Best Score</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + overall.passRate + '%</div><div class="perf-stat-label">Pass Rate</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + streaks.currentStreak + '</div><div class="perf-stat-label">Sessions</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + streaks.consecutivePasses + '</div><div class="perf-stat-label">Pass Streak</div></div>' +
  '</div>';

  // Score trend chart (SVG)
  if (overall.trend && overall.trend.length >= 2) {
    html += '<div class="perf-chart-card">' +
      '<div class="perf-chart-title">Score Trend</div>' +
      '<div class="perf-chart-container" id="trend-chart-container"></div>' +
    '</div>';
  }

  // Skill bars
  var catEntries = Object.entries(categories);
  if (catEntries.length > 0) {
    html += '<div class="perf-skills-card">' +
      '<div class="perf-skills-title">Skills</div>';

    for (var c = 0; c < catEntries.length; c++) {
      var catName = catEntries[c][0];
      var catData = catEntries[c][1];
      var displayName = catName.replace(/_/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
      var barColor = catData.latest >= 70 ? 'var(--color-pass)' : (catData.latest >= 50 ? 'var(--color-warning)' : 'var(--color-fail)');
      var trendArrow = '';
      if (catData.trend && catData.trend.length >= 2) {
        var prev = catData.trend[catData.trend.length - 2];
        var curr = catData.trend[catData.trend.length - 1];
        if (curr > prev) trendArrow = '<span class="skill-trend skill-trend-up">▲</span>';
        else if (curr < prev) trendArrow = '<span class="skill-trend skill-trend-down">▼</span>';
        else trendArrow = '<span class="skill-trend skill-trend-same">—</span>';
      }

      html += '<div class="perf-skill-row">' +
        '<div class="perf-skill-name">' + esc(displayName) + '</div>' +
        '<div class="perf-skill-bar-wrap">' +
          '<div class="perf-skill-bar" style="width:0;background:' + barColor + '" data-target="' + catData.latest + '%"></div>' +
        '</div>' +
        '<div class="perf-skill-score">' + catData.latest + '%' + trendArrow + '</div>' +
      '</div>';
    }
    html += '</div>';
  }

  sidebar.innerHTML = html;

  // Animate skill bars
  setTimeout(function() {
    sidebar.querySelectorAll('.perf-skill-bar').forEach(function(bar) {
      bar.style.width = bar.dataset.target;
    });
  }, 200);

  // Render SVG trend chart after DOM is ready
  if (overall.trend && overall.trend.length >= 2) {
    setTimeout(function() {
      renderTrendChart(overall.trend);
    }, 100);
  }
}

/**
 * Render SVG line chart for score trend.
 * Uses the payroc.com chart style: teal line on white card with gradient fill.
 */
function renderTrendChart(trend) {
  var container = document.getElementById('trend-chart-container');
  if (!container) return;

  var width = container.offsetWidth || 300;
  var height = 140;
  var padding = { top: 16, right: 16, bottom: 24, left: 32 };
  var chartWidth = width - padding.left - padding.right;
  var chartHeight = height - padding.top - padding.bottom;

  // Scale
  var minScore = 0;
  var maxScore = 100;
  var n = trend.length;

  function x(i) { return padding.left + (i / (n - 1)) * chartWidth; }
  function y(score) { return padding.top + chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight; }

  // Build path
  var linePath = 'M' + x(0) + ',' + y(trend[0].score);
  for (var i = 1; i < n; i++) {
    linePath += ' L' + x(i) + ',' + y(trend[i].score);
  }

  // Fill path (area under the line)
  var fillPath = linePath + ' L' + x(n - 1) + ',' + (height - padding.bottom) + ' L' + x(0) + ',' + (height - padding.bottom) + ' Z';

  // Pass threshold line (y=80)
  var thresholdY = y(80);

  // Build SVG
  var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<defs>' +
      '<linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--payroc-teal)" stop-opacity="0.3"/>' +
        '<stop offset="100%" stop-color="var(--payroc-teal)" stop-opacity="0.02"/>' +
      '</linearGradient>' +
    '</defs>';

  // Y-axis labels
  for (var yVal = 0; yVal <= 100; yVal += 25) {
    var yPos = y(yVal);
    svg += '<line x1="' + padding.left + '" y1="' + yPos + '" x2="' + (width - padding.right) + '" y2="' + yPos + '" stroke="var(--border-light)" stroke-width="1" stroke-dasharray="4,4"/>';
    svg += '<text x="' + (padding.left - 8) + '" y="' + (yPos + 4) + '" fill="var(--text-muted)" font-size="10" text-anchor="end">' + yVal + '</text>';
  }

  // Pass threshold
  svg += '<line x1="' + padding.left + '" y1="' + thresholdY + '" x2="' + (width - padding.right) + '" y2="' + thresholdY + '" stroke="var(--color-pass)" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6"/>';
  svg += '<text x="' + (width - padding.right + 4) + '" y="' + (thresholdY + 4) + '" fill="var(--color-pass)" font-size="9" opacity="0.8">Pass</text>';

  // Area fill
  svg += '<path d="' + fillPath + '" fill="url(#trendFill)"/>';

  // Line
  svg += '<path d="' + linePath + '" fill="none" stroke="var(--payroc-teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';

  // Dots
  for (var j = 0; j < n; j++) {
    var dotColor = trend[j].score >= 80 ? 'var(--color-pass)' : 'var(--payroc-blue)';
    svg += '<circle cx="' + x(j) + '" cy="' + y(trend[j].score) + '" r="4" fill="var(--bg-card)" stroke="' + dotColor + '" stroke-width="2.5"/>';
  }

  svg += '</svg>';
  container.innerHTML = svg;
}
