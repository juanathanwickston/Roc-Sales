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
    let audioChunkCount = 0;

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
                path.join(promptsDir, 'stefan_marciano_v1.md'), 'utf-8'
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
                            silence_duration_ms: 700
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
     * Includes diagnostic logging on every event for debugging.
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
                    if (!isAiSpeaking) {
                        console.info('[openai-realtime] AI started speaking', {
                            sessionId, responseId: event.response_id
                        });
                    }
                    isAiSpeaking = true;
                    audioChunkCount += 1;
                    const audioBuffer = Buffer.from(event.delta, 'base64');
                    callbacks.onAudio(audioBuffer);
                }
                break;

            // AI audio finished for this response part
            case 'response.audio.done':
                console.info('[openai-realtime] AI audio done', {
                    sessionId,
                    chunksDelivered: audioChunkCount,
                    responseId: event.response_id
                });
                isAiSpeaking = false;
                audioChunkCount = 0;
                break;

            // AI transcript chunk
            case 'response.audio_transcript.delta':
                if (event.delta && callbacks.onOutputTranscript) {
                    callbacks.onOutputTranscript(event.delta);
                }
                break;

            // AI transcript for this part is complete
            case 'response.audio_transcript.done':
                console.info('[openai-realtime] AI transcript done', {
                    sessionId,
                    transcript: event.transcript
                        ? event.transcript.substring(0, 120)
                        : '(empty)'
                });
                break;

            // User input transcript completed
            case 'conversation.item.input_audio_transcription.completed':
                console.info('[openai-realtime] User said', {
                    sessionId,
                    transcript: event.transcript
                        ? event.transcript.substring(0, 120)
                        : '(empty)'
                });
                if (event.transcript && callbacks.onInputTranscript) {
                    callbacks.onInputTranscript(event.transcript);
                }
                break;

            // VAD detected speech start (always log, even if AI not speaking)
            case 'input_audio_buffer.speech_started':
                console.info('[openai-realtime] VAD speech_started', {
                    sessionId,
                    isAiSpeaking: isAiSpeaking,
                    willInterrupt: isAiSpeaking
                });
                if (isAiSpeaking && callbacks.onInterrupted) {
                    isAiSpeaking = false;
                    audioChunkCount = 0;
                    // Clear the input buffer to prevent residual audio
                    // from causing continued false VAD triggers
                    sendEvent('input_audio_buffer.clear', {});
                    callbacks.onInterrupted();
                }
                break;

            // VAD detected speech stop
            case 'input_audio_buffer.speech_stopped':
                console.info('[openai-realtime] VAD speech_stopped', { sessionId });
                break;

            // Input audio buffer committed (VAD auto-commits)
            case 'input_audio_buffer.committed':
                console.info('[openai-realtime] Audio buffer committed', {
                    sessionId, itemId: event.item_id
                });
                break;

            // Response started
            case 'response.created':
                console.info('[openai-realtime] Response created', {
                    sessionId, responseId: event.response && event.response.id
                });
                break;

            // A new output item was added to the conversation
            case 'response.output_item.added':
                console.info('[openai-realtime] Output item added', {
                    sessionId,
                    itemId: event.item && event.item.id,
                    type: event.item && event.item.type
                });
                break;

            // Content part added
            case 'response.content_part.added':
                break;

            // Content part done
            case 'response.content_part.done':
                break;

            // Output item done
            case 'response.output_item.done':
                break;

            // Response completed (turn complete)
            case 'response.done':
                console.info('[openai-realtime] Response done', {
                    sessionId,
                    status: event.response && event.response.status,
                    usage: event.response && event.response.usage
                });
                isAiSpeaking = false;
                audioChunkCount = 0;
                if (callbacks.onTurnComplete) {
                    callbacks.onTurnComplete();
                }
                break;

            // Rate limits
            case 'rate_limits.updated':
                break;

            // Conversation item created
            case 'conversation.item.created':
                console.info('[openai-realtime] Conversation item created', {
                    sessionId,
                    role: event.item && event.item.role,
                    type: event.item && event.item.type
                });
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

            // Catch any event we are not handling
            default:
                console.info('[openai-realtime] Unhandled event', {
                    sessionId, type: event.type
                });
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
