const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const config = require('../config');
const EventEmitter = require('events');

const DEEPGRAM_OPTIONS = {
    model: config.deepgram.model,
    language: 'en-US',
    smart_format: true,
    endpointing: config.deepgram.endpointing,
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1
};

/**
 * Creates a persistent Deepgram streaming connection for a single session.
 * Emits 'partial' and 'final' events with transcript text.
 */
function createDeepgramStream() {
    const emitter = new EventEmitter();
    const deepgram = createClient(config.deepgram.apiKey);
    let connection = null;
    let isOpen = false;
    let connectTime = null;

    async function open() {
        connectTime = Date.now();

        connection = deepgram.listen.live(DEEPGRAM_OPTIONS);

        connection.on(LiveTranscriptionEvents.Open, () => {
            isOpen = true;
            const latency = Date.now() - connectTime;
            console.info('[deepgram] Connection opened', { latencyMs: latency });
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (!transcript) return;

            const isFinal = data.is_final;
            const latencyMs = Date.now() - connectTime;

            if (isFinal) {
                console.info('[deepgram] Final transcript', {
                    text: transcript.substring(0, 50),
                    latencyMs
                });
                emitter.emit('final', transcript);
            } else {
                emitter.emit('partial', transcript);
            }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('[deepgram] Connection error', { error: err.message });
            emitter.emit('error', err);
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            isOpen = false;
            console.info('[deepgram] Connection closed');
        });

        // Wait for connection to open with 10s timeout
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Deepgram connection timeout'));
            }, 10000);

            connection.on(LiveTranscriptionEvents.Open, () => {
                clearTimeout(timeout);
                resolve();
            });

            connection.on(LiveTranscriptionEvents.Error, (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    function sendAudio(audioBuffer) {
        if (isOpen && connection) {
            connection.send(audioBuffer);
        }
    }

    function close() {
        if (connection) {
            try {
                connection.finish();
            } catch (err) {
                console.warn('[deepgram] Error closing connection', { error: err.message });
            }
            connection = null;
            isOpen = false;
        }
    }

    return {
        open,
        sendAudio,
        close,
        on: emitter.on.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter)
    };
}

module.exports = { createDeepgramStream };
