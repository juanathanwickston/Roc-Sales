/**
 * Audio Player
 * Queues and plays AI audio chunks (MP3) through the browser.
 * Supports cancellation for barge-in.
 */

let audioContext = null;
let queue = [];
let isPlaying = false;
let currentSource = null;

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
 * Add an audio chunk (ArrayBuffer of MP3 data) to the playback queue.
 * Starts playback if not already playing.
 *
 * @param {ArrayBuffer} audioData - MP3 audio data
 */
async function enqueue(audioData) {
    ensureContext();

    try {
        const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
        queue.push(audioBuffer);

        if (!isPlaying) {
            playNext();
        }
    } catch (err) {
        // Skip undecodable chunks
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
