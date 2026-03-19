/**
 * Session Timer Module
 * Drift-corrected timer that updates a display element with MM:SS.
 */

let intervalId = null;
let startTime = null;
let elapsed = 0;

/**
 * Format seconds as MM:SS.
 */
function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return m + ':' + s;
}

/**
 * Start the timer. Updates the given element every second.
 * Uses drift correction: compares Date.now() against the start timestamp
 * instead of trusting setInterval timing.
 */
export function start(displayElement) {
    startTime = Date.now();
    elapsed = 0;

    intervalId = setInterval(() => {
        elapsed = Math.floor((Date.now() - startTime) / 1000);
        displayElement.textContent = formatTime(elapsed);
    }, 1000);
}

/**
 * Stop the timer and return elapsed seconds.
 */
export function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (startTime) {
        elapsed = Math.floor((Date.now() - startTime) / 1000);
    }
    return elapsed;
}

/**
 * Get the current elapsed seconds without stopping.
 */
export function getElapsed() {
    if (startTime) {
        return Math.floor((Date.now() - startTime) / 1000);
    }
    return elapsed;
}

export { formatTime };
