/**
 * OpenAI Realtime Service
 * Manages a WebSocket session with OpenAI Realtime API for
 * native audio-in/audio-out conversation. Mirrors the gemini-live.js
 * interface so the orchestrator can swap engines via config.
 *
 * Audio format: 24kHz PCM 16-bit mono in/out.
 * Browser sends 16kHz, so we resample up before forwarding.
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Resample 16kHz PCM16 audio to 24kHz using linear interpolation.
 * Input and output are Buffers of signed 16-bit little-endian samples.
 *
 * @param {Buffer} input - 16kHz PCM16 buffer
 * @returns {Buffer} 24kHz PCM16 buffer
 */
function resample16to24(input) {
    const srcSamples = input.length / 2;
    const ratio = 24000 / 16000; // 1.5
    const dstSamples = Math.round(srcSamples * ratio);
    const output = Buffer.alloc(dstSamples * 2);

    for (let i = 0; i < dstSamples; i++) {
        const srcPos = i / ratio;
        const srcIndex = Math.floor(srcPos);
        const frac = srcPos - srcIndex;

        const s0 = srcIndex < srcSamples
            ? input.readInt16LE(srcIndex * 2)
            : 0;
        const s1 = srcIndex + 1 < srcSamples
            ? input.readInt16LE((srcIndex + 1) * 2)
            : s0;

        const interpolated = Math.round(s0 + frac * (s1 - s0));
        const clamped = Math.max(-32768, Math.min(32767, interpolated));
        output.writeInt16LE(clamped, i * 2);
    }

    return output;
}

/**
 * Create an OpenAI Realtime session for a single conversation.
 * Interface mirrors createGeminiLiveSession exactly.
 *
 * @param {string} sessionId - Session UUID for logging
 * @param {object} callbacks - Event callbacks from orchestrator
 * @param {function} callbacks.onAudio - Called with Buffer of PCM audio data
 * @param {function} callbacks.onInputTranscript - Called with user speech text
 * @param {function} callbacks.onOutputTranscript - Called with AI speech text
 * @param {function} callbacks.onInterrupted - Called when barge-in occurs
 * @param {function} callbacks.onTurnComplete - Called when AI finishes a turn
 * @param {function} callbacks.onError - Called with error message
 * @returns {object} Session controller with init, sendAudio, sendText, destroy
 */
