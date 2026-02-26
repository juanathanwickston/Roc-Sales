/**
 * Admin Panel UI for ROC Academy.
 * User management, team management, rep progress viewing.
 * Only accessible to manager and superuser roles.
 */

const Admin = {
  currentTab: 'users',

  /**
   * Render the admin panel.
   */
  async render(container) {
    if (!Auth.hasRole('manager')) {
      container.innerHTML = '<div class="admin-denied">Access denied</div>';
      return;
    }

    let h = '<div class="admin-tabs">';
    h += `<button class="admin-tab${this.currentTab === 'users' ? ' active' : ''}" onclick="Admin.switchTab('users')">Users</button>`;
    h += `<button class="admin-tab${this.currentTab === 'teams' ? ' active' : ''}" onclick="Admin.switchTab('teams')">Teams</button>`;
    h += '</div>';
    h += '<div id="adminContent"></div>';
    container.innerHTML = h;

    if (this.currentTab === 'users') {
      await this.renderUsers();
    } else {
      await this.renderTeams();
    }
  },

  async switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('adminBody');
    if (container) await this.render(container);
  },

  // ─── USERS TAB ───

  async renderUsers() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading">Loading users...</div>';

    try {
      const data = await API.getUsers(true);
      let h = '';

      // Create user button
      h += '<button class="admin-action-btn" onclick="Admin.showCreateUser()">+ Create User</button>';

      // Users table
      h += '<div class="admin-table-wrap"><table class="admin-table">';
      h += '<thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Team</th><th>Status</th><th>Actions</th></tr></thead>';
      h += '<tbody>';

      data.users.forEach(u => {
        const status = u.isActive ? 'Active' : 'Inactive';
        const statusClass = u.isActive ? 'status-active' : 'status-inactive';
        h += '<tr>';
        h += `<td>${u.firstName} ${u.lastName}</td>`;
        h += `<td>${u.username}</td>`;
        h += `<td><span class="role-badge role-${u.role}">${u.role}</span></td>`;
        h += `<td>${u.teamName || '-'}</td>`;
        h += `<td><span class="${statusClass}">${status}</span></td>`;
        h += '<td class="admin-actions">';
        if (u.role !== 'superuser') {
          h += `<button class="admin-btn" onclick="Admin.showEditUser(${u.id})">Edit</button>`;
          h += `<button class="admin-btn" onclick="Admin.showResetPassword(${u.id})">Reset PW</button>`;
          h += `<button class="admin-btn" onclick="Admin.showUserProgress(${u.id})"">Progress</button>`;
        }
        h += '</td>';
        h += '</tr>';
      });

      h += '</tbody></table></div>';
      content.innerHTML = h;
    } catch (err) {
      content.innerHTML = `<div class="admin-error">${err.message}</div>`;
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

  showCreateUser() {
    const body = `
      <div class="modal-field"><label>Username</label><input type="text" id="cuUsername"></div>
      <div class="modal-field"><label>First Name</label><input type="text" id="cuFirst"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="cuLast"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="cuEmail"></div>
      <div class="modal-field"><label>Password</label><input type="password" id="cuPass"></div>
      <div class="modal-field"><label>Role</label>
        <select id="cuRole">
          <option value="rep">Rep</option>
          ${Auth.hasRole('superuser') ? '<option value="manager">Manager</option>' : ''}
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
        role: document.getElementById('cuRole').value
      });
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  showEditUser(id) {
    const body = `
      <div class="modal-field"><label>First Name</label><input type="text" id="euFirst"></div>
      <div class="modal-field"><label>Last Name</label><input type="text" id="euLast"></div>
      <div class="modal-field"><label>Nickname</label><input type="text" id="euNick"></div>
      <div class="modal-field"><label>Email</label><input type="email" id="euEmail"></div>
      <div class="modal-field">
        <label><input type="checkbox" id="euActive" checked> Active</label>
      </div>
      <div id="euError" class="modal-error"></div>
      <button class="modal-submit" onclick="Admin.editUser(${id})">Save Changes</button>`;
    this.showModal('Edit User', body);
  },

  async editUser(id) {
    const errorEl = document.getElementById('euError');
    try {
      await API.updateUser(id, {
        firstName: document.getElementById('euFirst').value,
        lastName: document.getElementById('euLast').value,
        nickname: document.getElementById('euNick').value,
        email: document.getElementById('euEmail').value,
        isActive: document.getElementById('euActive').checked
      });
      this.closeModal();
      await this.renderUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  },

  showResetPassword(id) {
    const body = `
      <div class="modal-field"><label>New Password (min 8 chars)</label><input type="password" id="rpPass"></div>
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
      <div class="modal-field"><label>Team Name</label><input type="text" id="etName" value="${currentName}"></div>
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
  }
};
