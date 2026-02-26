/**
 * Game Registry for ROC Academy.
 * Standard interface for registering and launching game engines.
 * Developer-maintained — not editable via CMS.
 */

const GameRegistry = {
  games: {},

  /**
   * Register a game engine.
   * @param {Object} game - { id, title, start(container), cleanup(), getScore() }
   */
  register(game) {
    if (!game.id || !game.title || !game.start) {
      console.error('[GAMES] Invalid game registration:', game);
      return;
    }
    this.games[game.id] = game;
  },

  /**
   * Get a registered game by ID.
   */
  get(id) {
    return this.games[id] || null;
  },

  /**
   * Get all registered games.
   */
  list() {
    return Object.values(this.games);
  }
};

// Export for Node (server-side reference) or attach to window (browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameRegistry;
} else {
  window.GameRegistry = GameRegistry;
}
