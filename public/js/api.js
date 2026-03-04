/**
 * API client for ROC Academy.
 * Centralized fetch wrapper for all backend communication.
 * Handles token management, error responses, and offline detection.
 */

// ─── SHARED SECURITY HELPERS ───
// Loaded first (api.js) so all other scripts can use them.

/**
 * Escape HTML entities in user-sourced strings (names, nicknames, etc.)
 * Prevents XSS when inserting via innerHTML/template literals.
 */
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * Sanitize HTML from CMS content — allows safe formatting tags,
 * strips everything else (scripts, event handlers, iframes, etc.)
 * Used for doc body content that contains intentional <b>, <br>, <ul> tags.
 */
function sanitizeHTML(html) {
  if (!html) return '';
  const ALLOWED_TAGS = ['B', 'BR', 'UL', 'LI', 'OL', 'P', 'STRONG', 'EM'];
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Remove all script/style/iframe elements
  temp.querySelectorAll('script, style, iframe, object, embed, form, input, textarea, link').forEach(el => el.remove());
  // Remove event handler attributes from all elements
  temp.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
    // Remove disallowed tags but keep their text content
    if (!ALLOWED_TAGS.includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
    }
  });
  return temp.innerHTML;
}

/**
 * Toast notification system — global, auto-dismiss alerts.
 * Usage: toast('Saved!') or toast('Error occurred', 'error')
 * Types: 'success' (default), 'error', 'info'
 */
