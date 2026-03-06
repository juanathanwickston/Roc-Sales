/**
 * Admin Panel UI for ROC Academy.
 * User management, pathway management, rep progress viewing.
 * Only accessible to manager, ld_manager, and superuser roles.
 */

const Admin = {
  currentTab: 'users',
  _editCache: null,
  _usersCache: null,
  _searchQuery: '',
  _filterRole: '',
  _filterPathway: '',
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
    h += `<button class="admin-tab${this.currentTab === 'pathways' ? ' active' : ''}" onclick="Admin.switchTab('pathways')">Pathways</button>`;
    h += `<button class="admin-tab${this.currentTab === 'content' ? ' active' : ''}" onclick="Admin.switchTab('content')">Modules</button>`;
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

    // Register popstate handler for builder back-navigation (only once)
    if (!this._popstateRegistered) {
      window.addEventListener('popstate', this._handlePopState);
      this._popstateRegistered = true;
    }

    if (this.currentTab === 'users') {
      await this.renderUsers();
    } else if (this.currentTab === 'pathways') {
      await this.renderPathways();
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
      const pathwaysData = await API.getPathways();
      this._usersCache = data.users;
      let h = '';

      // ── Summary Cards ──
      const total = data.users.length;
      const pendingPw = data.users.filter(u => u.mustChangePassword).length;
      const now = Date.now();
      const recentLogins = data.users.filter(u => u.lastLogin && (now - new Date(u.lastLogin).getTime()) < 7 * 86400000).length;

      h += '<div class="admin-stats">';
      h += `<div class="admin-stat"><div class="admin-stat-val">${total}</div><div class="admin-stat-label">Total Users</div></div>`;
      h += `<div class="admin-stat"><div class="admin-stat-val">${pendingPw}</div><div class="admin-stat-label">Pending Reset</div></div>`;
      h += `<div class="admin-stat"><div class="admin-stat-val">${recentLogins}</div><div class="admin-stat-label">Recent Logins (7d)</div></div>`;
      h += '</div>';

      // ── Toolbar: Search + Filters + Create ──
      const pathwayOptions = pathwaysData.pathways.map(p => `<option value="${p.id}"${this._filterPathway == p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
      h += '<div class="admin-toolbar-row">';
      h += `<input type="text" class="admin-search" id="adminSearch" placeholder="Search users..." value="${esc(this._searchQuery)}" autocomplete="one-time-code" oninput="Admin._searchQuery=this.value;Admin.filterAndRenderTable()">`;
      h += `<select class="admin-filter" onchange="Admin._filterRole=this.value;Admin.filterAndRenderTable()"><option value="">All Roles</option><option value="rep"${this._filterRole==='rep'?' selected':''}>Rep</option><option value="manager"${this._filterRole==='manager'?' selected':''}>Manager</option><option value="ld_manager"${this._filterRole==='ld_manager'?' selected':''}>LD Manager</option><option value="superuser"${this._filterRole==='superuser'?' selected':''}>Superuser</option></select>`;
      h += `<select class="admin-filter" onchange="Admin._filterPathway=this.value;Admin.filterAndRenderTable()"><option value="">All Pathways</option>${pathwayOptions}</select>`;
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
    if (this._filterPathway) users = users.filter(u => (u.pathways || []).some(p => p.id == this._filterPathway));

    // Sort
    const dir = this._sortDir === 'asc' ? 1 : -1;
    users.sort((a, b) => {
      let va, vb;
      if (this._sortCol === 'name') { va = `${a.lastName} ${a.firstName}`; vb = `${b.lastName} ${b.firstName}`; }
      else if (this._sortCol === 'role') { va = a.role; vb = b.role; }
      else if (this._sortCol === 'pathway') { va = (a.pathways || [])[0]?.name || 'zzz'; vb = (b.pathways || [])[0]?.name || 'zzz'; }
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
    h += `<th class="col-pathway sortable" onclick="Admin.sortBy('pathway')">Pathway${arrow('pathway')}</th>`;
    h += `<th class="col-login sortable" onclick="Admin.sortBy('lastLogin')">Last Login${arrow('lastLogin')}</th>`;
    h += '<th class="col-actions"></th>';
    h += '</tr></thead><tbody>';

    users.forEach(u => {
      const fn = Admin.titleCase(u.firstName);
      const ln = Admin.titleCase(u.lastName);
      const lastLogin = u.lastLogin ? Admin.timeAgo(u.lastLogin) : '<span class="text-muted">Never</span>';
      const pwIndicator = u.mustChangePassword ? ' <span class="pw-reset-label">Reset</span>' : '';

      h += '<tr>';
      h += `<td class="col-name"><div class="cell-name">${esc(fn)} ${esc(ln)}</div><div class="cell-username">${esc(u.username)}</div></td>`;
      const roleLabel = u.role === 'ld_manager' ? 'LD Manager' : u.role;
      h += `<td class="col-role"><span class="role-text">${roleLabel}</span></td>`;
      h += `<td class="col-pathway">${(u.pathways || []).length > 0 ? u.pathways.map(p => esc(p.name)).join(', ') : '<span class="text-muted">—</span>'}</td>`;
      h += `<td class="col-login">${lastLogin}</td>`;
      h += '<td class="col-actions">';
      if (u.role !== 'superuser') {
        h += `<button class="admin-more-btn" onclick="Admin.showOverflowMenu(event,${u.id},'${esc(u.firstName)} ${esc(u.lastName)}')">⋯</button>`;
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

  showOverflowMenu(event, id, name) {
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
      items += `<div class="admin-overflow-divider"></div>`;
      items += `<button class="danger" onclick="Admin.confirmDelete(${id},'${name}');Admin.closeOverflow()">🗑 Delete</button>`;
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

  confirmDelete(id, name) {
    const body = `
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:var(--fs-base);margin-bottom:12px">Permanently delete <strong>${name}</strong>?</div>
        <div style="font-size:var(--fs-xs);color:var(--gray);margin-bottom:20px">This cannot be undone. All progress and scores will be removed.</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="admin-btn" onclick="Admin.closeModal()">Cancel</button>
          <button class="modal-submit" style="background:#ff4466" onclick="Admin.deleteUser(${id})">Delete</button>
        </div>
      </div>`;
    this.showModal('Confirm Deletion', body);
  },

  async deleteUser(id) {
    try {
      await API.deleteUser(id);
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      alert('Deletion failed: ' + err.message);
    }
  },

  // ─── PATHWAYS TAB ───

  async renderPathways() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading pathways...</div>';

    try {
      const data = await API.getPathways();
      this._allPathways = data.pathways;
      this._renderPathwayCards();
    } catch (err) {
      content.innerHTML = `<div class="admin-error">${err.message}</div>`;
    }
  },

  _renderPathwayCards() {
    const content = document.getElementById('adminContent');
    const pathways = this._allPathways;

    let h = '<div class="pathway-hub">';

    // Toolbar: create button
    h += '<div class="pathway-toolbar">';
    h += '<div class="pathway-filters"></div>';
    if (Auth.hasRole('ld_manager')) {
      h += '<button class="admin-action-btn" onclick="Admin.showCreatePathway()">+ Create Pathway</button>';
    }
    h += '</div>';

    // Card grid
    if (pathways.length === 0) {
      h += '<div class="admin-loading">No pathways found.</div>';
    } else {
      h += '<div class="pathway-cards">';
      pathways.forEach(p => {
        h += '<div class="pathway-card">';

        // Header: name
        h += '<div class="pathway-card-header">';
        h += `<span class="pathway-card-name">${esc(p.name)}</span>`;
        h += '</div>';

        // Description (2-line clamp)
        h += `<div class="pathway-card-desc">${esc(p.description || 'No description')}</div>`;

        // Meta row: reps + created date
        h += '<div class="pathway-card-meta">';
        h += `<span class="pathway-card-stat">👥 ${p.repCount} rep${p.repCount !== 1 ? 's' : ''}</span>`;
        h += `<span class="pathway-card-stat">📅 ${new Date(p.createdAt).toLocaleDateString()}</span>`;
        h += '</div>';

        // Actions footer
        if (Auth.hasRole('ld_manager')) {
          h += '<div class="pathway-card-actions">';
          h += `<button class="admin-btn" onclick="Admin.showPathwayProgress(${p.id}, '${esc(p.name)}')">Progress</button>`;
          h += `<button class="admin-btn" onclick="Admin.showEditPathway(${p.id})">Edit</button>`;
          h += `<button class="admin-btn" onclick="Admin.showAssignPathway(${p.id}, '${esc(p.name)}')">Assign</button>`;
          h += `<div class="pw-overflow">`;
          h += `<button class="pw-overflow-btn" onclick="event.stopPropagation();Admin.toggleOverflow(this)" title="More actions">⋮</button>`;
          h += `<div class="pw-overflow-menu">`;
          h += `<button onclick="Admin.duplicatePathway(${p.id})">Duplicate</button>`;
          h += `<button class="danger" onclick="Admin.deletePathway(${p.id}, '${esc(p.name)}')">Delete</button>`;
          h += `</div></div>`;
          h += '</div>';
        } else if (Auth.hasRole('manager')) {
          h += '<div class="pathway-card-actions">';
          h += `<button class="admin-btn" onclick="Admin.showPathwayProgress(${p.id}, '${esc(p.name)}')">Progress</button>`;
          h += '</div>';
        }

        h += '</div>';
      });
      h += '</div>';
    }

    h += '</div>';
    content.innerHTML = h;
  },


  async deletePathway(id, name) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis will unassign all users and remove the pathway. This cannot be undone.`)) return;
    try {
      const result = await API.deletePathway(id);
      toast(`Pathway deleted. ${result.usersUnassigned} user(s) unassigned.`);
      await this.renderPathways();
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  /**
   * Toggle overflow ⋮ menu. Closes on click outside.
   */
  toggleOverflow(btn) {
    const menu = btn.nextElementSibling;
    const isOpen = menu.classList.toggle('open');
    if (isOpen) {
      const close = (e) => {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.classList.remove('open');
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  },

  async duplicatePathway(id) {
    try {
      const result = await API.duplicatePathway(id);
      toast(`Pathway duplicated as "${result.name}"`);
      await this.renderPathways();
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  // ─── PATHWAY PROGRESS VIEW ───

  /**
   * Full-page progress view for a pathway.
   * Renders into #adminContent with breadcrumb.
   */
  async showPathwayProgress(pathwayId, pathwayName) {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading" aria-busy="true">Loading progress...</div>';

    history.pushState({ view: 'pathwayProgress', id: pathwayId }, '', '');

    try {
      const data = await API.getPathwayProgress(pathwayId);
      this._progressData = data;

      let h = '';

      // Breadcrumb
      h += '<div class="pb-breadcrumb">';
      h += '<a onclick="Admin.backToPathways()">← Back to Pathways</a>';
      h += `<span>/ ${esc(pathwayName)} — Progress</span>`;
      h += '</div>';

      // Summary cards
      h += '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">';
      h += `<div class="admin-stat-card"><div class="admin-stat-value">${data.summary.completedUsers}/${data.summary.totalUsers}</div><div class="admin-stat-label">Users Completed</div></div>`;
      h += `<div class="admin-stat-card"><div class="admin-stat-value">${data.pathway.totalModules}</div><div class="admin-stat-label">Total Modules</div></div>`;
      h += '</div>';

      // Per-user table
      h += '<div class="admin-table-card"><table class="admin-table"><thead><tr>';
      h += '<th>Name</th><th>Modules</th><th>%</th><th>Started</th><th>Completed</th>';
      if (Auth.hasRole('ld_manager')) h += '<th>Actions</th>';
      h += '</tr></thead><tbody>';

      if (data.users.length === 0) {
        h += `<tr><td colspan="${Auth.hasRole('ld_manager') ? 6 : 5}" style="text-align:center;color:var(--gray)">No users enrolled</td></tr>`;
      } else {
        data.users.forEach(u => {
          const pctCls = u.completedAt ? 'done' : (u.pct > 0 ? 'prog' : '');
          h += '<tr>';
          h += `<td>${esc(u.name)}</td>`;
          h += `<td>${u.modulesComplete}/${u.totalModules}</td>`;
          h += `<td><span class="mc-st ${pctCls}">${u.pct}%</span></td>`;
          h += `<td>${u.startedAt ? new Date(u.startedAt).toLocaleDateString() : '—'}</td>`;
          h += `<td>${u.completedAt ? '✅ ' + new Date(u.completedAt).toLocaleDateString() : '—'}</td>`;
          if (Auth.hasRole('ld_manager')) {
            h += `<td><button class="admin-btn" style="font-size:12px" onclick="Admin.forceUnlockPrompt(${u.userId}, '${esc(u.name)}', ${pathwayId}, '${esc(pathwayName)}')">Force Unlock</button></td>`;
          }
          h += '</tr>';
        });
      }

      h += '</tbody></table></div>';

      // Footer: CSV export
      h += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">';
      h += `<button class="admin-btn" onclick="Admin.downloadProgressCSV(${pathwayId}, '${esc(pathwayName)}')">📥 Export CSV</button>`;
      h += '</div>';

      content.innerHTML = h;
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  /**
   * Prompt to select which module to force-unlock for a user.
   */
  async forceUnlockPrompt(userId, userName, pathwayId, pathwayName) {
    const moduleId = prompt(`Force Unlock for ${userName}\n\nEnter the module ID to unlock (e.g., m1, m2):`);
    if (!moduleId || !moduleId.trim()) return;

    try {
      await API.forceUnlockModule(userId, moduleId.trim());
      toast(`Module ${moduleId.trim()} force-unlocked for ${userName}`);
      // Refresh the progress view
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) overlay.remove();
      await this.showPathwayProgress(pathwayId, pathwayName);
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  /**
   * Download pathway progress as CSV.
   */
  downloadProgressCSV(pathwayId, pathwayName) {
    const data = this._progressData;
    if (!data || !data.users) { toast('No data to export', 'error'); return; }

    let csv = 'Name,Modules Complete,Total Modules,Percentage,Started,Completed\n';
    data.users.forEach(u => {
      csv += `"${u.name}",${u.modulesComplete},${u.totalModules},${u.pct}%,`;
      csv += `${u.startedAt ? new Date(u.startedAt).toLocaleDateString() : ''},`;
      csv += `${u.completedAt ? new Date(u.completedAt).toLocaleDateString() : ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pathwayName.replace(/[^a-zA-Z0-9]/g, '_')}_progress.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded');
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
    let pathwayOpts = '';
    try {
      const pd = await API.getPathways();
      pathwayOpts = pd.pathways.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    } catch(e) {}
    const roleOpts = Auth.hasRole('superuser')
      ? '<option value="rep">Rep</option><option value="manager">Manager</option><option value="ld_manager">LD Manager</option>'
      : Auth.hasRole('ld_manager')
        ? '<option value="rep">Rep</option><option value="manager">Manager</option>'
        : '<option value="rep">Rep</option>';
    const body = `
      <div class="modal-field"><label>Username</label><input type="text" id="cuUsername"></div>
      <div class="modal-field"><label>First Name</label><input type="text" id="cuFirst"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="cuLast"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="cuEmail"></div>
      <div class="modal-field"><label>Password</label><div class="pw-field" style="position:relative"><input type="password" id="cuPass" style="width:100%;padding-right:44px"><button type="button" class="pw-eye" style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:44px;height:44px;background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;opacity:.5" onclick="togglePwVis('cuPass',this)">&#128065;</button></div></div>
      <div class="modal-field"><label>Role</label>
        <select id="cuRole">${roleOpts}</select>
      </div>
      <div class="modal-field"><label>Pathways</label>
        <select id="cuPathways" multiple size="4" style="min-height:80px">
          ${pathwayOpts}
        </select>
        <div style="font-size:.75rem;color:var(--gray);margin-top:4px">Hold Ctrl/Cmd to select multiple</div>
      </div>
      <div id="cuError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.createUser()">Create User</button>`;
    this.showModal('Create User', body);
  },

  async createUser() {
    const errorEl = document.getElementById('cuError');
    try {
      const pathwaySelect = document.getElementById('cuPathways');
      const pathwayIds = Array.from(pathwaySelect.selectedOptions).map(o => parseInt(o.value));
      await API.createUser({
        username: document.getElementById('cuUsername').value,
        firstName: document.getElementById('cuFirst').value,
        lastName: document.getElementById('cuLast').value,
        email: document.getElementById('cuEmail').value,
        password: document.getElementById('cuPass').value,
        role: document.getElementById('cuRole').value,
        pathwayIds
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
    const userPathwayIds = (u.pathways || []).map(p => p.id);

    // Fetch pathways for multi-select
    let pathwayOpts = '';
    try {
      const pd = await API.getPathways();
      pathwayOpts = pd.pathways.map(p => `<option value="${p.id}"${userPathwayIds.includes(p.id) ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    } catch(e) {}

    const isLdManager = Auth.hasRole('ld_manager');
    const canChangeRole = (isSuperuser || isLdManager) && u.role !== 'superuser' && id !== Auth.user.id;
    let roleSelect = '';
    if (canChangeRole) {
      const roleOpts = isSuperuser
        ? `<option value="rep"${u.role==='rep'?' selected':''}>Rep</option><option value="manager"${u.role==='manager'?' selected':''}>Manager</option><option value="ld_manager"${u.role==='ld_manager'?' selected':''}>LD Manager</option>`
        : `<option value="rep"${u.role==='rep'?' selected':''}>Rep</option><option value="manager"${u.role==='manager'?' selected':''}>Manager</option>`;
      roleSelect = `<div class="modal-field"><label>Role</label><select id="euRole">${roleOpts}</select></div>`;
    }

    const body = `
      <div class="modal-field"><label>First Name</label><input type="text" id="euFirst" value="${esc(u.firstName || '')}"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="euLast" value="${esc(u.lastName || '')}"></div>
      <div class="modal-field"><label>Nickname</label><input type="text" id="euNick" value="${esc(u.nickname || '')}"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="euEmail" value="${esc(u.email || '')}"></div>
      ${roleSelect}
      <div class="modal-field"><label>Pathways</label>
        <select id="euPathways" multiple size="4" style="min-height:80px">
          ${pathwayOpts}
        </select>
        <div style="font-size:.75rem;color:var(--gray);margin-top:4px">Hold Ctrl/Cmd to select multiple</div>
      </div>

      <div id="euError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.editUser(${id})">Save Changes</button>`;
    this.showModal('Edit User', body);
  },

  async editUser(id) {
    const errorEl = document.getElementById('euError');
    try {
      const pathwaySelect = document.getElementById('euPathways');
      const pathwayIds = Array.from(pathwaySelect.selectedOptions).map(o => parseInt(o.value));
      const data = {
        firstName: document.getElementById('euFirst').value,
        lastName: document.getElementById('euLast').value,
        nickname: document.getElementById('euNick').value,
        email: document.getElementById('euEmail').value,
        pathwayIds
      };
      // Include role if the dropdown exists
      const roleEl = document.getElementById('euRole');
      if (roleEl) data.role = roleEl.value;

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

  showCreatePathway() {
    let body = '';

    // Mode toggle: Empty vs From Existing
    body += '<div class="pathway-create-mode" style="display:flex;gap:8px;margin-bottom:16px">';
    body += '<button class="pathway-filter-pill active" id="cpModeEmpty" onclick="Admin._setCreateMode(\'empty\')">Empty</button>';
    body += '<button class="pathway-filter-pill" id="cpModeClone" onclick="Admin._setCreateMode(\'clone\')">From Existing</button>';
    body += '</div>';

    body += '<div class="modal-field"><label>Pathway Name</label><input type="text" id="cpName"></div>';
    body += '<div class="modal-field"><label>Description</label><textarea id="cpDesc" rows="3"></textarea></div>';

    // Clone source (hidden by default)
    body += '<div id="cpCloneSection" style="display:none">';
    body += '<div class="modal-field"><label>Clone From</label><select id="cpCloneSource">';
    body += '<option value="">Select a pathway...</option>';
    if (this._allPathways) {
      this._allPathways.forEach(p => {
        body += `<option value="${p.id}">${esc(p.name)}</option>`;
      });
    }
    body += '</select></div>';
    body += '<div style="font-size:var(--fs-xs);color:var(--gray);margin-top:-8px;margin-bottom:16px">Module assignments will be copied from the selected pathway.</div>';
    body += '</div>';

    body += '<div id="cpError" class="modal-error"></div>';
    body += '<button class="modal-submit" onclick="Admin.createPathway()">Create Pathway</button>';
    this.showModal('Create Pathway', body);
    this._createMode = 'empty';
  },

  _setCreateMode(mode) {
    this._createMode = mode;
    const emptyBtn = document.getElementById('cpModeEmpty');
    const cloneBtn = document.getElementById('cpModeClone');
    const cloneSection = document.getElementById('cpCloneSection');
    if (mode === 'empty') {
      emptyBtn.classList.add('active');
      cloneBtn.classList.remove('active');
      cloneSection.style.display = 'none';
    } else {
      emptyBtn.classList.remove('active');
      cloneBtn.classList.add('active');
      cloneSection.style.display = 'block';
    }
  },

  async createPathway() {
    const errorEl = document.getElementById('cpError');
    try {
      const result = await API.createPathway(document.getElementById('cpName').value, document.getElementById('cpDesc').value);

      // If cloning, copy module assignments from source
      if (this._createMode === 'clone') {
        const sourceId = document.getElementById('cpCloneSource').value;
        if (sourceId) {
          const sourceData = await API.getPathwayModules(parseInt(sourceId));
          const moduleIds = sourceData.assigned.map(m => m.id);
          if (moduleIds.length > 0) {
            await API.updatePathwayModules(result.id, moduleIds);
          }
        }
      }

      this.closeModal();
      await this.renderPathways();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  async showAssignPathway(pathwayId, pathwayName) {
    this.showModal(`Assign Users to "${pathwayName}"`, '<div class="admin-loading">Loading users...</div>');
    try {
      const data = await API.getUsers();
      const users = data.users.filter(u => u.role === 'rep' || u.role === 'manager');

      let body = '<div style="font-size:var(--fs-sm);color:var(--gray);margin-bottom:16px">Select users to assign to this pathway.</div>';
      body += '<div style="max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">';

      users.forEach(u => {
        const isAssigned = (u.pathways || []).some(p => p.pathway_id === pathwayId);
        body += `<label class="builder-item" style="cursor:pointer">`;
        body += `<input type="checkbox" class="pathway-assign-cb" data-userid="${u.id}" ${isAssigned ? 'checked' : ''} style="margin-right:8px">`;
        body += `<span class="builder-item-title">${esc(u.firstName)} ${esc(u.lastName)}</span>`;
        body += `<span class="role-badge role-${u.role}" style="margin-left:auto">${u.role}</span>`;
        body += '</label>';
      });

      body += '</div>';
      body += `<button class="modal-submit" onclick="Admin.savePathwayAssignments(${pathwayId})">Save Assignments</button>`;

      const modalBody = document.querySelector('.modal-body');
      if (modalBody) modalBody.innerHTML = body;
    } catch (err) {
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) modalBody.innerHTML = `<div class="admin-error">${esc(err.message)}</div>`;
    }
  },

  async savePathwayAssignments(pathwayId) {
    const checkboxes = document.querySelectorAll('.pathway-assign-cb');
    try {
      // Fetch users once, build lookup map
      const userData = await API.getUsers();
      const userMap = {};
      userData.users.forEach(u => { userMap[u.id] = u; });

      for (const cb of checkboxes) {
        const userId = parseInt(cb.dataset.userid);
        const user = userMap[userId];
        if (!user) continue;

        const currentIds = (user.pathways || []).map(p => p.pathway_id);
        const isCurrentlyAssigned = currentIds.includes(pathwayId);

        if (cb.checked && !isCurrentlyAssigned) {
          await API.updateUserPathways(userId, [...currentIds, pathwayId]);
        } else if (!cb.checked && isCurrentlyAssigned) {
          await API.updateUserPathways(userId, currentIds.filter(id => id !== pathwayId));
        }
      }
      this.closeModal();
      toast('Pathway assignments updated');
      await this.renderPathways();
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  /**
   * Full-page Pathway Builder (LearnDash-style).
   * Renders into #adminContent with breadcrumb + history.pushState.
   */
  async showEditPathway(pathwayId) {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading" aria-busy="true">Loading pathway...</div>';

    // Push history so browser back works
    history.pushState({ view: 'pathwayBuilder', id: pathwayId }, '', '');

    try {
      // Load pathway details and modules in parallel
      const [pathways, modData] = await Promise.all([
        API.getPathways(),
        API.getPathwayModules(pathwayId)
      ]);
      const pw = pathways.pathways.find(p => p.id === pathwayId);
      if (!pw) throw new Error('Pathway not found');

      // Store builder state
      this._builderPathwayId = pathwayId;
      this._builderPathway = pw;
      this._builderAssigned = modData.assigned.map(m => m.id);
      this._builderModules = {};
      this._expandedModules = new Set();
      this._showAvailable = false;
      modData.assigned.forEach(m => { this._builderModules[m.id] = m; });
      modData.available.forEach(m => { this._builderModules[m.id] = m; });

      this._renderBuilderPage();
    } catch (err) {
      content.innerHTML = `<div class="admin-error">Unable to load pathway: ${esc(err.message)}</div>`;
    }
  },

  /**
   * Navigate back to pathways list.
   */
  backToPathways() {
    history.back();
  },

  /**
   * Handle popstate — restore pathways list.
   */
  _handlePopState(e) {
    if (e.state && e.state.view === 'pathwayBuilder') {
      // Forward navigation to builder — re-open it
      Admin.showEditPathway(e.state.id);
    } else {
      // Back to list
      const container = document.getElementById('adminBody');
      if (container && Admin.currentTab === 'pathways') {
        Admin.render(container);
      }
    }
  },

  /**
   * Render the full builder page into #adminContent.
   */
  _renderBuilderPage() {
    const content = document.getElementById('adminContent');
    const pw = this._builderPathway;

    // Preserve field values if re-rendering
    const nameEl = document.getElementById('epName');
    const descEl = document.getElementById('epDesc');
    const curName = nameEl ? nameEl.value : pw.name;
    const curDesc = descEl ? descEl.value : (pw.description || '');

    let h = '';

    // ─── Breadcrumb ───
    h += '<div class="pb-breadcrumb">';
    h += '<a onclick="Admin.backToPathways()">← Back to Pathways</a>';
    h += `<span>/ ${esc(curName)}</span>`;
    h += '</div>';

    // ─── Header: Name, Description, Active ───
    h += '<div class="pb-header">';
    h += `<div class="modal-field"><label>Pathway Name</label><input type="text" id="epName" value="${esc(curName)}" aria-label="Pathway name"></div>`;
    h += `<div class="modal-field"><label>Description</label><textarea id="epDesc" rows="2" aria-label="Description">${esc(curDesc)}</textarea></div>`;
    h += '<div class="pb-header-row">';
    h += '</div>';
    h += '<div id="epError" class="pb-error"></div>';
    h += '</div>';

    // ─── Toolbar ───
    h += '<div class="pb-toolbar">';
    h += '<button class="pb-toolbar-btn" onclick="Admin._builderSort()" title="Sort: Onboarding → Upskilling, then by phase">⇅ Auto-Sort</button>';
    h += '</div>';

    // ─── Module List ───
    h += this._buildBuilderHTML();

    // ─── Footer ───
    const count = this._builderAssigned.length;
    h += '<div class="pb-footer">';
    h += `<span class="pb-count">${count} module${count !== 1 ? 's' : ''} assigned</span>`;
    h += `<button class="pb-save-btn" id="builderSaveBtn" onclick="Admin.editPathway(${this._builderPathwayId})">Save Pathway</button>`;
    h += '</div>';

    content.innerHTML = h;

    // Set up drag and drop
    this._setupDragDrop();
  },

  /**
   * Build the single-column module list HTML (LearnDash-style).
   */
  _buildBuilderHTML() {
    const assigned = this._builderAssigned;
    let h = '<div class="pb-modules" id="pbModuleList">';

    if (assigned.length === 0) {
      h += '<div style="text-align:center;padding:48px 16px;color:var(--gray)">';
      h += '<div style="font-size:24px;margin-bottom:8px">📚</div>';
      h += '<div style="font-size:var(--fs-sm)">No modules assigned yet.</div>';
      h += '<div style="font-size:var(--fs-xs);margin-top:4px">Click "+ Add Module" below to start building.</div>';
      h += '</div>';
    } else {
      assigned.forEach((id, i) => {
        const m = this._builderModules[id];
        if (!m) return;
        const track = m.track || 'onboarding';
        const isReq = m.isRequired !== false;
        const isExpanded = this._expandedModules.has(id);

        h += `<div class="pb-module${isExpanded ? ' expanded' : ''}" data-module-id="${esc(id)}" draggable="true">`;

        // Module header row
        h += '<div class="pb-module-row">';
        h += `<span class="pb-drag-handle" aria-label="Drag to reorder" title="Drag to reorder">⸬</span>`;
        h += `<span class="pb-track-dot ${track}"></span>`;
        h += `<span class="pb-module-icon">${m.icon || '📘'}</span>`;
        h += `<span class="pb-module-title">${esc(m.title)}</span>`;
        h += '<span class="pb-module-meta">';
        h += `<span class="pb-phase-pill">P${m.phase || 1}</span>`;
        h += `<span class="pb-req-badge ${isReq ? 'req' : 'opt'}" onclick="event.stopPropagation();Admin._builderToggleRequired('${esc(id)}')" title="Click to toggle" style="cursor:pointer">${isReq ? 'Req' : 'Opt'}</span>`;
        h += '</span>';
        h += `<span class="pb-chevron${isExpanded ? ' open' : ''}" aria-expanded="${isExpanded}" onclick="Admin._toggleModule('${esc(id)}')">▶</span>`;
        h += `<button class="pb-remove-btn" onclick="event.stopPropagation();Admin._builderRemove('${esc(id)}')" aria-label="Remove ${esc(m.title)} from pathway" title="Remove">✕</button>`;
        h += '</div>';

        // Expandable body
        h += '<div class="pb-module-body">';
        if (m.description) {
          h += `<div class="pb-module-desc">${esc(m.description)}</div>`;
        }
        // Show content items if we have them
        h += '<div class="pb-content-list">';
        if (m.videoUrl) h += `<div class="pb-content-item"><span class="pb-content-item-icon">🎬</span><span class="pb-content-item-title">Video</span></div>`;
        if (m.docUrl) h += `<div class="pb-content-item"><span class="pb-content-item-icon">📖</span><span class="pb-content-item-title">Document</span></div>`;
        if (m.gameTypes && m.gameTypes.length) {
          m.gameTypes.forEach(g => {
            h += `<div class="pb-content-item"><span class="pb-content-item-icon">🎮</span><span class="pb-content-item-title">${esc(g)}</span></div>`;
          });
        }
        if (!m.videoUrl && !m.docUrl && (!m.gameTypes || !m.gameTypes.length)) {
          h += '<div style="color:var(--gray);font-size:var(--fs-xs)">No content configured. Edit this module in the Modules tab.</div>';
        }
        h += '</div>';
        h += '</div>';

        h += '</div>';
      });
    }

    h += '</div>';

    // Add Module button
    if (this._showAvailable) {
      h += this._buildAvailableDropdown();
    } else {
      h += '<button class="pb-add-module" onclick="Admin._toggleAvailableModules()">➕ Add Module</button>';
    }

    return h;
  },

  /**
   * Build the available modules dropdown for adding.
   */
  _buildAvailableDropdown() {
    const assigned = this._builderAssigned;
    const allIds = Object.keys(this._builderModules);
    const availableIds = allIds.filter(id => !assigned.includes(id));

    let h = '<div class="pb-available-dropdown">';
    h += '<button class="pb-add-module" onclick="Admin._toggleAvailableModules()" style="border-color:var(--blue)">➖ Close</button>';

    if (availableIds.length === 0) {
      h += '<div style="text-align:center;padding:16px;color:var(--gray);font-size:var(--fs-sm)">All modules are assigned.</div>';
    } else {
      h += '<div class="pb-available-list">';
      availableIds.forEach(id => {
        const m = this._builderModules[id];
        h += `<div class="pb-available-item" onclick="Admin._builderAdd('${esc(id)}')">`;
        h += `<span class="pb-available-item-icon">${m.icon || '📘'}</span>`;
        h += `<span>${esc(m.title)}</span>`;
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  },

  /**
   * Render builder page in-place (preserves form values).
   */
  _renderBuilderBody() {
    this._renderBuilderPage();
  },

  /**
   * Toggle available modules list.
   */
  _toggleAvailableModules() {
    this._showAvailable = !this._showAvailable;
    this._renderBuilderPage();
  },

  /**
   * Toggle module expand/collapse.
   */
  _toggleModule(moduleId) {
    if (this._expandedModules.has(moduleId)) {
      this._expandedModules.delete(moduleId);
    } else {
      this._expandedModules.add(moduleId);
    }
    this._renderBuilderPage();
  },

  /**
   * Set up HTML5 drag and drop on module rows.
   */
  _setupDragDrop() {
    const list = document.getElementById('pbModuleList');
    if (!list) return;

    let draggedId = null;

    list.querySelectorAll('.pb-module[draggable]').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        draggedId = el.dataset.moduleId;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        list.querySelectorAll('.pb-module').forEach(m => m.classList.remove('drag-over'));
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = el.dataset.moduleId;
        if (draggedId && draggedId !== targetId) {
          const fromIdx = Admin._builderAssigned.indexOf(draggedId);
          const toIdx = Admin._builderAssigned.indexOf(targetId);
          if (fromIdx !== -1 && toIdx !== -1) {
            // Optimistic reorder
            const item = Admin._builderAssigned.splice(fromIdx, 1)[0];
            Admin._builderAssigned.splice(toIdx, 0, item);
            Admin._renderBuilderPage();
          }
        }
        draggedId = null;
      });
    });
  },

  /**
   * Combined save: updates pathway details AND module assignments,
   * then navigates back to pathways list.
   */
  async editPathway(id) {
    const errorEl = document.getElementById('epError');
    const saveBtn = document.getElementById('builderSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    try {
      // Save details
      const name = document.getElementById('epName').value;
      const desc = document.getElementById('epDesc').value;
      await API.updatePathway(id, name, desc);
      // Save module assignments
      const moduleEntries = this._builderAssigned.map(mid => ({
        id: mid,
        isRequired: this._builderModules[mid]?.isRequired !== false
      }));
      await API.updatePathwayModulesWithRequired(id, moduleEntries);
      toast('Pathway saved');
      // Navigate back to pathways
      this.currentTab = 'pathways';
      const container = document.getElementById('adminBody');
      if (container) await this.render(container);
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Pathway'; }
    }
  },

  // ─── BUILDER HELPERS ───

  _builderAdd(moduleId) {
    if (!this._builderAssigned.includes(moduleId)) {
      this._builderAssigned.push(moduleId);
      if (this._builderModules[moduleId]) this._builderModules[moduleId].isRequired = true;
      this._showAvailable = false;
      this._renderBuilderPage();
    }
  },

  _builderRemove(moduleId) {
    this._builderAssigned = this._builderAssigned.filter(id => id !== moduleId);
    this._expandedModules.delete(moduleId);
    this._renderBuilderPage();
  },

  _builderMove(fromIdx, toIdx) {
    const arr = this._builderAssigned;
    const item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    this._renderBuilderPage();
  },

  _builderToggleRequired(moduleId) {
    if (this._builderModules[moduleId]) {
      this._builderModules[moduleId].isRequired = !this._builderModules[moduleId].isRequired;
      this._renderBuilderPage();
    }
  },

  _builderSort() {
    const trackOrder = { onboarding: 0, upskilling: 1 };
    this._builderAssigned.sort((a, b) => {
      const ma = this._builderModules[a];
      const mb = this._builderModules[b];
      const ta = trackOrder[ma.track || 'onboarding'] || 0;
      const tb = trackOrder[mb.track || 'onboarding'] || 0;
      if (ta !== tb) return ta - tb;
      return (ma.phase || 1) - (mb.phase || 1);
    });
    this._renderBuilderPage();
  },

  async savePathwayModules() {
    // Legacy — now handled by editPathway
    await this.editPathway(this._builderPathwayId);
  },

  // ─── CONTENT TAB (CMS) ───

  async renderContent() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading content...</div>';

    try {
      const [data, gamesData, chatbotsData] = await Promise.all([
        API.getModules(),
        API.getGames(),
        API.getChatbots()
      ]);

      // Cache games for module editor picker
      this._gamesCache = gamesData.games || [];

      let h = '<div class="cms-content">';

      // Module list
      h += '<div class="cms-modules-list">';
      data.forEach((m, i) => {
        h += `<div class="cms-module-card" onclick="Admin.editModule('${m.id}')">`;
        h += `<span class="cms-mod-icon">${m.icon || '📋'}</span>`;
        h += `<div class="cms-mod-info"><strong>${m.title}</strong><span class="cms-mod-phase">${m.track === 'upskilling' ? '🟠' : '🟢'} Phase ${m.phase}</span></div>`;
        h += '<span class="cms-mod-arrow">›</span>';
        h += '</div>';
      });
      h += '</div>';

      // Quiz section
      h += '<div style="margin-top:24px">';
      h += '<button class="admin-action-btn" onclick="Admin.editQuizzes()">📝 Edit Quiz Questions</button>';
      h += '</div>';

      // ── Game Library ──
      const games = gamesData.games || [];
      h += '<div class="library-section">';
      h += '<div class="library-section-header">';
      h += `<span class="library-section-title">🎮 Game Library (${games.length})</span>`;
      h += '</div>';
      if (games.length === 0) {
        h += '<div class="builder-empty">No games available.</div>';
      } else {
        h += '<div class="library-cards">';
        games.forEach(g => {
          h += '<div class="library-card">';
          h += `<span class="library-card-icon">${g.icon || '🎮'}</span>`;
          h += '<div class="library-card-info">';
          h += `<strong>${esc(g.title)}</strong>`;
          h += `<p>${esc(g.description || 'No description')}</p>`;
          h += '</div>';
          if (g.skill_area) h += `<span class="library-card-badge">${esc(g.skill_area)}</span>`;
          h += '</div>';
        });
        h += '</div>';
      }
      h += '</div>';

      // ── Chatbot Library ──
      const chatbots = chatbotsData.chatbots || [];
      h += '<div class="library-section">';
      h += '<div class="library-section-header">';
      h += `<span class="library-section-title">🤖 Chatbot Library (${chatbots.length})</span>`;
      h += '</div>';
      if (chatbots.length === 0) {
        h += '<div class="builder-empty">No chatbots configured yet.</div>';
      } else {
        h += '<div class="library-cards">';
        chatbots.forEach(c => {
          h += '<div class="library-card">';
          h += `<span class="library-card-icon">${c.icon || '🤖'}</span>`;
          h += '<div class="library-card-info">';
          h += `<strong>${esc(c.title)}</strong>`;
          h += `<p>${esc(c.description || 'No description')}</p>`;
          h += '</div>';
          if (c.category) h += `<span class="library-card-badge">${esc(c.category)}</span>`;
          h += '</div>';
        });
        h += '</div>';
      }
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
      body += `<div class="modal-field"><label>Track</label><select id="cmTrack"><option value="onboarding"${(m.track||'onboarding')==='onboarding'?' selected':''}>🟢 Onboarding</option><option value="upskilling"${m.track==='upskilling'?' selected':''}>🟠 Upskilling</option></select></div>`;
      // Game picker (dropdown from cms_games library)
      body += '<div class="modal-field"><label>Game</label><select id="cmGameSelect" onchange="Admin._onGameSelect()">';
      body += '<option value="">None (no game)</option>';
      (this._gamesCache || []).forEach(g => {
        const sel = (m.game_id === g.id) ? ' selected' : '';
        body += `<option value="${g.id}" data-title="${this.esc(g.title)}" data-desc="${this.esc(g.description || '')}"${sel}>${g.icon || '🎮'} ${this.esc(g.title)}</option>`;
      });
      body += '</select></div>';
      body += `<input type="hidden" id="cmGameId" value="${m.game_id || ''}">`;
      body += `<input type="hidden" id="cmGameTitle" value="${this.esc(m.game_title || '')}">`;
      body += `<input type="hidden" id="cmGameDesc" value="${this.esc(m.game_desc || '')}">`;
      body += `<div id="cmGamePreview" style="font-size:var(--fs-xs);color:var(--gray);margin-top:-8px;margin-bottom:12px">${m.game_id ? m.game_title + ' — ' + (m.game_desc || '').substring(0, 80) : 'No game assigned'}</div>`;
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

  _onGameSelect() {
    const sel = document.getElementById('cmGameSelect');
    const opt = sel.options[sel.selectedIndex];
    const id = sel.value;
    const title = opt?.dataset?.title || '';
    const desc = opt?.dataset?.desc || '';
    document.getElementById('cmGameId').value = id;
    document.getElementById('cmGameTitle').value = title;
    document.getElementById('cmGameDesc').value = desc;
    const preview = document.getElementById('cmGamePreview');
    if (preview) preview.textContent = id ? title + ' — ' + desc.substring(0, 80) : 'No game assigned';
  },

  async saveModule(id) {
    const errorEl = document.getElementById('cmError');
    try {
      await API.updateModule(id, {
        title: document.getElementById('cmTitle').value,
        description: document.getElementById('cmDesc').value,
        icon: document.getElementById('cmIcon').value,
        phase: parseInt(document.getElementById('cmPhase').value),
        track: document.getElementById('cmTrack').value,
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
