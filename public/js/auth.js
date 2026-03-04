/**
 * Auth client for ROC Academy.
 * Handles session guard, redirect to login, and forced password change.
 */

const Auth = {
  user: null,

  /**
   * Check authentication state. Redirects to login if no valid token.
   * Returns user profile on success.
   */
  async check() {
    const token = API.getToken();
    if (!token) {
      window.location.href = '/login.html';
      return null;
    }

    try {
      this.user = await API.getProfile();
      return this.user;
    } catch (err) {
      API.clearToken();
      window.location.href = '/login.html';
      return null;
    }
  },

  /**
   * Returns true if user must change password before proceeding.
   */
  mustChangePassword() {
    return this.user && this.user.mustChangePassword;
  },

  /**
   * Returns true if user has the given role or higher.
   */
  hasRole(role) {
    if (!this.user) return false;
    const hierarchy = { superuser: 4, ld_manager: 3, manager: 2, rep: 1 };
    return (hierarchy[this.user.role] || 0) >= (hierarchy[role] || 0);
  },

  /**
   * Get display name for current user.
   */
  displayName() {
    if (!this.user) return '';
    if (this.user.nickname) {
      return `${this.user.firstName} '${this.user.nickname}' ${this.user.lastName}`;
    }
    return `${this.user.firstName} ${this.user.lastName}`;
  }
};
