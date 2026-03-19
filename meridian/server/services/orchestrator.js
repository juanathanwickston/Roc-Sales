/**
 * Session Orchestrator
 * Routes audio between the browser and Gemini Live, saves transcripts,
 * and manages silence prompts. Replaces the previous multi-vendor
 * pipeline (Deepgram + Claude + Cartesia) with a single Gemini Live session.
 */
const { createGeminiLiveSession } = require('./gemini-live');
const { pool } = require('../db/pool');
const transcriptQueries = require('../db/queries/transcripts');

// Silence prompts: buyer reactions when the rep goes quiet
const SILENCE_THRESHOLDS = [
    { delay: 8000, text: 'You still there?' },
    { delay: 7000, text: 'I had another call coming in, should I take that or...' },
    { delay: 5000, text: 'Alright, I think we\'ll pick this up another time.' }
];

/**
 * Creates a per-session orchestrator that manages the Gemini Live connection,
 * forwards audio, and handles silence detection.
 *
 * @param {string} sessionId - Session UUID
 * @param {function} sendToClient - Sends messages/audio to the browser via WebSocket
 */
function createOrchestrator(sessionId, sendToClient) {
    let geminiSession = null;
    let isDestroyed = false;
    let silenceTimer = null;
    let silenceStage = 0;
    let turnNumber = 0;

    // Accumulate partial transcripts per turn
    let currentUserTranscript = '';
    let currentAiTranscript = '';

    /**
     * Initialize the orchestrator: connect to Gemini Live,
     * wire up audio and transcript callbacks, send initial greeting.
     */
    async function init() {
        geminiSession = createGeminiLiveSession(sessionId, {
            onAudio: (audioBuffer) => {
                if (isDestroyed) return;
                // Forward raw PCM audio to the browser
                sendToClient({ type: 'ai_audio', data: audioBuffer });
            },

            onInputTranscript: (text) => {
                if (isDestroyed) return;
                currentUserTranscript += text;
                sendToClient({
                    type: 'transcript',
                    text: text,
                    isFinal: false
                });
            },

            onOutputTranscript: (text) => {
                if (isDestroyed) return;
                currentAiTranscript += text;
                sendToClient({
                    type: 'ai_text',
                    text: text,
                    isFinal: false
                });
            },

            onInterrupted: () => {
                if (isDestroyed) return;
                console.info('[orchestrator] Barge-in detected', { sessionId });
                sendToClient({ type: 'status', state: 'listening' });

                // Save partial AI transcript if present
                if (currentAiTranscript.trim()) {
                    turnNumber += 1;
                    saveTranscript(sessionId, 'ai', currentAiTranscript.trim(), turnNumber);
                    currentAiTranscript = '';
                }
            },

            onTurnComplete: () => {
                if (isDestroyed) return;

                // Save user transcript if accumulated
                if (currentUserTranscript.trim()) {
                    turnNumber += 1;
                    saveTranscript(sessionId, 'user', currentUserTranscript.trim(), turnNumber);
                    sendToClient({
                        type: 'transcript',
                        text: currentUserTranscript.trim(),
                        isFinal: true
                    });
                    currentUserTranscript = '';
                }

                // Save AI transcript
                if (currentAiTranscript.trim()) {
                    turnNumber += 1;
                    saveTranscript(sessionId, 'ai', currentAiTranscript.trim(), turnNumber);
                    sendToClient({ type: 'ai_text', text: '', isFinal: true });
                    currentAiTranscript = '';
                }

                sendToClient({ type: 'status', state: 'listening' });
                startSilenceTimer();
            },

            onError: (errorMessage) => {
                if (isDestroyed) return;
                console.error('[orchestrator] Gemini Live error', {
                    sessionId, error: errorMessage
                });
                sendToClient({
                    type: 'error',
                    message: 'The AI is taking longer than expected. Please try again.'
                });
            }
        });

        await geminiSession.init();

        // AI greets first when the call connects, like a real person answering
        sendToClient({ type: 'status', state: 'thinking' });
        geminiSession.sendAudio(Buffer.alloc(0));

        startSilenceTimer();
    }

    /**
     * Receive raw PCM audio from the browser and forward to Gemini Live.
     * Gemini handles VAD, STT, LLM, and TTS internally.
     *
     * @param {Buffer} audioBuffer - Raw 16-bit PCM at 16kHz
     */
    function receiveAudio(audioBuffer) {
        if (isDestroyed || !geminiSession) return;
        resetSilenceTimer();
        geminiSession.sendAudio(audioBuffer);
    }

    /**
     * Silence timer: prompts the buyer to speak if the user is quiet.
     * Gemini Live does not handle silence prompts, so we keep this logic.
     */
    function startSilenceTimer() {
        clearSilenceTimer();
        silenceStage = 0;
        scheduleSilenceStage(0);
    }

    function scheduleSilenceStage(stageIndex) {
        if (stageIndex >= SILENCE_THRESHOLDS.length) return;

        const threshold = SILENCE_THRESHOLDS[stageIndex];
        silenceTimer = setTimeout(() => {
            if (isDestroyed) return;
            silenceStage = stageIndex + 1;

            // Send silence prompt as text input to Gemini
            // so it responds in-character as the buyer
            handleSilencePrompt(threshold.text);

            scheduleSilenceStage(stageIndex + 1);
        }, threshold.delay);
    }

    function resetSilenceTimer() {
        clearSilenceTimer();
        silenceStage = 0;
    }

    function clearSilenceTimer() {
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
    }

    /**
     * When silence is detected, send a text prompt to Gemini Live
     * so the buyer persona reacts naturally.
     */
    function handleSilencePrompt(promptText) {
        if (isDestroyed || !geminiSession) return;

        console.info('[orchestrator] Silence prompt', {
            sessionId, stage: silenceStage, prompt: promptText
        });

        // Use sendClientContent to inject a text prompt
        // Gemini will respond as the buyer persona
        try {
            geminiSession.sendText(promptText);
        } catch (err) {
            console.error('[orchestrator] Failed to send silence prompt', {
                sessionId, error: err.message
            });
        }
    }

    /**
     * Save a transcript turn to the database.
     */
    async function saveTranscript(sid, role, content, turn) {
        try {
            await pool.query(transcriptQueries.insert, [sid, role, content, turn]);
        } catch (err) {
            console.error('[orchestrator] DB error saving transcript', {
                sessionId: sid,
                error: err.message
            });
        }
    }

    /**
     * Clean up all resources for this session.
     */
    function destroy() {
        isDestroyed = true;
        clearSilenceTimer();

        if (geminiSession) {
            geminiSession.destroy();
            geminiSession = null;
        }

        console.info('[orchestrator] Session destroyed', { sessionId });
    }

    return {
        init,
        receiveAudio,
        destroy
    };
}

module.exports = { createOrchestrator };
