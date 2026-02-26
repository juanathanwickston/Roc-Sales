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
      container.innerHTML = `<div class="lb-error"><div style="font-size:1.5rem;margin-bottom:8px">⚠️</div>${esc(err.message)}<br><button class="nb pr show" style="margin-top:12px;font-size:.8rem" onclick="Leaderboard.render(this.parentElement.parentElement)">Retry</button></div>`;
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

    const maxScore = leaderboard.reduce((max, e) => Math.max(max, e.powerScore), 0);

    if (leaderboard.length === 0 || maxScore === 0) {
      h += '<div class="lb-empty" style="text-align:center;padding:48px 24px">';
      h += '<div style="font-size:2.5rem;margin-bottom:16px">🚀</div>';
      h += '<div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;color:var(--cyan,#00f0ff)">No Scores Yet</div>';
      h += '<div style="font-size:.9rem;color:var(--gray,#94a3b8);line-height:1.6">Complete modules to start earning Power Score.<br>Watch videos, read docs, play games, and finish checklists to climb the ranks.</div>';
      h += '</div>';
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
