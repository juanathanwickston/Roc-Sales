/* facilitator.js — Facilitator Dashboard */
'use strict';

var facilitator = {

  refreshInterval: null,

  /**
   * Initialize the facilitator dashboard.
   */
  init: function() {
    this.loadDashboard();
    // Auto-refresh every 60 seconds
    this.refreshInterval = setInterval(this.loadDashboard.bind(this), 60000);
  },

  /**
   * Clean up on exit.
   */
  destroy: function() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  },

  /**
   * Fetch and render the dashboard.
   */
  loadDashboard: function() {
    var container = document.getElementById('facilitator-content');
    if (!container) return;

    fetchWithAuth('/api/admin/dashboard')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(function(result) {
        var data = result.data || result;
        facilitator.renderDashboard(container, data);
      })
      .catch(function(err) {
        console.error('[Facilitator] Dashboard error:', err);
        container.innerHTML = '<div class="facilitator-error">Unable to load dashboard. Please try again.</div>';
      });
  },

  /**
   * Render the full dashboard.
   */
  renderDashboard: function(container, data) {
    var users = data.users || [];
    var summary = data.summary || {};
    var masteries = data.masteries || [];

    // Build mastery lookup: userId -> { module1: bool, module2: bool }
    var masteryMap = {};
    for (var m = 0; m < masteries.length; m++) {
      var entry = masteries[m];
      if (!masteryMap[entry.user_id]) masteryMap[entry.user_id] = {};
      masteryMap[entry.user_id][entry.module_id] = entry.mastered;
    }

    // Summary stats
    var html = '<div class="facilitator-summary">' +
      '<div class="facilitator-stat"><div class="facilitator-stat-value">' + (summary.totalUsers || 0) + '</div><div class="facilitator-stat-label">Active Reps</div></div>' +
      '<div class="facilitator-stat"><div class="facilitator-stat-value">' + (summary.totalSessions || 0) + '</div><div class="facilitator-stat-label">Total Sessions</div></div>' +
      '<div class="facilitator-stat"><div class="facilitator-stat-value">' + this.calcAvgScore(users) + '</div><div class="facilitator-stat-label">Avg Best Score</div></div>' +
      '<div class="facilitator-stat"><div class="facilitator-stat-value">' + this.countMastered(masteries) + '</div><div class="facilitator-stat-label">Modules Mastered</div></div>' +
    '</div>';

    // Rep table
    html += '<div class="facilitator-table-wrap">' +
      '<table class="facilitator-table">' +
      '<thead><tr>' +
        '<th>Rep</th>' +
        '<th>Module 1</th>' +
        '<th>Module 2</th>' +
        '<th>Attempts</th>' +
        '<th>Best Score</th>' +
        '<th>Avg Score</th>' +
      '</tr></thead><tbody>';

    if (users.length === 0) {
      html += '<tr><td colspan="6" class="facilitator-empty">No rep activity yet</td></tr>';
    } else {
      // Group by user
      var userMap = {};
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (!userMap[u.user_id]) {
          userMap[u.user_id] = { attempts: 0, bestScore: 0, totalScore: 0, scoreCount: 0 };
        }
        userMap[u.user_id].attempts += (u.attempts || 0);
        if (u.best_score > userMap[u.user_id].bestScore) userMap[u.user_id].bestScore = u.best_score;
        if (u.avg_score > 0) {
          userMap[u.user_id].totalScore += u.avg_score;
          userMap[u.user_id].scoreCount++;
        }
      }

      var userIds = Object.keys(userMap).sort();
      for (var j = 0; j < userIds.length; j++) {
        var uid = userIds[j];
        var ud = userMap[uid];
        var um = masteryMap[uid] || {};
        var avgScore = ud.scoreCount > 0 ? Math.round(ud.totalScore / ud.scoreCount) : 0;

        html += '<tr>' +
          '<td class="facilitator-rep-name">' + this.escHtml(this.formatName(uid)) + '</td>' +
          '<td>' + this.statusBadge(um.module1) + '</td>' +
          '<td>' + this.statusBadge(um.module2) + '</td>' +
          '<td>' + ud.attempts + '</td>' +
          '<td>' + (ud.bestScore > 0 ? ud.bestScore : '—') + '</td>' +
          '<td>' + (avgScore > 0 ? avgScore : '—') + '</td>' +
        '</tr>';
      }
    }

    html += '</tbody></table></div>';

    // Last updated
    html += '<div class="facilitator-updated">Last updated: ' + new Date().toLocaleTimeString() + ' (auto-refreshes every 60s)</div>';

    container.innerHTML = html;
  },

  statusBadge: function(mastered) {
    if (mastered) return '<span class="facilitator-badge facilitator-badge-pass">Mastered</span>';
    return '<span class="facilitator-badge facilitator-badge-pending">In Progress</span>';
  },

  formatName: function(userId) {
    return userId.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  },

  escHtml: function(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  calcAvgScore: function(users) {
    var total = 0;
    var count = 0;
    for (var i = 0; i < users.length; i++) {
      if (users[i].best_score > 0) {
        total += users[i].best_score;
        count++;
      }
    }
    return count > 0 ? Math.round(total / count) : '—';
  },

  countMastered: function(masteries) {
    var count = 0;
    for (var i = 0; i < masteries.length; i++) {
      if (masteries[i].mastered) count++;
    }
    return count;
  }
};
