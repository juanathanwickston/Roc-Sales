const { createDeepgramStream } = require('./deepgram');
const { createClaudeEngine } = require('./claude');
const { synthesize } = require('./cartesia');
const { pool } = require('../db/pool');
const transcriptQueries = require('../db/queries/transcripts');

const SILENCE_PROMPT_5S = "You still there?";
const SILENCE_PROMPT_10S = "I had another call coming in, should I take that or...";
const SILENCE_PROMPT_15S = "Alright, I think we'll pick this up another time.";

// Filler phrases for latency masking (randomized per use)
const FILLER_PHRASES = [
    'Well...',
    'So...',
    'I mean...'
];

/**
 * Creates a per-session orchestrator that ties Deepgram, Claude, and Cartesia
 * together into a single conversation pipeline.
 */
function createOrchestrator(sessionId, sendToClient) {
    const deepgram = createDeepgramStream();
    const claude = createClaudeEngine();

    let isProcessing = false;
    let turnNumber = 0;
    let currentAbortController = null;
    let silenceTimer = null;
    let silenceStage = 0;
    let isDestroyed = false;

    /**
     * Initialize the orchestrator: open Deepgram connection,
     * wire up transcript events.
     */
    async function init() {
        await deepgram.open();

        deepgram.on('partial', (text) => {
            // Barge-in: user is speaking while AI is responding
            if (isProcessing && currentAbortController) {
                console.info('[orchestrator] Barge-in detected', { sessionId });
                currentAbortController.abort();
                currentAbortController = null;
                isProcessing = false;
                sendToClient({ type: 'status', state: 'listening' });
            }

            sendToClient({
                type: 'transcript',
                text,
                isFinal: false
            });
        });

        deepgram.on('final', async (text) => {
            if (!text.trim() || isDestroyed) return;

            // Barge-in: final transcript arrived while AI is still responding
            if (isProcessing && currentAbortController) {
                console.info('[orchestrator] Barge-in detected (final)', { sessionId });
                currentAbortController.abort();
                currentAbortController = null;
                isProcessing = false;
                sendToClient({ type: 'status', state: 'listening' });
            }

            resetSilenceTimer();
            await handleUserUtterance(text);
        });

        deepgram.on('error', (err) => {
            console.error('[orchestrator] Deepgram error', {
                sessionId,
                error: err.message
            });
            sendToClient({
                type: 'error',
                message: 'Transcription service error. Please try again.'
            });
        });

        startSilenceTimer();
        sendToClient({ type: 'status', state: 'listening' });
    }

    /**
     * Receive raw audio from the browser and forward to Deepgram.
     * Audio is always forwarded so Deepgram can detect speech.
     * Barge-in is handled by transcript events, not raw audio.
     */
    function receiveAudio(audioBuffer) {
        if (isDestroyed) return;
        resetSilenceTimer();
        deepgram.sendAudio(audioBuffer);
    }

    /**
     * Process a completed user utterance through the full pipeline:
     * 1. Send to Claude
     * 2. Stream sentences to Cartesia TTS
     * 3. Send audio back to client
     */
    async function handleUserUtterance(text) {
        if (isProcessing || isDestroyed) return;
        isProcessing = true;

        const turnStart = Date.now();
        turnNumber += 1;
        const currentTurn = turnNumber;

        // Save user transcript
        saveTranscript(sessionId, 'user', text, currentTurn).catch((err) => {
            console.error('[orchestrator] Failed to save user transcript', {
                sessionId,
                error: err.message
            });
        });

        sendToClient({
            type: 'transcript',
            text,
            isFinal: true
        });
        sendToClient({ type: 'status', state: 'thinking' });

        // Track TTFT for latency masking
        let ttftHandled = false;
        claude.on('ttft', (ttftMs) => {
            if (ttftMs > 800 && !ttftHandled) {
                ttftHandled = true;
                // Latency masking: synthesize a filler phrase while Claude thinks
                const filler = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
                synthesize(filler).then((audioBuffer) => {
                    if (!isDestroyed && isProcessing) {
                        sendToClient({ type: 'ai_audio', data: audioBuffer });
                    }
                }).catch(() => {
                    // Filler is best-effort, do not block the pipeline
                });
            }
        });

        try {
            currentAbortController = new AbortController();
            let fullAiResponse = '';

            // Process sentences as they arrive from Claude
            const sentencePromises = [];

            claude.on('sentence', (sentenceText, emotionTag) => {
                if (isDestroyed || !isProcessing) return;

                fullAiResponse += (fullAiResponse ? ' ' : '') + sentenceText;

                // Send text to client for captions
                sendToClient({
                    type: 'ai_text',
                    text: sentenceText,
                    isFinal: false
                });

                // Queue TTS for this sentence (SSML tags are inline in the text)
                const ttsPromise = synthesizeSentence(sentenceText);
                sentencePromises.push(ttsPromise);
            });

            // Wait for Claude to finish
            await claude.respond(text);

            // Wait for all TTS to complete
            await Promise.allSettled(sentencePromises);

            // Clean up Claude event listeners for this turn
            claude.removeAllListeners('sentence');
            claude.removeAllListeners('ttft');

            // Save AI transcript
            turnNumber += 1;
            saveTranscript(sessionId, 'ai', fullAiResponse, turnNumber).catch((err) => {
                console.error('[orchestrator] Failed to save AI transcript', {
                    sessionId,
                    error: err.message
                });
            });

            sendToClient({ type: 'ai_text', text: '', isFinal: true });

            const totalMs = Date.now() - turnStart;
            console.info('[orchestrator] Turn complete', {
                sessionId,
                turn: currentTurn,
                totalMs
            });

        } catch (err) {
            if (err.name === 'AbortError') {
                // Barge-in cancelled the turn, this is expected
                console.info('[orchestrator] Turn cancelled by barge-in', { sessionId });
            } else {
                console.error('[orchestrator] Turn error', {
                    sessionId,
                    error: err.message
                });
                sendToClient({
                    type: 'error',
                    message: 'The AI is taking longer than expected. Please try again.'
                });
            }
            claude.removeAllListeners('sentence');
            claude.removeAllListeners('ttft');
        } finally {
            isProcessing = false;
            currentAbortController = null;
            if (!isDestroyed) {
                sendToClient({ type: 'status', state: 'listening' });
                startSilenceTimer();
            }
        }
    }

    /**
     * Convert a single sentence to speech and send the audio to the client.
     */
    async function synthesizeSentence(text) {
        if (isDestroyed || !isProcessing) return;

        try {
            sendToClient({ type: 'status', state: 'speaking' });

            // Text contains inline SSML tags from Claude, pass directly to Cartesia
            const audioBuffer = await synthesize(text, {
                signal: currentAbortController ? currentAbortController.signal : undefined
            });

            if (!isDestroyed && isProcessing) {
                sendToClient({ type: 'ai_audio', data: audioBuffer });
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('[orchestrator] TTS error', {
                sessionId,
                error: err.message
            });
        }
    }

    /**
     * Silence timer: prompts the buyer to speak if the user is quiet.
     */
    function startSilenceTimer() {
        clearSilenceTimer();
        silenceStage = 0;

        silenceTimer = setTimeout(() => {
            if (isDestroyed || isProcessing) return;
            silenceStage = 1;
            handleSilencePrompt(SILENCE_PROMPT_5S);

            silenceTimer = setTimeout(() => {
                if (isDestroyed || isProcessing) return;
                silenceStage = 2;
                handleSilencePrompt(SILENCE_PROMPT_10S);

                silenceTimer = setTimeout(() => {
                    if (isDestroyed || isProcessing) return;
                    silenceStage = 3;
                    handleSilencePrompt(SILENCE_PROMPT_15S);
                }, 5000);
            }, 5000);
        }, 5000);
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
     * When silence is detected, have the buyer persona say something.
     */
    async function handleSilencePrompt(promptText) {
        if (isProcessing || isDestroyed) return;
        isProcessing = true;

        try {
            sendToClient({ type: 'ai_text', text: promptText, isFinal: false });
            sendToClient({ type: 'status', state: 'speaking' });

            const audioBuffer = await synthesize(promptText);
            if (!isDestroyed) {
                sendToClient({ type: 'ai_audio', data: audioBuffer });
            }

            sendToClient({ type: 'ai_text', text: '', isFinal: true });
        } catch (err) {
            console.error('[orchestrator] Silence prompt TTS error', {
                sessionId,
                error: err.message
            });
        } finally {
            isProcessing = false;
            if (!isDestroyed) {
                sendToClient({ type: 'status', state: 'listening' });
            }
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

        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }

        deepgram.close();
        deepgram.removeAllListeners();
        claude.removeAllListeners();

        console.info('[orchestrator] Session destroyed', { sessionId });
    }

    return {
        init,
        receiveAudio,
        destroy
    };
}

module.exports = { createOrchestrator };
