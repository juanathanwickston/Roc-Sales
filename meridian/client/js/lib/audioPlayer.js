/**
 * Audio Player
 * Queues and plays AI audio chunks (PCM 24kHz 16-bit mono) through the browser.
 * Uses scheduled playback for gapless audio across small chunks.
 * Supports cancellation for barge-in.
 */

let audioContext = null;

// Scheduled playback: track when the next chunk should start
let nextStartTime = 0;
let isPlaying = false;

// AI audio output: 16-bit PCM at 24kHz mono
const OUTPUT_SAMPLE_RATE = 24000;

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
 * Schedules playback at the exact time the previous chunk ends,
 * eliminating gaps between small chunks.
 *
 * @param {ArrayBuffer} audioData - Raw PCM 16-bit 24kHz mono audio
 */
async function enqueue(audioData) {
    ensureContext();

    try {
        // Convert raw 16-bit PCM to Float32 AudioBuffer
        const pcmData = new Int16Array(audioData);
        if (pcmData.length === 0) return;

        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768;
        }

        const audioBuffer = audioContext.createBuffer(
            1, floatData.length, OUTPUT_SAMPLE_RATE
        );
        audioBuffer.getChannelData(0).set(floatData);

        // Schedule this chunk to start right after the previous one ends
        const now = audioContext.currentTime;
        if (nextStartTime < now) {
            nextStartTime = now;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(nextStartTime);

        // Advance the scheduled time by this chunk's duration
        nextStartTime += audioBuffer.duration;
        isPlaying = true;

        // When this chunk finishes, check if playback has ended
        source.onended = () => {
            if (audioContext.currentTime >= nextStartTime - 0.01) {
                isPlaying = false;
            }
        };
    } catch (err) {
        // Skip malformed chunks silently
    }
}

/**
 * Cancel all playback immediately. Used for barge-in.
 */
function cancel() {
    isPlaying = false;
    nextStartTime = 0;

    if (audioContext) {
        // Close and recreate the context to stop all scheduled sources
        const oldContext = audioContext;
        audioContext = null;
        oldContext.close().catch(() => {});
    }
}

/**
 * Returns whether audio is currently playing.
 */
function getIsPlaying() {
    return isPlaying;
}

export { enqueue, cancel, getIsPlaying };

