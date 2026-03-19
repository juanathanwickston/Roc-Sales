/**
 * Audio Player
 * Queues and plays AI audio chunks (PCM 24kHz 16-bit mono) through the browser.
 * Supports cancellation for barge-in.
 */

let audioContext = null;
let queue = [];
let isPlaying = false;
let currentSource = null;

// Gemini Live output: 16-bit PCM at 24kHz mono
const GEMINI_SAMPLE_RATE = 24000;

/**
 * Ensure AudioContext exists. Must be called after a user gesture
 * (browser autoplay policy).
 */
function ensureContext() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

/**
 * Add an audio chunk (ArrayBuffer of raw PCM 16-bit data) to the playback queue.
 * Converts raw PCM to an AudioBuffer for Web Audio API playback.
 *
 * @param {ArrayBuffer} audioData - Raw PCM 16-bit 24kHz mono audio
 */
async function enqueue(audioData) {
    ensureContext();

    try {
        // Convert raw 16-bit PCM to Float32 AudioBuffer
        const pcmData = new Int16Array(audioData);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768;
        }

        const audioBuffer = audioContext.createBuffer(
            1, floatData.length, GEMINI_SAMPLE_RATE
        );
        audioBuffer.getChannelData(0).set(floatData);

        queue.push(audioBuffer);

        if (!isPlaying) {
            playNext();
        }
    } catch (err) {
        // Skip malformed chunks silently
    }
}

/**
 * Play the next buffer in the queue.
 */
function playNext() {
    if (queue.length === 0) {
        isPlaying = false;
        currentSource = null;
        return;
    }

    isPlaying = true;
    const buffer = queue.shift();

    currentSource = audioContext.createBufferSource();
    currentSource.buffer = buffer;
    currentSource.connect(audioContext.destination);

    currentSource.onended = () => {
        currentSource = null;
        playNext();
    };

    currentSource.start(0);
}

/**
 * Cancel all playback immediately. Used for barge-in.
 */
function cancel() {
    queue = [];
    isPlaying = false;

    if (currentSource) {
        try {
            currentSource.stop(0);
        } catch (err) {
            // Already stopped
        }
        currentSource = null;
    }
}

/**
 * Returns whether audio is currently playing.
 */
function getIsPlaying() {
    return isPlaying;
}

export { enqueue, cancel, getIsPlaying };
