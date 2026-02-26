/**
 * Admin Panel UI for ROC Academy.
 * User management, team management, rep progress viewing.
 * Only accessible to manager and superuser roles.
 */

const Admin = {
  currentTab: 'users',
  _editCache: null, // Stores module data for pre-filling edit forms

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
    h += `<button class="admin-tab${this.currentTab === 'content' ? ' active' : ''}" onclick="Admin.switchTab('content')">Content</button>`;
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
        game_title: document.getElementById('cmGameTitle').value
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
