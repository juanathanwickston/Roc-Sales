/**
 * Gemini Live Service
 * Manages a persistent WebSocket session with Gemini Live API for
 * native audio-in/audio-out conversation. Handles audio streaming,
 * transcription, barge-in, and session lifecycle.
 *
 * Uses the @google/genai SDK callback-based Live API.
 * Audio format: 16kHz PCM 16-bit mono in, 24kHz PCM 16-bit mono out.
 */
const { GoogleGenAI, Modality } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Create a Gemini Live session for a single conversation.
 *
 * @param {string} sessionId - Session UUID for logging
 * @param {object} callbacks - Event callbacks from orchestrator
 * @param {function} callbacks.onAudio - Called with Buffer of PCM audio data
 * @param {function} callbacks.onInputTranscript - Called with user speech text
 * @param {function} callbacks.onOutputTranscript - Called with AI speech text
 * @param {function} callbacks.onInterrupted - Called when barge-in occurs
 * @param {function} callbacks.onTurnComplete - Called when AI finishes a turn
 * @param {function} callbacks.onError - Called with error message
 * @returns {object} Session controller with init, sendAudio, destroy
 */
function createGeminiLiveSession(sessionId, callbacks) {
    const ai = new GoogleGenAI({
        apiKey: config.geminiLive.apiKey,
        httpOptions: { apiVersion: 'v1alpha' }
    });

    let session = null;
    let isDestroyed = false;

    // Load system instruction from prompt files
    function loadSystemInstruction() {
        const promptsDir = path.join(__dirname, '..', '..', 'prompts');
        let voiceBase = '';
        let persona = '';

        try {
            voiceBase = fs.readFileSync(
                path.join(promptsDir, 'voice_base.md'), 'utf-8'
            );
        } catch (err) {
            console.error('[gemini-live] Failed to load voice_base.md', {
                sessionId, error: err.message
            });
        }

        try {
            persona = fs.readFileSync(
                path.join(promptsDir, 'karen_chen_v1.md'), 'utf-8'
            );
        } catch (err) {
            console.error('[gemini-live] Failed to load persona prompt', {
                sessionId, error: err.message
            });
        }

        return `${voiceBase}\n\n${persona}`;
    }

    /**
     * Initialize the Gemini Live connection.
     */
    async function init() {
        const systemInstruction = loadSystemInstruction();

        const liveConfig = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: config.geminiLive.voiceName
                    }
                }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            enableAffectiveDialog: true
        };

        try {
            session = await ai.live.connect({
                model: config.geminiLive.model,
                config: liveConfig,
                callbacks: {
                    onopen: function () {
                        console.info('[gemini-live] Session opened', { sessionId });
                    },
                    onmessage: function (message) {
                        if (isDestroyed) return;
                        handleMessage(message);
                    },
                    onerror: function (e) {
                        console.error('[gemini-live] Session error', {
                            sessionId, error: e.message
                        });
                        if (callbacks.onError) {
                            callbacks.onError(e.message || 'Gemini Live error');
                        }
                    },
                    onclose: function (e) {
                        console.info('[gemini-live] Session closed', {
                            sessionId, reason: e.reason
                        });
                    }
                }
            });

            console.info('[gemini-live] Connected', { sessionId });
        } catch (err) {
            console.error('[gemini-live] Connection failed', {
                sessionId, error: err.message
            });
            throw err;
        }
    }

    /**
     * Handle incoming messages from Gemini Live.
     */
    function handleMessage(message) {
        const content = message.serverContent;
        if (!content) return;

        // AI audio response
        if (content.modelTurn && content.modelTurn.parts) {
            for (const part of content.modelTurn.parts) {
                if (part.inlineData) {
                    // Audio data arrives as base64, convert to Buffer
                    const audioBuffer = Buffer.from(
                        part.inlineData.data, 'base64'
                    );
                    if (callbacks.onAudio) {
                        callbacks.onAudio(audioBuffer);
                    }
                }
            }
        }

        // User speech transcription
        if (content.inputTranscription && content.inputTranscription.text) {
            if (callbacks.onInputTranscript) {
                callbacks.onInputTranscript(content.inputTranscription.text);
            }
        }

        // AI speech transcription
        if (content.outputTranscription && content.outputTranscription.text) {
            if (callbacks.onOutputTranscript) {
                callbacks.onOutputTranscript(content.outputTranscription.text);
            }
        }

        // Barge-in (user interrupted AI)
        if (content.interrupted) {
            if (callbacks.onInterrupted) {
                callbacks.onInterrupted();
            }
        }

        // Turn complete
        if (content.turnComplete) {
            if (callbacks.onTurnComplete) {
                callbacks.onTurnComplete();
            }
        }
    }

    /**
     * Send raw PCM audio to Gemini Live.
     * Expects a Buffer of 16-bit PCM at 16kHz mono.
     *
     * @param {Buffer} audioData - Raw PCM audio bytes
     */
    function sendAudio(audioData) {
        if (!session || isDestroyed) return;

        try {
            session.sendRealtimeInput({
                audio: {
                    data: audioData.toString('base64'),
                    mimeType: 'audio/pcm;rate=16000'
                }
            });
        } catch (err) {
            console.error('[gemini-live] Failed to send audio', {
                sessionId, error: err.message
            });
        }
    }

    /**
     * Close the Gemini Live session and clean up.
     */
    function destroy() {
        isDestroyed = true;
        if (session) {
            try {
                session.close();
            } catch (err) {
                // Session may already be closed
            }
            session = null;
        }
        console.info('[gemini-live] Session destroyed', { sessionId });
    }

    /**
     * Send a text prompt to Gemini Live (used for silence prompts).
     * Gemini responds in-character via audio.
     *
     * @param {string} text - Text instruction for the buyer persona
     */
    function sendText(text) {
        if (!session || isDestroyed) return;

        try {
            session.sendClientContent({
                turns: [
                    {
                        role: 'user',
                        parts: [{ text: text }]
                    }
                ],
                turnComplete: true
            });
        } catch (err) {
            console.error('[gemini-live] Failed to send text', {
                sessionId, error: err.message
            });
        }
    }

    return { init, sendAudio, sendText, destroy };
}

module.exports = { createGeminiLiveSession };