function createOpenAIRealtimeSession(sessionId, callbacks) {
    let ws = null;
    let isDestroyed = false;
    let isAiSpeaking = false;

    // Load system instruction from prompt files (same as gemini-live.js)
    function loadSystemInstruction() {
        const promptsDir = path.join(__dirname, '..', '..', 'prompts');
        let voiceBase = '';
        let persona = '';
        let curriculum = '';

        try {
            voiceBase = fs.readFileSync(
                path.join(promptsDir, 'voice_base.md'), 'utf-8'
            );
        } catch (err) {
            console.error('[openai-realtime] Failed to load voice_base.md', {
                sessionId, error: err.message
            });
        }

        try {
            persona = fs.readFileSync(
                path.join(promptsDir, 'celine_marciano_v1.md'), 'utf-8'
            );
        } catch (err) {
            console.error('[openai-realtime] Failed to load persona prompt', {
                sessionId, error: err.message
            });
        }

        try {
            const rawCurriculum = fs.readFileSync(
                path.join(promptsDir, 'module1_identifying_customer.md'), 'utf-8'
            );
            curriculum = 'The following is reference material about what the caller is being trained on. This is background context only. It does not change your role. You are the buyer.\n\n' + rawCurriculum;
        } catch (err) {
            console.error('[openai-realtime] Failed to load curriculum', {
                sessionId, error: err.message
            });
        }

        return `${voiceBase}\n\n${persona}\n\n${curriculum}`;
    }

    /**
     * Initialize the OpenAI Realtime WebSocket connection.
     */
    async function init() {
        const systemInstruction = loadSystemInstruction();
        const model = config.openaiRealtime.model;
        const url = `wss://api.openai.com/v1/realtime?model=${model}`;

        return new Promise((resolve, reject) => {
            ws = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${config.openaiRealtime.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            ws.on('open', () => {
                console.info('[openai-realtime] WebSocket opened', { sessionId });

                // Configure the session
                sendEvent('session.update', {
                    session: {
                        instructions: systemInstruction,
                        voice: config.openaiRealtime.voice,
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.8,
                            prefix_padding_ms: 200,
                            silence_duration_ms: 700,
                            create_response: true,
                            eagerly_interrupts: false
                        },
                        temperature: 0.9
                    }
                });

                resolve();
            });

            ws.on('message', (data) => {
                if (isDestroyed) return;
                try {
                    const event = JSON.parse(data.toString());
                    handleEvent(event);
                } catch (err) {
                    console.error('[openai-realtime] Failed to parse message', {
                        sessionId, error: err.message
                    });
                }
            });

            ws.on('error', (err) => {
                console.error('[openai-realtime] WebSocket error', {
                    sessionId, error: err.message
                });
                if (callbacks.onError) {
                    callbacks.onError(err.message || 'OpenAI Realtime error');
                }
                reject(err);
            });

            ws.on('close', (code, reason) => {
                console.info('[openai-realtime] WebSocket closed', {
                    sessionId, code, reason: reason.toString()
                });
            });
        });
    }

    /**
     * Send a JSON event to the OpenAI Realtime API.
     */
    function sendEvent(type, data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const event = { type, ...data };
        ws.send(JSON.stringify(event));
    }

    /**
     * Handle incoming events from OpenAI Realtime.
     */
    function handleEvent(event) {
        switch (event.type) {
            case 'session.created':
                console.info('[openai-realtime] Session created', { sessionId });
                break;

            case 'session.updated':
                console.info('[openai-realtime] Session configured', { sessionId });
                break;

            // AI audio chunk
            case 'response.audio.delta':
                if (event.delta && callbacks.onAudio) {
                    isAiSpeaking = true;
                    const audioBuffer = Buffer.from(event.delta, 'base64');
                    callbacks.onAudio(audioBuffer);
                }
                break;

            // AI audio finished
            case 'response.audio.done':
                isAiSpeaking = false;
                break;

            // AI transcript chunk
            case 'response.audio_transcript.delta':
                if (event.delta && callbacks.onOutputTranscript) {
                    callbacks.onOutputTranscript(event.delta);
                }
                break;

            // User input transcript completed
            case 'conversation.item.input_audio_transcription.completed':
                if (event.transcript && callbacks.onInputTranscript) {
                    callbacks.onInputTranscript(event.transcript);
                }
                break;

            // User started speaking while AI was talking (barge-in)
            case 'input_audio_buffer.speech_started':
                if (isAiSpeaking && callbacks.onInterrupted) {
                    isAiSpeaking = false;
                    // Clear the input buffer to prevent residual audio
                    // from causing continued false VAD triggers
                    sendEvent('input_audio_buffer.clear', {});
                    callbacks.onInterrupted();
                }
                break;

            // Response completed (turn complete)
            case 'response.done':
                isAiSpeaking = false;
                if (callbacks.onTurnComplete) {
                    callbacks.onTurnComplete();
                }
                break;

            // Errors
            case 'error':
                console.error('[openai-realtime] API error', {
                    sessionId,
                    code: event.error && event.error.code,
                    message: event.error && event.error.message
                });
                if (callbacks.onError) {
                    callbacks.onError(
                        (event.error && event.error.message) || 'OpenAI error'
                    );
                }
                break;
        }
    }

    /**
     * Send raw PCM audio to OpenAI Realtime.
     * Resamples from 16kHz (browser) to 24kHz (OpenAI requirement).
     *
     * @param {Buffer} audioData - Raw PCM 16-bit at 16kHz mono
     */
    function sendAudio(audioData) {
        if (!ws || ws.readyState !== WebSocket.OPEN || isDestroyed) return;

        try {
            const resampled = resample16to24(audioData);
            sendEvent('input_audio_buffer.append', {
                audio: resampled.toString('base64')
            });
        } catch (err) {
            console.error('[openai-realtime] Failed to send audio', {
                sessionId, error: err.message
            });
        }
    }

    /**
     * Send a text prompt to OpenAI Realtime (used for silence prompts).
     * Creates a conversation item and triggers a response.
     *
     * @param {string} text - Text instruction for the buyer persona
     */
    function sendText(text) {
        if (!ws || ws.readyState !== WebSocket.OPEN || isDestroyed) return;

        try {
            sendEvent('conversation.item.create', {
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: text
                        }
                    ]
                }
            });

            // Trigger a response after adding the text item
            sendEvent('response.create', {
                response: {
                    modalities: ['audio', 'text']
                }
            });
        } catch (err) {
            console.error('[openai-realtime] Failed to send text', {
                sessionId, error: err.message
            });
        }
    }

    /**
     * Close the WebSocket and clean up.
     */
    function destroy() {
        isDestroyed = true;
        if (ws) {
            try {
                ws.close();
            } catch (err) {
                // WebSocket may already be closed
            }
            ws = null;
        }
        console.info('[openai-realtime] Session destroyed', { sessionId });
    }

    return { init, sendAudio, sendText, destroy };
}

module.exports = { createOpenAIRealtimeSession };
