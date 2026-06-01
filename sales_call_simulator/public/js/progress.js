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
    renderPerformanceSidebar(stagesData.stages, progressData);
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
    if (stage.id < currentStage) {
      stateClass = 'pipeline-done';
    } else if (stage.id === currentStage) {
      stateClass = 'pipeline-active';
    }

    html += '<div class="pipeline-step ' + stateClass + '">' +
      '<div class="pipeline-dot">' +
        '<span class="pipeline-number">' + String(stage.id).padStart(2, '0') + '</span>' +
      '</div>' +
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
        // Left
        '<div class="stage-card-left">' +
          '<div class="stage-card-number">' + String(stage.id).padStart(2, '0') + '</div>' +
          '<div class="stage-card-content-left">' +
            '<div class="stage-card-header">' +
              '<h3 class="stage-card-title">' + esc(stage.name) + '</h3>' +
              '<span class="stage-status-badge stage-status-active">Active</span>' +
            '</div>' +
            '<p class="stage-card-desc stage-card-desc-truncate">' + esc(stage.description) + '</p>' +
          '</div>' +
        '</div>' +
        // Right
        '<div class="stage-card-right">' +
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
        // Left
        '<div class="stage-card-left">' +
          '<div class="stage-card-number stage-number-locked">' + String(stage.id).padStart(2, '0') + '</div>' +
          '<div class="stage-card-content-left">' +
            '<div class="stage-card-header">' +
              '<h3 class="stage-card-title">' + esc(stage.name) + '</h3>' +
              '<span class="stage-status-badge stage-status-locked">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>' +
                ' Coming Soon' +
              '</span>' +
            '</div>' +
            '<p class="stage-card-desc stage-card-desc-truncate">' + esc(stage.description) + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
  }

  container.innerHTML = html;
}

/**
 * Render the performance sidebar: score ring, stat cards, trend chart, skill bars.
 */
