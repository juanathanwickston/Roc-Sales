/**
 * Theme Initializer
 * Runs synchronously in <head> before page renders to prevent
 * flash of light theme when user has dark theme saved.
 */
(function() {
    var saved = localStorage.getItem('meridian-theme');
    if (saved === 'dark' || saved === 'light') {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();
