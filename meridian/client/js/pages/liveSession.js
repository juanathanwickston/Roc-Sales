/**
 * Live Session Page Controller
 * Orchestrates media capture, timer, theme, mic toggle, and session lifecycle.
 */
import * as mediaCapture from '../lib/mediaCapture.js';
import * as sessionTimer from '../lib/sessionTimer.js';
import * as themeToggle from '../lib/themeToggle.js';
import * as toast from '../lib/toast.js';

// DOM references
const elements = {};
let sessionId = null;

/**
 * Initialize the page. Called on DOMContentLoaded.
 */
async function init() {
    cacheElements();

    // Read session ID from URL
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('session');

    if (!sessionId) {
        window.location.href = '/';
        return;
    }

    // Verify session exists
    try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) {
            showError('Session not found', 'This session does not exist or has expired.');
            return;
        }
    } catch (err) {
        showError('Unable to connect', 'Check your internet and try again.');
        return;
    }

    // Initialize theme toggle
    themeToggle.init(elements.themeToggle, elements.themeIcon);

    // Attach event listeners
    elements.micBtn.addEventListener('click', onMicToggle);
    elements.endBtn.addEventListener('click', onEndSession);
    elements.returnBtn.addEventListener('click', onReturn);
    elements.retryBtn.addEventListener('click', onRetry);

    // Start media capture
    try {
        const { stream, hasVideo } = await mediaCapture.init();

        if (hasVideo) {
            elements.pipVideo.srcObject = stream;
            elements.pipVideo.classList.add('pip__video--active');
            elements.pipAvatar.classList.add('hidden');
            elements.pipLabel.classList.add('hidden');
            elements.pipVideo.play().catch(() => {});
        }
    } catch (err) {
        showError(
            'Microphone not found',
            'We can\'t find your microphone. Check your browser permissions and try again.'
        );
        return;
    }

    // Start session via API
    try {
        await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' });
    } catch (err) {
        // Non-blocking: session start is best-effort
    }

    // Start timer
    sessionTimer.start(elements.timerText);
}

/**
 * Cache all DOM element references.
 */
function cacheElements() {
    elements.themeToggle = document.getElementById('theme-toggle');
    elements.themeIcon = document.getElementById('theme-icon');
    elements.toastEl = document.getElementById('toast');
    elements.micBtn = document.getElementById('mic-toggle');
    elements.micOnIcon = document.getElementById('mic-on-icon');
    elements.micOffIcon = document.getElementById('mic-off-icon');
    elements.timerText = document.getElementById('timer-text');
    elements.endBtn = document.getElementById('end-btn');
    elements.returnBtn = document.getElementById('return-btn');
    elements.retryBtn = document.getElementById('retry-btn');
    elements.pipVideo = document.getElementById('pip-video');
    elements.pipAvatar = document.getElementById('pip-avatar');
    elements.pipLabel = document.getElementById('pip-label');
    elements.sessionEnded = document.getElementById('session-ended');
    elements.sessionError = document.getElementById('session-error');
    elements.errorTitle = document.getElementById('error-title');
    elements.errorMessage = document.getElementById('error-message');
}

/**
 * Toggle mic mute/unmute.
 */
function onMicToggle() {
    const isMuted = mediaCapture.toggleMic();

    elements.micBtn.classList.toggle('btn-circle--muted', isMuted);
    elements.micOnIcon.classList.toggle('hidden', isMuted);
    elements.micOffIcon.classList.toggle('hidden', !isMuted);

    if (isMuted) {
        toast.show(elements.toastEl, 'Microphone muted');
    } else {
        toast.hide(elements.toastEl);
    }
}

/**
 * End session sequence:
 * 1. Add exit class (triggers CSS transitions on controls, PIP, toggle)
 * 2. Stop timer, get duration
 * 3. After 400ms: show ended overlay
 * 4. Call API to end session
 * 5. Destroy media capture
 */
function onEndSession() {
    document.body.classList.add('session-exiting');

    const duration = sessionTimer.stop();

    setTimeout(() => {
        elements.sessionEnded.classList.add('session-ended--visible');
    }, 400);

    fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration })
    }).catch(() => {});

    mediaCapture.destroy();
}

/**
 * Return to landing page.
 */
function onReturn() {
    window.location.href = '/';
}

/**
 * Retry after error: reload the page.
 */
function onRetry() {
    window.location.reload();
}

/**
 * Show the error overlay with a title and message.
 */
function showError(title, message) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.sessionError.classList.add('session-error--visible');
}

document.addEventListener('DOMContentLoaded', init);
