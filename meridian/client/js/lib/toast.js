/**
 * Toast Notification Module
 * Shows a centered glass toast that auto-hides after a duration.
 */

let hideTimeout = null;

/**
 * Show the toast with a message, auto-hide after durationMs.
 * If called while visible, resets the hide timer.
 */
export function show(element, message, durationMs = 2000) {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
    }

    element.textContent = message;
    element.classList.add('toast--visible');

    hideTimeout = setTimeout(() => {
        element.classList.remove('toast--visible');
        hideTimeout = null;
    }, durationMs);
}

/**
 * Hide the toast immediately.
 */
export function hide(element) {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    element.classList.remove('toast--visible');
}
