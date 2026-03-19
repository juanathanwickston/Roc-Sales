/**
 * Landing Page Controller
 * Handles the Start Session button: creates a session via API and redirects.
 */

const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('landing-status');
const errorEl = document.getElementById('landing-error');

startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    statusEl.textContent = 'Creating session...';
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error('Failed to create session');
        }

        const data = await res.json();
        window.location.href = `/session?session=${data.id}`;
    } catch (err) {
        startBtn.disabled = false;
        statusEl.textContent = 'Ready to start a practice session.';
        errorEl.textContent = 'Unable to create session. Please try again.';
    }
});
