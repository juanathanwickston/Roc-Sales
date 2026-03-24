/**
 * Audio Socket
 * WebSocket client for streaming mic audio to the server and receiving
 * AI transcript/audio responses. Uses AudioWorklet for PCM capture.
 */

let ws = null;
let audioContext = null;
let workletNode = null;
let sourceNode = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 3;
const RECONNECT_DELAYS = [1000, 2000, 4000];

// Callbacks set by the page controller
let onTranscript = null;
let onAiText = null;
let onAiAudio = null;
let onStatus = null;
let onError = null;

/**
 * Connect to the WebSocket server and start streaming mic audio.
 * AudioContext is created here (must be called after a user gesture).
 *
 * @param {string} sessionId - Session UUID
 * @param {MediaStream} micStream - getUserMedia audio stream
 * @param {object} callbacks - Event callbacks
 */
async function connect(sessionId, micStream, callbacks) {
    onTranscript = callbacks.onTranscript || null;
    onAiText = callbacks.onAiText || null;
    onAiAudio = callbacks.onAiAudio || null;
    onStatus = callbacks.onStatus || null;
    onError = callbacks.onError || null;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws?session=${sessionId}`;

    return new Promise((resolve, reject) => {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = async () => {
            reconnectAttempts = 0;
            try {
                await setupAudioCapture(micStream);
                resolve();
            } catch (err) {
                reject(err);
            }
        };

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Binary = AI audio (PCM)
                if (onAiAudio) onAiAudio(event.data);
            } else {
                // JSON message
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (err) {
                    // Ignore malformed JSON
                }
            }
        };

        ws.onclose = (event) => {
            cleanupAudio();

            if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECTS) {
                const delay = RECONNECT_DELAYS[reconnectAttempts] || 4000;
                reconnectAttempts += 1;
                setTimeout(() => {
                    connect(sessionId, micStream, callbacks).catch(() => {
                        if (onError) onError('Connection lost. Please refresh.');
                    });
                }, delay);
            }
        };

        ws.onerror = () => {
            reject(new Error('WebSocket connection failed'));
        };
    });
}

/**
 * Set up AudioWorklet to capture mic audio as PCM 16-bit chunks
 * and send them to the WebSocket.
 */
async function setupAudioCapture(micStream) {
    // Create AudioContext at 16kHz for mic capture (server input format)
    audioContext = new AudioContext({ sampleRate: 16000 });

    // Load the AudioWorklet processor
    await audioContext.audioWorklet.addModule('/js/lib/pcmProcessor.js');

    // Create source from mic stream
    sourceNode = audioContext.createMediaStreamSource(micStream);

    // Create worklet node
    workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');

    // When the worklet sends PCM data, forward it to the WebSocket
    workletNode.port.onmessage = (event) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
        }
    };

    // Connect: mic -> worklet (no need to connect to destination)
    sourceNode.connect(workletNode);
}

/**
 * Handle a JSON message from the server.
 */
function handleMessage(message) {
    switch (message.type) {
        case 'transcript':
            if (onTranscript) onTranscript(message.text, message.isFinal);
            break;
        case 'ai_text':
            if (onAiText) onAiText(message.text, message.isFinal);
            break;
        case 'status':
            if (onStatus) onStatus(message.state);
            break;
        case 'error':
            if (onError) onError(message.message);
            break;
    }
}

/**
 * Clean up audio resources.
 */
function cleanupAudio() {
    if (workletNode) {
        workletNode.disconnect();
        workletNode = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
}

/**
 * Disconnect the WebSocket and clean up.
 */
function disconnect() {
    reconnectAttempts = MAX_RECONNECTS; // Prevent reconnection
    cleanupAudio();

    if (ws) {
        ws.close(1000, 'Session ended');
        ws = null;
    }
}

export { connect, disconnect };
