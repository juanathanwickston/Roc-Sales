/**
 * Admin Panel UI for ROC Academy.
 * User management, team management, rep progress viewing.
 * Only accessible to manager and superuser roles.
 */

const Admin = {
  currentTab: 'users',
  showInactive: false,
  _editCache: null,
  _usersCache: null,
  _searchQuery: '',
  _filterRole: '',
  _filterTeam: '',
  _filterStatus: 'active',
  _sortCol: 'name',
  _sortDir: 'asc',

  /** Normalize a name to Title Case: "JOHN" → "John" */
  titleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Render the admin panel.
   */
  async render(container) {
    if (!Auth.hasRole('manager')) {
      container.innerHTML = '<div class="admin-denied">Access denied</div>';
      return;
    }

    // Tabs + toolbar on one row (heading from static HTML in index.html)
    let h = '<div class="admin-tabs">';
    h += `<button class="admin-tab${this.currentTab === 'users' ? ' active' : ''}" onclick="Admin.switchTab('users')">Users</button>`;
    h += `<button class="admin-tab${this.currentTab === 'teams' ? ' active' : ''}" onclick="Admin.switchTab('teams')">Teams</button>`;
    h += `<button class="admin-tab${this.currentTab === 'content' ? ' active' : ''}" onclick="Admin.switchTab('content')">Content</button>`;
    h += '<div style="flex:1"></div>';
    h += '<div class="admin-toolbar">';
    h += '<button class="admin-toolbar-btn" onclick="Admin.showExportMenu(this)" title="Export data">Export ▾</button>';
    if (Auth.hasRole('superuser')) {
      h += '<button class="admin-toolbar-btn danger" onclick="Admin.resetScores()" title="Reset all data">Reset</button>';
    }
    h += '</div>';
    h += '</div>';
    h += '<div id="adminContent"></div>';
    container.innerHTML = h;

    if (this.currentTab === 'users') {
      await this.renderUsers();
    } else if (this.currentTab === 'teams') {
      await this.renderTeams();
    } else if (this.currentTab === 'content') {
      await this.renderContent();
    }
  },

  showExportMenu(btn) {
    // Remove existing dropdown
    const existing = document.getElementById('exportDropdown');
    if (existing) { existing.remove(); return; }

    const dd = document.createElement('div');
    dd.id = 'exportDropdown';
    dd.className = 'admin-dropdown';
    dd.innerHTML = `
      <button onclick="Admin.exportCSV('leaderboard');Admin.closeDropdown()">📊 Leaderboard CSV</button>
      <button onclick="Admin.exportCSV('progress');Admin.closeDropdown()">📋 Progress CSV</button>`;
    btn.style.position = 'relative';
    btn.appendChild(dd);
    setTimeout(() => document.addEventListener('click', Admin.closeDropdown, { once: true }), 10);
  },

  closeDropdown() {
    const dd = document.getElementById('exportDropdown');
    if (dd) dd.remove();
  },

  async switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('adminBody');
    if (container) await this.render(container);
  },

  async exportCSV(type) {
    try {
      const res = await fetch(`/api/export/${type}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('roc_token')}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `roc_${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  },

  async resetScores() {
    if (!confirm('⚠️ This will permanently delete ALL scores, progress, and checklist data for ALL users. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Type OK to confirm.')) return;
    try {
      const res = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('roc_token')}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      alert('✅ ' + data.message);
      location.reload();
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  },

  // ─── USERS TAB ───

  async renderUsers() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading users...</div>';

    try {
      const data = await API.getUsers(true);
      const teamsData = await API.getTeams();
      this._usersCache = data.users;
      let h = '';

      // ── Summary Cards ──
      const total = data.users.length;
      const active = data.users.filter(u => u.isActive).length;
      const pendingPw = data.users.filter(u => u.mustChangePassword && u.isActive).length;
      const now = Date.now();
      const recentLogins = data.users.filter(u => u.lastLogin && (now - new Date(u.lastLogin).getTime()) < 7 * 86400000).length;

      h += '<div class="admin-stats">';
      h += `<div class="admin-stat"><div class="admin-stat-val">${total}</div><div class="admin-stat-label">Total Users</div></div>`;
      h += `<div class="admin-stat"><div class="admin-stat-val">${active}</div><div class="admin-stat-label">Active Users</div></div>`;
      h += `<div class="admin-stat"><div class="admin-stat-val">${pendingPw}</div><div class="admin-stat-label">Pending Reset</div></div>`;
      h += `<div class="admin-stat"><div class="admin-stat-val">${recentLogins}</div><div class="admin-stat-label">Recent Logins (7d)</div></div>`;
      h += '</div>';

      // ── Toolbar: Search + Filters + Create ──
      const teamOptions = teamsData.teams.map(t => `<option value="${t.id}"${this._filterTeam == t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
      h += '<div class="admin-toolbar-row">';
      h += `<input type="text" class="admin-search" id="adminSearch" placeholder="Search users..." value="${esc(this._searchQuery)}" autocomplete="one-time-code" oninput="Admin._searchQuery=this.value;Admin.filterAndRenderTable()">`;
      h += `<select class="admin-filter" onchange="Admin._filterRole=this.value;Admin.filterAndRenderTable()"><option value="">All Roles</option><option value="rep"${this._filterRole==='rep'?' selected':''}>Rep</option><option value="manager"${this._filterRole==='manager'?' selected':''}>Manager</option><option value="superuser"${this._filterRole==='superuser'?' selected':''}>Superuser</option></select>`;
      h += `<select class="admin-filter" onchange="Admin._filterTeam=this.value;Admin.filterAndRenderTable()"><option value="">All Teams</option>${teamOptions}</select>`;
      h += `<select class="admin-filter" onchange="Admin._filterStatus=this.value;Admin.filterAndRenderTable()"><option value="active"${this._filterStatus==='active'?' selected':''}>Active</option><option value="inactive"${this._filterStatus==='inactive'?' selected':''}>Inactive</option><option value=""${this._filterStatus===''?' selected':''}>All</option></select>`;
      h += '<div style="flex:1"></div>';
      h += '<button class="admin-action-btn" onclick="Admin.showCreateUser()">+ Create User</button>';
      h += '</div>';

      // ── Table ──
      h += '<div id="adminTableWrap"></div>';

      content.innerHTML = h;
      // Defeat browser autofill — force empty if no active search
      if (!this._searchQuery) { const el = document.getElementById('adminSearch'); if (el) el.value = ''; }
      this.filterAndRenderTable();
    } catch (err) {
      content.innerHTML = `<div class="admin-error">${err.message}</div>`;
    }
  },

  filterAndRenderTable() {
    if (!this._usersCache) return;
    const wrap = document.getElementById('adminTableWrap');
    if (!wrap) return;

    let users = this._usersCache.slice();

    // Search
    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      users = users.filter(u => {
        const searchStr = `${u.firstName} ${u.lastName} ${u.username} ${u.email || ''}`.toLowerCase();
        return searchStr.includes(q);
      });
    }

    // Filters
    if (this._filterRole) users = users.filter(u => u.role === this._filterRole);
    if (this._filterTeam) users = users.filter(u => u.teamId == this._filterTeam);
    if (this._filterStatus === 'active') users = users.filter(u => u.isActive);
    else if (this._filterStatus === 'inactive') users = users.filter(u => !u.isActive);

    // Sort
    const dir = this._sortDir === 'asc' ? 1 : -1;
    users.sort((a, b) => {
      let va, vb;
      if (this._sortCol === 'name') { va = `${a.lastName} ${a.firstName}`; vb = `${b.lastName} ${b.firstName}`; }
      else if (this._sortCol === 'role') { va = a.role; vb = b.role; }
      else if (this._sortCol === 'team') { va = a.teamName || 'zzz'; vb = b.teamName || 'zzz'; }
      else if (this._sortCol === 'lastLogin') { va = a.lastLogin || ''; vb = b.lastLogin || ''; }
      else { va = a.username; vb = b.username; }
      return va < vb ? -dir : va > vb ? dir : 0;
    });

    // Build table inside card container
    const arrow = c => this._sortCol === c ? (this._sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    let h = '<div class="admin-table-card">';
    h += '<table class="admin-table">';
    h += '<thead><tr>';
    h += `<th class="col-name sortable" onclick="Admin.sortBy('name')">Name${arrow('name')}</th>`;
    h += `<th class="col-role sortable" onclick="Admin.sortBy('role')">Role${arrow('role')}</th>`;
    h += `<th class="col-team sortable" onclick="Admin.sortBy('team')">Team${arrow('team')}</th>`;
    h += '<th class="col-status">Status</th>';
    h += `<th class="col-login sortable" onclick="Admin.sortBy('lastLogin')">Last Login${arrow('lastLogin')}</th>`;
    h += '<th class="col-actions"></th>';
    h += '</tr></thead><tbody>';

    users.forEach(u => {
      const fn = Admin.titleCase(u.firstName);
      const ln = Admin.titleCase(u.lastName);
      const status = u.isActive ? 'Active' : 'Inactive';
      const statusClass = u.isActive ? 'status-active' : 'status-inactive';
      const rowStyle = u.isActive ? '' : ' style="opacity:.45"';
      const lastLogin = u.lastLogin ? Admin.timeAgo(u.lastLogin) : '<span class="text-muted">Never</span>';
      const pwIndicator = u.mustChangePassword ? ' <span class="pw-reset-label">Reset</span>' : '';

      h += `<tr${rowStyle}>`;
      h += `<td class="col-name"><div class="cell-name">${esc(fn)} ${esc(ln)}</div><div class="cell-username">${esc(u.username)}</div></td>`;
      h += `<td class="col-role"><span class="role-badge role-${u.role}">${u.role}</span></td>`;
      h += `<td class="col-team">${u.teamName ? esc(u.teamName) : '<span class="text-muted">—</span>'}</td>`;
      h += `<td class="col-status"><span class="${statusClass}">● ${status}</span></td>`;
      h += `<td class="col-login">${lastLogin}</td>`;
      h += '<td class="col-actions">';
      if (u.role !== 'superuser') {
        h += `<button class="admin-more-btn" onclick="Admin.showOverflowMenu(event,${u.id},${u.isActive},'${esc(u.firstName)} ${esc(u.lastName)}')">⋯</button>`;
      }
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table>';
    h += `<div class="admin-table-footer">Showing ${users.length} of ${this._usersCache.length} users</div>`;
    h += '</div>';
    wrap.innerHTML = h;
  },

  sortBy(col) {
    if (this._sortCol === col) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortCol = col;
      this._sortDir = 'asc';
    }
    this.filterAndRenderTable();
  },

  showOverflowMenu(event, id, isActive, name) {
    event.stopPropagation();
    // Remove existing menu
    const existing = document.getElementById('adminOverflow');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'adminOverflow';
    menu.className = 'admin-overflow';
    let items = '';
    items += `<button onclick="Admin.showEditUser(${id});Admin.closeOverflow()">✏️ Edit</button>`;
    items += `<button onclick="Admin.showResetPassword(${id});Admin.closeOverflow()">🔑 Reset Password</button>`;
    items += `<button onclick="Admin.showUserProgress(${id});Admin.closeOverflow()">📊 View Progress</button>`;
    if (id !== Auth.user.id) {
      if (isActive) {
        items += `<div class="admin-overflow-divider"></div>`;
        items += `<button class="danger" onclick="Admin.confirmDeactivate(${id},'${name}');Admin.closeOverflow()">🗑 Deactivate</button>`;
      } else {
        items += `<div class="admin-overflow-divider"></div>`;
        items += `<button onclick="Admin.reactivateUser(${id});Admin.closeOverflow()">↩ Reactivate</button>`;
      }
    }
    menu.innerHTML = items;

    // Position near the button
    const rect = event.target.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => document.addEventListener('click', Admin.closeOverflow, { once: true }), 10);
  },

  closeOverflow() {
    const m = document.getElementById('adminOverflow');
    if (m) m.remove();
  },

  timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  },

  confirmDeactivate(id, name) {
    const body = `
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:var(--fs-base);margin-bottom:12px">Deactivate <strong>${name}</strong>?</div>
        <div style="font-size:var(--fs-xs);color:var(--gray);margin-bottom:20px">They will no longer be able to log in. This can be reversed.</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="admin-btn" onclick="Admin.closeModal()">Cancel</button>
          <button class="modal-submit" style="background:#ff4466" onclick="Admin.deactivateUser(${id})">Deactivate</button>
        </div>
      </div>`;
    this.showModal('Confirm Deactivation', body);
  },

  async deactivateUser(id) {
    try {
      await API.updateUser(id, { isActive: false });
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      alert('Deactivation failed: ' + err.message);
    }
  },

  async reactivateUser(id) {
    try {
      await API.updateUser(id, { isActive: true });
      await this.renderUsers();
    } catch (err) {
      alert('Reactivation failed: ' + err.message);
    }
  },

  // ─── TEAMS TAB ───

  async renderTeams() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading teams...</div>';

    try {
      const data = await API.getTeams();
      let h = '';

      if (Auth.hasRole('superuser')) {
        h += '<button class="admin-action-btn" onclick="Admin.showCreateTeam()">+ Create Team</button>';
      }

      h += '<div class="admin-table-wrap"><table class="admin-table">';
      h += '<thead><tr><th>Team Name</th><th>Reps</th><th>Created</th>';
      if (Auth.hasRole('superuser')) h += '<th>Actions</th>';
      h += '</tr></thead><tbody>';

      data.teams.forEach(t => {
        h += '<tr>';
        h += `<td>${t.name}</td>`;
        h += `<td>${t.repCount}</td>`;
        h += `<td>${new Date(t.createdAt).toLocaleDateString()}</td>`;
        if (Auth.hasRole('superuser')) {
          h += `<td><button class="admin-btn" onclick="Admin.showEditTeam(${t.id}, '${t.name}')">Edit</button></td>`;
        }
        h += '</tr>';
      });

      h += '</tbody></table></div>';
      content.innerHTML = h;
    } catch (err) {
      content.innerHTML = `<div class="admin-error">${err.message}</div>`;
    }
  },

  // ─── MODAL DIALOGS ───

  showModal(title, body) {
    const existing = document.getElementById('adminModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" onclick="Admin.closeModal()">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>`;
    document.body.appendChild(modal);
  },

  closeModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.remove();
  },

  async showCreateUser() {
    let teamOpts = '';
    try {
      const td = await API.getTeams();
      teamOpts = td.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    } catch(e) {}
    const body = `
      <div class="modal-field"><label>Username</label><input type="text" id="cuUsername"></div>
      <div class="modal-field"><label>First Name</label><input type="text" id="cuFirst"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="cuLast"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="cuEmail"></div>
      <div class="modal-field"><label>Password</label><div class="pw-field" style="position:relative"><input type="password" id="cuPass" style="width:100%;padding-right:44px"><button type="button" class="pw-eye" style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:44px;height:44px;background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;opacity:.5" onclick="togglePwVis('cuPass',this)">&#128065;</button></div></div>
      <div class="modal-field"><label>Role</label>
        <select id="cuRole">
          <option value="rep">Rep</option>
          ${Auth.hasRole('superuser') ? '<option value="manager">Manager</option>' : ''}
        </select>
      </div>
      <div class="modal-field"><label>Team</label>
        <select id="cuTeam">
          <option value="">No team</option>
          ${teamOpts}
        </select>
      </div>
      <div id="cuError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.createUser()">Create User</button>`;
    this.showModal('Create User', body);
  },

  async createUser() {
    const errorEl = document.getElementById('cuError');
    try {
      await API.createUser({
        username: document.getElementById('cuUsername').value,
        firstName: document.getElementById('cuFirst').value,
        lastName: document.getElementById('cuLast').value,
        email: document.getElementById('cuEmail').value,
        password: document.getElementById('cuPass').value,
        role: document.getElementById('cuRole').value,
        teamId: document.getElementById('cuTeam').value || null
      });
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  async showEditUser(id) {
    // Find user from cache for pre-fill
    const u = (this._usersCache || []).find(x => x.id === id) || {};
    const isSuperuser = Auth.hasRole('superuser');

    // Fetch teams for dropdown
    let teamOpts = '';
    try {
      const td = await API.getTeams();
      teamOpts = td.teams.map(t => `<option value="${t.id}"${u.teamId == t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    } catch(e) {}

    const roleSelect = isSuperuser && u.role !== 'superuser' && id !== Auth.user.id
      ? `<div class="modal-field"><label>Role</label><select id="euRole"><option value="rep"${u.role==='rep'?' selected':''}>Rep</option><option value="manager"${u.role==='manager'?' selected':''}>Manager</option></select></div>`
      : '';

    const body = `
      <div class="modal-field"><label>First Name</label><input type="text" id="euFirst" value="${esc(u.firstName || '')}"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="euLast" value="${esc(u.lastName || '')}"></div>
      <div class="modal-field"><label>Nickname</label><input type="text" id="euNick" value="${esc(u.nickname || '')}"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="euEmail" value="${esc(u.email || '')}"></div>
      ${roleSelect}
      <div class="modal-field"><label>Team</label>
        <select id="euTeam">
          <option value="">No team</option>
          ${teamOpts}
        </select>
      </div>
      <div class="modal-field">
        <label><input type="checkbox" id="euActive" ${u.isActive !== false ? 'checked' : ''}> Active</label>
      </div>
      <div id="euError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.editUser(${id})">Save Changes</button>`;
    this.showModal('Edit User', body);
  },

  async editUser(id) {
    const errorEl = document.getElementById('euError');
    try {
      const data = {
        firstName: document.getElementById('euFirst').value,
        lastName: document.getElementById('euLast').value,
        nickname: document.getElementById('euNick').value,
        email: document.getElementById('euEmail').value,
        isActive: document.getElementById('euActive').checked
      };
      // Include role if the dropdown exists
      const roleEl = document.getElementById('euRole');
      if (roleEl) data.role = roleEl.value;
      // Include team
      const teamEl = document.getElementById('euTeam');
      if (teamEl) data.teamId = teamEl.value || null;

      await API.updateUser(id, data);
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  showResetPassword(id) {
    const body = `
      <div class="modal-field"><label>New Password (min 8 chars)</label><div class="pw-field" style="position:relative"><input type="password" id="rpPass" style="width:100%;padding-right:44px"><button type="button" class="pw-eye" style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:44px;height:44px;background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;opacity:.5" onclick="togglePwVis('rpPass',this)">&#128065;</button></div></div>
      <div id="rpError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.resetPassword(${id})">Reset Password</button>`;
    this.showModal('Reset Password', body);
  },

  async resetPassword(id) {
    const errorEl = document.getElementById('rpError');
    try {
      await API.resetPassword(id, document.getElementById('rpPass').value);
      this.closeModal();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  async showUserProgress(id) {
    try {
      const data = await API.getUserProgress(id);
      let body = `<div class="modal-field"><strong>${data.user.firstName} ${data.user.lastName}</strong></div>`;

      if (data.progress.length === 0) {
        body += '<div class="modal-field">No progress recorded yet.</div>';
      } else {
        body += '<table class="admin-table compact"><thead><tr><th>Module</th><th>Activity</th><th>Status</th></tr></thead><tbody>';
        data.progress.forEach(p => {
          body += `<tr><td>${p.module_id}</td><td>${p.activity_type}</td><td>${p.status}</td></tr>`;
        });
        body += '</tbody></table>';
      }

      if (data.scores.length > 0) {
        body += '<div class="modal-field" style="margin-top:16px"><strong>Recent Scores</strong></div>';
        body += '<table class="admin-table compact"><thead><tr><th>Activity</th><th>Score</th><th>Date</th></tr></thead><tbody>';
        data.scores.slice(0, 10).forEach(s => {
          body += `<tr><td>${s.activity_id}</td><td>${s.score}/${s.max_score}</td><td>${new Date(s.submitted_at).toLocaleDateString()}</td></tr>`;
        });
        body += '</tbody></table>';
      }

      this.showModal('User Progress', body);
    } catch (err) {
      this.showModal('Error', `<div class="modal-error" style="display:block">${err.message}</div>`);
    }
  },

  showCreateTeam() {
    const body = `
      <div class="modal-field"><label>Team Name</label><input type="text" id="ctName"></div>
      <div id="ctError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.createTeam()">Create Team</button>`;
    this.showModal('Create Team', body);
  },

  async createTeam() {
    const errorEl = document.getElementById('ctError');
    try {
      await API.createTeam(document.getElementById('ctName').value);
      this.closeModal();
      await this.renderTeams();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  showEditTeam(id, currentName) {
    const body = `
      <div class="modal-field"><label>Team Name</label><input type="text" id="etName" value="${esc(currentName)}"></div>
      <div id="etError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.editTeam(${id})">Save</button>`;
    this.showModal('Edit Team', body);
  },

  async editTeam(id) {
    const errorEl = document.getElementById('etError');
    try {
      await API.updateTeam(id, document.getElementById('etName').value);
      this.closeModal();
      await this.renderTeams();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  // ─── CONTENT TAB (CMS) ───

  async renderContent() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading content...</div>';

    try {
      const data = await API.getModules();
      let h = '<div class="cms-content">';

      // Module list
      h += '<div class="cms-modules-list">';
      data.forEach((m, i) => {
        h += `<div class="cms-module-card" onclick="Admin.editModule('${m.id}')">`;
        h += `<span class="cms-mod-icon">${m.icon || '📋'}</span>`;
        h += `<div class="cms-mod-info"><strong>${m.title}</strong><span class="cms-mod-phase">Phase ${m.phase}</span></div>`;
        h += '<span class="cms-mod-arrow">›</span>';
        h += '</div>';
      });
      h += '</div>';

      // Quiz section
      h += '<div style="margin-top:24px">';
      h += '<button class="admin-action-btn" onclick="Admin.editQuizzes()">📝 Edit Quiz Questions</button>';
      h += '</div>';

      h += '</div>';
      content.innerHTML = h;
    } catch (err) {
      content.innerHTML = `<div class="admin-error">${err.message}</div>`;
    }
  },

  async editModule(moduleId) {
    try {
      const m = await API.getModuleAdmin(moduleId);
      this._editCache = m; // Cache for pre-filling edit forms
      let body = '';

      // Module metadata
      body += '<div class="cms-section"><h3>Module Settings</h3>';
      body += `<div class="modal-field"><label>Title</label><input type="text" id="cmTitle" value="${this.esc(m.title)}"></div>`;
      body += `<div class="modal-field"><label>Description</label><textarea id="cmDesc" rows="3">${this.esc(m.description || '')}</textarea></div>`;
      body += `<div class="modal-field"><label>Icon (emoji)</label><input type="text" id="cmIcon" value="${m.icon || ''}" style="width:60px"></div>`;
      body += `<div class="modal-field"><label>Phase</label><select id="cmPhase"><option value="1"${m.phase===1?' selected':''}>1 - Foundation</option><option value="2"${m.phase===2?' selected':''}>2 - Applied</option><option value="3"${m.phase===3?' selected':''}>3 - Validation</option></select></div>`;
      body += `<div class="modal-field"><label>Game ID</label><input type="text" id="cmGameId" value="${m.game_id || ''}"></div>`;
      body += `<div class="modal-field"><label>Game Title</label><input type="text" id="cmGameTitle" value="${this.esc(m.game_title || '')}"></div>`;
      body += `<div class="modal-field"><label>Game Description</label><textarea id="cmGameDesc" rows="2">${this.esc(m.game_desc || '')}</textarea></div>`;
      body += `<div id="cmError" class="modal-error"></div>`;
      body += `<button class="modal-submit" onclick="Admin.saveModule('${moduleId}')">Save Module</button>`;
      body += '</div>';

      // Videos
      body += '<div class="cms-section"><h3>Videos</h3>';
      (m.videos || []).forEach(v => {
        body += `<div class="cms-item"><span>${v.icon || '📺'} ${this.esc(v.title)}</span>`;
        body += `<span class="cms-item-actions"><button class="admin-btn" onclick="Admin.editVideo(${v.id}, '${moduleId}')">Edit</button>`;
        body += `<button class="admin-btn danger" onclick="Admin.deleteVideo(${v.id}, '${moduleId}')">×</button></span></div>`;
      });
      body += `<button class="admin-btn add" onclick="Admin.addVideo('${moduleId}')">+ Add Video</button>`;
      body += '</div>';

      // Doc Sections
      body += '<div class="cms-section"><h3>Document Sections</h3>';
      (m.docs || []).forEach(d => {
        body += `<div class="cms-item"><span>${this.esc(d.heading)}</span>`;
        body += `<span class="cms-item-actions"><button class="admin-btn" onclick="Admin.editDoc(${d.id}, '${moduleId}')">Edit</button>`;
        body += `<button class="admin-btn danger" onclick="Admin.deleteDoc(${d.id}, '${moduleId}')">×</button></span></div>`;
      });
      body += `<button class="admin-btn add" onclick="Admin.addDoc('${moduleId}')">+ Add Section</button>`;
      body += '</div>';

      // Apply Items
      body += '<div class="cms-section"><h3>Checklist Items</h3>';
      (m.apply_items || []).forEach(a => {
        body += `<div class="cms-item"><span>${a.icon || '☐'} ${this.esc(a.text)}</span>`;
        body += `<span class="cms-item-actions"><button class="admin-btn" onclick="Admin.editApplyItem(${a.id}, '${moduleId}')">Edit</button>`;
        body += `<button class="admin-btn danger" onclick="Admin.deleteApplyItem(${a.id}, '${moduleId}')">×</button></span></div>`;
      });
      body += `<button class="admin-btn add" onclick="Admin.addApplyItem('${moduleId}')">+ Add Item</button>`;
      body += '</div>';

      this.showModal(`${m.icon || '📋'} ${m.title}`, body);
    } catch (err) {
      this.showModal('Error', `<div class="modal-error" style="display:block">${err.message}</div>`);
    }
  },

  async saveModule(id) {
    const errorEl = document.getElementById('cmError');
    try {
      await API.updateModule(id, {
        title: document.getElementById('cmTitle').value,
        description: document.getElementById('cmDesc').value,
        icon: document.getElementById('cmIcon').value,
        phase: parseInt(document.getElementById('cmPhase').value),
        game_id: document.getElementById('cmGameId').value,
        game_title: document.getElementById('cmGameTitle').value,
        game_desc: document.getElementById('cmGameDesc').value
      });
      this.closeModal();
      await this.renderContent();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  // Video CRUD
  addVideo(moduleId) {
    const body = `
      <div class="modal-field"><label>Title</label><input type="text" id="avTitle"></div>
      <div class="modal-field"><label>URL (YouTube embed)</label><input type="text" id="avUrl"></div>
      <div class="modal-field"><label>Description</label><textarea id="avDesc" rows="2"></textarea></div>
      <div class="modal-field"><label>Icon (emoji)</label><input type="text" id="avIcon" value="📺" style="width:60px"></div>
      <div id="avError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveNewVideo('${moduleId}')">Add Video</button>`;
    this.showModal('Add Video', body);
  },

  async saveNewVideo(moduleId) {
    try {
      await API.createVideo({ module_id: moduleId, title: document.getElementById('avTitle').value, url: document.getElementById('avUrl').value, description: document.getElementById('avDesc').value, icon: document.getElementById('avIcon').value });
      this.closeModal();
      this.editModule(moduleId);
    } catch (err) { document.getElementById('avError').textContent = err.message; document.getElementById('avError').style.display = 'block'; }
  },

  async editVideo(videoId, moduleId) {
    // Pre-fill from cached module data
    const v = this._editCache?.videos?.find(v => v.id === videoId) || {};
    const body = `
      <div class="modal-field"><label>Title</label><input type="text" id="evTitle" value="${esc(v.title || '')}"></div>
      <div class="modal-field"><label>URL</label><input type="text" id="evUrl" value="${esc(v.url || '')}"></div>
      <div class="modal-field"><label>Description</label><textarea id="evDesc" rows="2">${esc(v.description || '')}</textarea></div>
      <div class="modal-field"><label>Icon</label><input type="text" id="evIcon" value="${v.icon || ''}" style="width:60px"></div>
      <div id="evError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveEditVideo(${videoId}, '${moduleId}')">Save</button>`;
    this.showModal('Edit Video', body);
  },

  async saveEditVideo(id, moduleId) {
    try {
      await API.updateVideo(id, { title: document.getElementById('evTitle').value, url: document.getElementById('evUrl').value, description: document.getElementById('evDesc').value, icon: document.getElementById('evIcon').value });
      this.closeModal();
      toast('Video updated');
      this.editModule(moduleId);
    } catch (err) { document.getElementById('evError').textContent = err.message; document.getElementById('evError').style.display = 'block'; }
  },

  async deleteVideo(id, moduleId) {
    if (!confirm('Delete this video?')) return;
    try { await API.deleteVideo(id); this.editModule(moduleId); } catch (err) { alert(err.message); }
  },

  // Doc CRUD
  addDoc(moduleId) {
    const body = `
      <div class="modal-field"><label>Heading</label><input type="text" id="adHead"></div>
      <div class="modal-field"><label>Body (HTML allowed)</label><textarea id="adBody" rows="6"></textarea></div>
      <div id="adError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveNewDoc('${moduleId}')">Add Section</button>`;
    this.showModal('Add Document Section', body);
  },

  async saveNewDoc(moduleId) {
    try {
      await API.createDoc({ module_id: moduleId, heading: document.getElementById('adHead').value, body: document.getElementById('adBody').value });
      this.closeModal();
      this.editModule(moduleId);
    } catch (err) { document.getElementById('adError').textContent = err.message; document.getElementById('adError').style.display = 'block'; }
  },

  async editDoc(docId, moduleId) {
    // Pre-fill from cached module data
    const d = this._editCache?.docs?.find(d => d.id === docId) || {};
    const body = `
      <div class="modal-field"><label>Heading</label><input type="text" id="edHead" value="${esc(d.heading || '')}"></div>
      <div class="modal-field"><label>Body (HTML allowed)</label><textarea id="edBody" rows="6">${esc(d.body || '')}</textarea></div>
      <div id="edError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveEditDoc(${docId}, '${moduleId}')">Save</button>`;
    this.showModal('Edit Document Section', body);
  },

  async saveEditDoc(id, moduleId) {
    try {
      await API.updateDoc(id, { heading: document.getElementById('edHead').value, body: document.getElementById('edBody').value });
      this.closeModal();
      toast('Document section updated');
      this.editModule(moduleId);
    } catch (err) { document.getElementById('edError').textContent = err.message; document.getElementById('edError').style.display = 'block'; }
  },

  async deleteDoc(id, moduleId) {
    if (!confirm('Delete this section?')) return;
    try { await API.deleteDoc(id); this.editModule(moduleId); } catch (err) { alert(err.message); }
  },

  // Apply Item CRUD
  addApplyItem(moduleId) {
    const body = `
      <div class="modal-field"><label>Text</label><input type="text" id="aaText"></div>
      <div class="modal-field"><label>Type</label><select id="aaType"><option value="text">Text</option><option value="link">Link</option><option value="chatbot">Chatbot</option></select></div>
      <div class="modal-field"><label>URL (for link type)</label><input type="text" id="aaUrl"></div>
      <div class="modal-field"><label>Icon</label><input type="text" id="aaIcon" style="width:60px"></div>
      <div id="aaError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveNewApplyItem('${moduleId}')">Add Item</button>`;
    this.showModal('Add Checklist Item', body);
  },

  async saveNewApplyItem(moduleId) {
    try {
      await API.createApplyItem({ module_id: moduleId, text: document.getElementById('aaText').value, item_type: document.getElementById('aaType').value, url: document.getElementById('aaUrl').value, icon: document.getElementById('aaIcon').value });
      this.closeModal();
      this.editModule(moduleId);
    } catch (err) { document.getElementById('aaError').textContent = err.message; document.getElementById('aaError').style.display = 'block'; }
  },

  async editApplyItem(itemId, moduleId) {
    // Pre-fill from cached module data
    const a = this._editCache?.apply_items?.find(a => a.id === itemId) || {};
    const body = `
      <div class="modal-field"><label>Text</label><input type="text" id="eaText" value="${esc(a.text || '')}"></div>
      <div class="modal-field"><label>Type</label><select id="eaType"><option value="text"${a.item_type==='text'?' selected':''}>Text</option><option value="link"${a.item_type==='link'?' selected':''}>Link</option><option value="chatbot"${a.item_type==='chatbot'?' selected':''}>Chatbot</option></select></div>
      <div class="modal-field"><label>URL</label><input type="text" id="eaUrl" value="${esc(a.url || '')}"></div>
      <div class="modal-field"><label>Icon</label><input type="text" id="eaIcon" value="${a.icon || ''}" style="width:60px"></div>
      <div id="eaError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveEditApplyItem(${itemId}, '${moduleId}')">Save</button>`;
    this.showModal('Edit Checklist Item', body);
  },

  async saveEditApplyItem(id, moduleId) {
    try {
      await API.updateApplyItem(id, { text: document.getElementById('eaText').value, item_type: document.getElementById('eaType').value, url: document.getElementById('eaUrl').value, icon: document.getElementById('eaIcon').value });
      this.closeModal();
      this.editModule(moduleId);
    } catch (err) { document.getElementById('eaError').textContent = err.message; document.getElementById('eaError').style.display = 'block'; }
  },

  async deleteApplyItem(id, moduleId) {
    if (!confirm('Delete this item?')) return;
    try { await API.deleteApplyItem(id); this.editModule(moduleId); } catch (err) { alert(err.message); }
  },

  // Quiz Questions
  async editQuizzes() {
    try {
      const questions = await API.getQuizzesAdmin();
      const pools = {};
      questions.forEach(q => {
        if (!pools[q.pool]) pools[q.pool] = [];
        pools[q.pool].push(q);
      });

      let body = '';
      for (const [pool, qs] of Object.entries(pools)) {
        body += `<div class="cms-section"><h3>${pool} (${qs.length} questions)</h3>`;
        qs.forEach(q => {
          const preview = q.question.length > 80 ? q.question.substring(0, 80) + '…' : q.question;
          body += `<div class="cms-item"><span>${this.esc(preview)}</span>`;
          body += `<span class="cms-item-actions"><button class="admin-btn" onclick="Admin.editQuizQuestion(${q.id})">Edit</button>`;
          body += `<button class="admin-btn danger" onclick="Admin.deleteQuizQuestion(${q.id})">×</button></span></div>`;
        });
        body += `<button class="admin-btn add" onclick="Admin.addQuizQuestion('${pool}')">+ Add Question</button></div>`;
      }

      this.showModal('Quiz Questions', body);
    } catch (err) {
      this.showModal('Error', `<div class="modal-error" style="display:block">${err.message}</div>`);
    }
  },

  addQuizQuestion(pool) {
    const body = `
      <div class="modal-field"><label>Question</label><textarea id="aqQ" rows="3"></textarea></div>
      <div class="modal-field"><label>Option 1</label><input type="text" id="aqO0"></div>
      <div class="modal-field"><label>Option 2</label><input type="text" id="aqO1"></div>
      <div class="modal-field"><label>Option 3</label><input type="text" id="aqO2"></div>
      <div class="modal-field"><label>Option 4</label><input type="text" id="aqO3"></div>
      <div class="modal-field"><label>Correct Answer (0-3)</label><input type="number" id="aqC" min="0" max="3" value="0"></div>
      <div class="modal-field"><label>Explanation</label><textarea id="aqExp" rows="2"></textarea></div>
      <div id="aqError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveNewQuizQuestion('${pool}')">Add Question</button>`;
    this.showModal(`Add Question to ${pool}`, body);
  },

  async saveNewQuizQuestion(pool) {
    try {
      const allOpts = [0,1,2,3].map(i => document.getElementById('aqO'+i).value);
      const originalCorrect = parseInt(document.getElementById('aqC').value);
      const correctText = allOpts[originalCorrect];
      const options = allOpts.filter(o => o.trim());
      const correct_index = options.indexOf(correctText);
      if (correct_index === -1) { document.getElementById('aqError').textContent = 'Correct answer option cannot be blank'; document.getElementById('aqError').style.display = 'block'; return; }
      await API.createQuizQuestion({ pool, question: document.getElementById('aqQ').value, options, correct_index, explanation: document.getElementById('aqExp').value });
      this.closeModal();
      this.editQuizzes();
    } catch (err) { document.getElementById('aqError').textContent = err.message; document.getElementById('aqError').style.display = 'block'; }
  },

  async editQuizQuestion(id) {
    const body = `
      <div class="modal-field"><label>Question</label><textarea id="eqQ" rows="3"></textarea></div>
      <div class="modal-field"><label>Option 1</label><input type="text" id="eqO0"></div>
      <div class="modal-field"><label>Option 2</label><input type="text" id="eqO1"></div>
      <div class="modal-field"><label>Option 3</label><input type="text" id="eqO2"></div>
      <div class="modal-field"><label>Option 4</label><input type="text" id="eqO3"></div>
      <div class="modal-field"><label>Correct Answer (0-3)</label><input type="number" id="eqC" min="0" max="3" value="0"></div>
      <div class="modal-field"><label>Explanation</label><textarea id="eqExp" rows="2"></textarea></div>
      <div id="eqError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.saveEditQuizQuestion(${id})">Save</button>`;
    this.showModal('Edit Question', body);
  },

  async saveEditQuizQuestion(id) {
    try {
      const allOpts = [0,1,2,3].map(i => document.getElementById('eqO'+i).value);
      const originalCorrect = parseInt(document.getElementById('eqC').value);
      const correctText = allOpts[originalCorrect];
      const options = allOpts.filter(o => o.trim());
      const correct_index = options.indexOf(correctText);
      if (correct_index === -1) { document.getElementById('eqError').textContent = 'Correct answer option cannot be blank'; document.getElementById('eqError').style.display = 'block'; return; }
      await API.updateQuizQuestion(id, { question: document.getElementById('eqQ').value, options, correct_index, explanation: document.getElementById('eqExp').value });
      this.closeModal();
      this.editQuizzes();
    } catch (err) { document.getElementById('eqError').textContent = err.message; document.getElementById('eqError').style.display = 'block'; }
  },

  async deleteQuizQuestion(id) {
    if (!confirm('Delete this question?')) return;
    try { await API.deleteQuizQuestion(id); this.editQuizzes(); } catch (err) { alert(err.message); }
  },

  // Escape HTML for safe display
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
};
