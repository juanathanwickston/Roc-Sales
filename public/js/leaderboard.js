/**
 * Leaderboard UI for ROC Academy.
 * Renders ranked list with podium top 3, user highlight, and time filter tabs.
 */

const Leaderboard = {
  currentPeriod: 'all',

  /**
   * Render the leaderboard screen.
   */
  async render(container) {
    container.innerHTML = '<div class="lb-loading">Loading leaderboard...</div>';

    try {
      const data = await API.getLeaderboard(this.currentPeriod);
      container.innerHTML = this.buildHTML(data);
    } catch (err) {
      container.innerHTML = `<div class="lb-error">${err.message}</div>`;
    }
  },

  buildHTML(data) {
    const { leaderboard, myRank, totalReps } = data;
    let h = '';

    // Period tabs
    h += '<div class="lb-tabs">';
    ['week', 'month', 'all'].forEach(p => {
      const label = p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time';
      const active = this.currentPeriod === p ? ' active' : '';
      h += `<button class="lb-tab${active}" onclick="Leaderboard.switchPeriod('${p}')">${label}</button>`;
    });
    h += '</div>';

    if (leaderboard.length === 0) {
      h += '<div class="lb-empty">No scores yet. Start training to appear on the leaderboard.</div>';
      return h;
    }

    // Podium (top 3)
    if (leaderboard.length >= 3) {
      h += '<div class="lb-podium">';
      const positions = [1, 0, 2]; // Display order: 2nd, 1st, 3rd
      positions.forEach(i => {
        const entry = leaderboard[i];
        if (!entry) return;
        const place = i + 1;
        const isMe = entry.id === (Auth.user ? Auth.user.id : null);
        h += `<div class="lb-pod lb-pod-${place}${isMe ? ' lb-me' : ''}">`;
        h += `<div class="lb-pod-rank">${place}</div>`;
        h += `<div class="lb-pod-avatar">${esc(entry.firstName)[0]}${esc(entry.lastName)[0]}</div>`;
        h += `<div class="lb-pod-name">${esc(entry.firstName)} ${esc(entry.lastName)}</div>`;
        if (entry.nickname) h += `<div class="lb-pod-nick">${esc(entry.nickname)}</div>`;
        h += `<div class="lb-pod-score">${entry.powerScore}</div>`;
        h += '</div>';
      });
      h += '</div>';
    }

    // Full ranked list
    h += '<div class="lb-list">';
    leaderboard.forEach(entry => {
      const isMe = entry.id === (Auth.user ? Auth.user.id : null);
      h += `<div class="lb-row${isMe ? ' lb-me' : ''}">`;
      h += `<div class="lb-rank">${entry.rank}</div>`;
      h += `<div class="lb-avatar">${esc(entry.firstName)[0]}${esc(entry.lastName)[0]}</div>`;
      h += '<div class="lb-info">';
      h += `<div class="lb-name">${esc(entry.displayName)}</div>`;
      h += '</div>';
      h += `<div class="lb-score">${entry.powerScore}</div>`;
      h += '</div>';
    });
    h += '</div>';

    // My rank summary
    if (myRank) {
      h += `<div class="lb-my-rank">Your Rank: ${myRank} of ${totalReps}</div>`;
    }

    return h;
  },

  async switchPeriod(period) {
    this.currentPeriod = period;
    const container = document.getElementById('leaderboardBody');
    if (container) await this.render(container);
  }
};
