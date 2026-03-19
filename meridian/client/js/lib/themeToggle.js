/**
 * Theme Toggle Module
 * Persists theme preference in localStorage.
 * Key: 'meridian-theme' (namespaced to avoid collisions).
 */

const STORAGE_KEY = 'meridian-theme';
let buttonElement = null;
let iconElement = null;

/**
 * Initialize the theme toggle.
 * Loads saved preference, applies it, and attaches click handler.
 */
export function init(button, icon) {
    buttonElement = button;
    iconElement = icon;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
        document.documentElement.dataset.theme = saved;
    }

    updateIcon();
    buttonElement.addEventListener('click', toggle);
}

/**
 * Toggle between light and dark themes.
 */
function toggle() {
    const root = document.documentElement;
    if (root.dataset.theme === 'dark') {
        root.dataset.theme = 'light';
    } else {
        root.dataset.theme = 'dark';
    }
    localStorage.setItem(STORAGE_KEY, root.dataset.theme);
    updateIcon();
}

/**
 * Update the theme icon to match the current theme.
 * Moon = currently light (click to go dark).
 * Sun = currently dark (click to go light).
 */
function updateIcon() {
    if (!iconElement) return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    iconElement.textContent = isDark ? '\u2600' : '\u263E';
}

/**
 * Get the current theme.
 */
export function getTheme() {
    return document.documentElement.dataset.theme || 'light';
}