function renderPerformanceSidebar(stages, progress) {
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

  // Score ring (now representing Overall Mastery)
  var masteryScore = overall.masteryScore || 0;
  // We compare masteryScore to previousScore (assuming backend maps previous to something logical or just to show the delta concept)
  var delta = masteryScore - (overall.previousScore || 0);
  var deltaClass = delta > 0 ? 'delta-up' : (delta < 0 ? 'delta-down' : 'delta-same');
  var deltaText = delta > 0 ? ('+' + delta) : (delta === 0 ? '—' : String(delta));
  var ringColor = masteryScore >= 80 ? 'var(--color-pass)' : (masteryScore >= 50 ? 'var(--color-warning)' : 'var(--color-fail)');
  var circumference = 2 * Math.PI * 54; // r=54
  var offset = circumference - (masteryScore / 100) * circumference;

  html += '<div class="perf-score-ring">' +
    '<svg viewBox="0 0 120 120" width="80" height="80">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-light)" stroke-width="5"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + ringColor + '" stroke-width="5" ' +
        'stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(2) + '" ' +
        'stroke-dashoffset="' + offset.toFixed(2) + '" ' +
        'style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1.5s ease"/>' +
    '</svg>' +
    '<div class="perf-score-text">' +
      '<span class="perf-score-number">' + masteryScore + '</span>' +
      '<span class="perf-score-label">Mastery</span>' +
    '</div>' +
  '</div>' +
  (overall.previousScore > 0 ? '<div class="perf-delta ' + deltaClass + '">' + deltaText + ' from last</div>' : '');

  // Stat cards (2x2 grid)
  var completed = overall.completedStages || 0;
  var focusArea = overall.weakestStage || 'None';
  
  html += '<div class="perf-stats-grid">' +
    '<div class="perf-stat"><div class="perf-stat-value">' + completed + '/6</div><div class="perf-stat-label">Pipeline</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value" style="font-size:16px;">' + esc(focusArea) + '</div><div class="perf-stat-label">Focus Area</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + streaks.currentStreak + '</div><div class="perf-stat-label">Sessions</div></div>' +
    '<div class="perf-stat"><div class="perf-stat-value">' + streaks.consecutivePasses + '</div><div class="perf-stat-label">Pass Streak</div></div>' +
  '</div>';

  // Stage Mastery chart (SVG)
  html += '<div class="perf-chart-card">' +
    '<div class="perf-chart-title">Stage Mastery</div>' +
    '<div class="perf-chart-container" id="mastery-chart-container"></div>' +
  '</div>';

  // Skill bars - The "Focus 3" Logic
  html += '<div class="perf-skills-card">' +
    '<div class="perf-skills-title" style="text-transform: uppercase;">Focus Areas</div>';

  var catEntries = Object.entries(categories);

  if (catEntries.length === 0) {
    // Empty state when no real data exists to prevent vanishing layout
    html += '<div class="perf-empty" style="margin-top: 10px; padding: 16px; background: #F7F8FA; border-radius: var(--rs); text-align: center; border: 1px dashed rgba(0,0,0,0.08);">' +
      '<p style="font-size: 11px; color: var(--text-muted); margin: 0;">Complete a practice call to reveal focus areas.</p>' +
    '</div>';
  } else {
    // Sort descending by latest score to map global extremes
    var sortedSkills = catEntries.sort(function(a, b) {
      return b[1].latest - a[1].latest;
    });

    // Inline render helper
    function renderSkillRow(entry, prefixLabel) {
      var catName = entry[0];
      var catData = entry[1];
      var displayName = catName.replace(/_/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
      var safeName = esc(displayName);
      
      if (prefixLabel) safeName = '<span style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-right:6px;">' + prefixLabel + '</span> ' + safeName;

      var barColor = catData.latest >= 80 ? 'var(--color-pass)' : (catData.latest >= 60 ? 'var(--color-warning)' : 'var(--color-fail)');

      var trendArrow = '';
      if (catData.trend && catData.trend.length >= 2) {
        var prev = catData.trend[catData.trend.length - 2];
        var curr = catData.trend[catData.trend.length - 1];
        if (curr > prev) trendArrow = '<span class="skill-trend skill-trend-up">▲</span>';
        else if (curr < prev) trendArrow = '<span class="skill-trend skill-trend-down">▼</span>';
        else trendArrow = '<span class="skill-trend skill-trend-same">—</span>';
      }

      return '<div class="perf-skill-row" style="margin-bottom: 8px;">' +
        '<div class="perf-skill-name">' + safeName + '</div>' +
        '<div class="perf-skill-bar-wrap">' +
          '<div class="perf-skill-bar" style="width:0;background:' + barColor + '" data-target="' + catData.latest + '%"></div>' +
        '</div>' +
        '<div class="perf-skill-score">' + catData.latest + '%' + trendArrow + '</div>' +
      '</div>';
    }

    // Focus Areas (Bottom 3 Skills)
    var focusSkills = sortedSkills.slice(-3).reverse();

    if (focusSkills.length > 0) {
      for (var f = 0; f < focusSkills.length; f++) {
        html += renderSkillRow(focusSkills[f]);
      }
    }
  }

  html += '</div>';

  sidebar.innerHTML = html;

  // Animate skill bars
  setTimeout(function() {
    sidebar.querySelectorAll('.perf-skill-bar').forEach(function(bar) {
      bar.style.width = bar.dataset.target;
    });
  }, 200);

  // Render SVG mastery chart after DOM is ready
  setTimeout(function() {
    renderStageMasteryChart(stages, progress.perScenario || {});
  }, 100);
}

/**
 * Render SVG 6-bar chart for Stage Mastery.
 * Uses exact text overlays instead of Y-axis grids.
 */
function renderStageMasteryChart(stages, perScenario) {
  var container = document.getElementById('mastery-chart-container');
  if (!container) return;

  var width = container.offsetWidth || 300;
  var height = 150;
  var padding = { top: 28, right: 10, bottom: 24, left: 10 };
  var chartWidth = width - padding.left - padding.right;
  var chartHeight = height - padding.top - padding.bottom;

  var n = stages.length; // Always 6
  var barWidth = Math.min(24, Math.floor(chartWidth / n) - 8);

  var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">';

  // Pass threshold line
  var thresholdY = padding.top + chartHeight - (80 / 100) * chartHeight;
  svg += '<line x1="' + padding.left + '" y1="' + thresholdY + '" x2="' + (width - padding.right) + '" y2="' + thresholdY + '" stroke="var(--color-pass)" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6"/>';

  for (var i = 0; i < n; i++) {
    var stage = stages[i];
    var sBest = (stage.scenarioId && perScenario[stage.scenarioId]) ? perScenario[stage.scenarioId].bestScore : null;
    var cx = padding.left + (i + 0.5) * (chartWidth / n);
    var bx = cx - (barWidth / 2);

    // X-axis label (S1, S2, etc)
    svg += '<text x="' + cx + '" y="' + (height - 4) + '" fill="var(--text-muted)" font-size="10" text-anchor="middle">S' + stage.id + '</text>';

    if (sBest !== null && sBest > 0) {
      var bHeight = (sBest / 100) * chartHeight;
      // Ensure a minimum height so small scores are visible
      bHeight = Math.max(bHeight, 4); 
      var by = padding.top + chartHeight - bHeight;
      var fillColor = sBest >= 80 ? 'var(--payroc-teal)' : 'var(--payroc-blue)';
      
      // Bar
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + barWidth + '" height="' + bHeight + '" fill="' + fillColor + '" rx="2" ry="2"/>';
      
      // Number explicitly on top of bar
      svg += '<text x="' + cx + '" y="' + (by - 6) + '" fill="var(--text-primary)" font-size="11" font-weight="600" text-anchor="middle">' + sBest + '</text>';
    } else {
      // Unattempted empty dashed column
      var emptyPath = 'M' + bx + ',' + (padding.top + chartHeight) + 
                      ' L' + bx + ',' + padding.top + 
                      ' A2,2 0 0,1 ' + (bx+2) + ',' + (padding.top-2) + 
                      ' L' + (bx+barWidth-2) + ',' + (padding.top-2) + 
                      ' A2,2 0 0,1 ' + (bx+barWidth) + ',' + padding.top + 
                      ' L' + (bx+barWidth) + ',' + (padding.top + chartHeight);
      svg += '<path d="' + emptyPath + '" fill="none" stroke="var(--border-light)" stroke-width="1.5" stroke-dasharray="4,4"/>';
    }
  }

  svg += '</svg>';
  container.innerHTML = svg;
}