function toast(msg, type = 'success', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { success: '#00e0b8', error: '#FF4466', info: '#3B82F6' };
  const bgMap = { success: '#00e0b8', error: '#FF4466', info: '#3B82F6' };
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.style.cssText = `pointer-events:auto;padding:12px 20px;border-radius:12px;background:rgba(15,27,50,0.95);border:1px solid ${colors[type] || colors.success};color:#EDF2FF;font-size:.85rem;font-family:var(--font);backdrop-filter:blur(12px);transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.4);`;
  el.innerHTML = `<span style="margin-right:8px">${icons[type] || icons.success}</span>${esc(msg)}`;
  container.appendChild(el);
  requestAnimationFrame(() => el.style.transform = 'translateX(0)');
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

const API = {
  baseUrl: '/api',

  /**
   * Get stored auth token.
   */
  getToken() {
    return localStorage.getItem('roc_token');
  },

  /**
   * Store auth token.
   */
  setToken(token) {
    localStorage.setItem('roc_token', token);
  },

  /**
   * Clear auth token.
   */
  clearToken() {
    localStorage.removeItem('roc_token');
  },

  /**
   * Core request method. All API calls flow through this.
   */
  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, options);
    } catch (err) {
      throw new Error('Unable to reach server. Check your connection.');
    }

    const data = await response.json();

    if (!response.ok) {
      // Session expired or invalidated
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login.html';
        return;
      }
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  // ─── AUTH ───

  async login(username, password) {
    const data = await this.request('POST', '/auth/login', { username, password });
    if (data && data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async getProfile() {
    return this.request('GET', '/auth/me');
  },

  async changePassword(currentPassword, newPassword) {
    return this.request('POST', '/auth/change-password', { currentPassword, newPassword });
  },

  logout() {
    this.clearToken();
    localStorage.removeItem('openai_api_key');
    localStorage.removeItem('roc_chat_state');
    window.location.href = '/login.html';
  },

  // ─── PROGRESS ───

  async getProgress() {
    return this.request('GET', '/progress');
  },

  async saveProgress(moduleId, activityType, status) {
    return this.request('PUT', '/progress', { moduleId, activityType, status });
  },

  async saveChecklist(moduleId, itemIndex, checked) {
    return this.request('PUT', '/progress/checklist', { moduleId, itemIndex, checked });
  },

  // ─── SCORES ───

  async submitScore(activityType, activityId, score, maxScore, details) {
    return this.request('POST', '/scores', { activityType, activityId, score, maxScore, details });
  },

  async getMyScores() {
    return this.request('GET', '/scores/my');
  },

  async getLeaderboard(period) {
    const param = period ? `?period=${period}` : '';
    return this.request('GET', `/scores/leaderboard${param}`);
  },

  // ─── PROFILE ───

  async updateNickname(nickname) {
    return this.request('PUT', '/profile/nickname', { nickname });
  },

  // ─── ADMIN ───

  async getUsers(all) {
    const param = all ? '?all=1' : '';
    return this.request('GET', `/admin/users${param}`);
  },

  async createUser(userData) {
    return this.request('POST', '/admin/users', userData);
  },

  async updateUser(id, data) {
    return this.request('PUT', `/admin/users/${id}`, data);
  },

  async resetPassword(id, newPassword) {
    return this.request('POST', `/admin/users/${id}/reset-password`, { newPassword });
  },

  async getUserProgress(id) {
    return this.request('GET', `/admin/users/${id}/progress`);
  },

  async getPathways() {
    return this.request('GET', '/admin/pathways');
  },

  async createPathway(name, description) {
    return this.request('POST', '/admin/pathways', { name, description });
  },

  async updatePathway(id, name, description, isActive) {
    return this.request('PUT', `/admin/pathways/${id}`, { name, description, isActive });
  },

  async updateUserPathways(userId, pathwayIds) {
    return this.request('PUT', '/admin/user-pathways', { userId, pathwayIds });
  },

  async getPathwayModules(pathwayId) {
    return this.request('GET', `/admin/pathways/${pathwayId}/modules`);
  },

  async updatePathwayModules(pathwayId, moduleIds) {
    return this.request('PUT', `/admin/pathways/${pathwayId}/modules`, { moduleIds });
  },

  // ─── CMS (Content Management) ───

  async getModules() {
    return this.request('GET', '/cms/modules');
  },

  async getQuizPool(pool) {
    const param = pool ? `?pool=${pool}` : '';
    return this.request('GET', `/cms/quizzes${param}`);
  },

  // CMS Admin
  async getModuleAdmin(id) {
    return this.request('GET', `/cms/modules/${id}`);
  },

  async updateModule(id, data) {
    return this.request('PUT', `/cms/modules/${id}`, data);
  },

  async createModule(data) {
    return this.request('POST', '/cms/modules', data);
  },

  async createVideo(data) {
    return this.request('POST', '/cms/videos', data);
  },

  async updateVideo(id, data) {
    return this.request('PUT', `/cms/videos/${id}`, data);
  },

  async deleteVideo(id) {
    return this.request('DELETE', `/cms/videos/${id}`);
  },

  async createDoc(data) {
    return this.request('POST', '/cms/docs', data);
  },

  async updateDoc(id, data) {
    return this.request('PUT', `/cms/docs/${id}`, data);
  },

  async deleteDoc(id) {
    return this.request('DELETE', `/cms/docs/${id}`);
  },

  async createApplyItem(data) {
    return this.request('POST', '/cms/apply-items', data);
  },

  async updateApplyItem(id, data) {
    return this.request('PUT', `/cms/apply-items/${id}`, data);
  },

  async deleteApplyItem(id) {
    return this.request('DELETE', `/cms/apply-items/${id}`);
  },

  async getQuizzesAdmin() {
    return this.request('GET', '/cms/quizzes/admin');
  },

  async createQuizQuestion(data) {
    return this.request('POST', '/cms/quizzes', data);
  },

  async updateQuizQuestion(id, data) {
    return this.request('PUT', `/cms/quizzes/${id}`, data);
  },

  async deleteQuizQuestion(id) {
    return this.request('DELETE', `/cms/quizzes/${id}`);
  },

  async reorderContent(type, items) {
    return this.request('PUT', `/cms/reorder/${type}`, { items });
  },

  // ─── HEALTH ───

  async healthCheck() {
    return this.request('GET', '/health');
  }
};
