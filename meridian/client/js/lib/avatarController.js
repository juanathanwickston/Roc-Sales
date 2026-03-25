/**
 * Avatar Controller
 * Manages the TalkingHead3D avatar lifecycle: initialization, audio streaming,
 * HeadAudio lip-sync, barge-in interruption, and cleanup.
 *
 * Audio path:
 *   streamAudio({audio}) -> streamWorkletNode -> audioAnalyzerNode
 *   -> audioSpeechGainNode (HeadAudio taps here) -> audioReverbNode -> speakers
 */
import { TalkingHead } from 'talkinghead';

let head = null;
let headaudio = null;
let isReady = false;

// Path to HeadAudio assets (self-hosted)
const HEADAUDIO_WORKLET_PATH = '/js/lib/headaudio/headworklet.min.mjs';
const HEADAUDIO_MODEL_PATH = '/js/lib/headaudio/model-en-mixed.bin';

// Default avatar path
const DEFAULT_AVATAR_URL = '/assets/avatars/avatar.glb';

// OpenAI Realtime output sample rate
const STREAM_SAMPLE_RATE = 24000;

/**
 * Initialize the TalkingHead avatar in the given container element.
 * Sets up HeadAudio for audio-driven lip sync.
 *
 * @param {HTMLElement} containerEl - DOM element to render the avatar in
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.avatarUrl] - URL to the GLB model
 * @param {string} [options.body] - Body form: 'M' or 'F'
 * @param {string} [options.mood] - Initial mood
 */
async function init(containerEl, options = {}) {
    const avatarUrl = options.avatarUrl || DEFAULT_AVATAR_URL;
    const body = options.body || 'F';
    const mood = options.mood || 'neutral';

    // Create TalkingHead instance
    head = new TalkingHead(containerEl, {
        ttsEndpoint: null,
        lipsyncModules: ['en'],
        cameraView: 'upper',
        cameraRotateEnable: false,
        cameraPanEnable: false,
        cameraZoomEnable: false,
        modelPixelRatio: 1,
        modelFPS: 30
    });

    // Register HeadAudio worklet with TalkingHead's AudioContext
    await head.audioCtx.audioWorklet.addModule(HEADAUDIO_WORKLET_PATH);

    // Dynamically import HeadAudio (self-hosted ESM)
    const { HeadAudio } = await import('/js/lib/headaudio/headaudio.min.mjs');

    // Create HeadAudio instance and load the viseme model
    headaudio = new HeadAudio(head.audioCtx);
    await headaudio.loadModel(HEADAUDIO_MODEL_PATH);

    // Connect HeadAudio to TalkingHead's audio graph
    // audioSpeechGainNode receives audio from streamWorkletNode via audioAnalyzerNode
    head.audioSpeechGainNode.connect(headaudio);

    // HeadAudio drives blendshapes directly on the avatar
    headaudio.onvalue = (key, value) => {
        if (head.mtAvatar && head.mtAvatar[key]) {
            Object.assign(head.mtAvatar[key], { newvalue: value, needsUpdate: true });
        }
    };

    // HeadAudio update hook: called each animation frame by TalkingHead
    head.opt.update = headaudio.update.bind(headaudio);

    // Eye contact and hand gestures on speech boundaries
    let lastEnded = 0;
    headaudio.onended = () => {
        lastEnded = Date.now();
    };
    headaudio.onstarted = () => {
        if (head && Date.now() - lastEnded > 150) {
            head.lookAtCamera(500);
            head.speakWithHands();
        }
    };

    // Load the avatar model
    await head.showAvatar({
        url: avatarUrl,
        body: body,
        avatarMood: mood,
        lipsyncLang: 'en'
    });

    // Start streaming mode at 24kHz to match OpenAI Realtime output
    await head.streamStart({
        sampleRate: STREAM_SAMPLE_RATE,
        lipsyncType: 'visemes',
        waitForAudioChunks: true
    });

    isReady = true;
}

/**
 * Feed a PCM16 audio chunk to the avatar for playback and lip sync.
 * The audio flows through TalkingHead's internal audio graph:
 *   streamWorkletNode -> audioAnalyzerNode -> audioSpeechGainNode
 *   -> HeadAudio detects visemes -> drives blendshapes
 *
 * @param {ArrayBuffer} audioData - Raw PCM 16-bit 24kHz mono audio
 */
function feedAudio(audioData) {
    if (!isReady || !head) return;
    head.streamAudio({ audio: audioData });
}

/**
 * Interrupt current playback. Used for barge-in when the user starts speaking.
 * Stops audio, clears lip sync queue, and resets mouth to neutral.
 */
function interrupt() {
    if (!isReady || !head) return;
    head.streamInterrupt();
}

/**
 * Set the avatar's emotional mood.
 * @param {string} mood - Mood name (neutral, happy, sad, angry, etc.)
 */
function setMood(mood) {
    if (!head) return;
    try {
        head.setMood(mood);
    } catch (err) {
        // Unknown mood, ignore
    }
}

/**
 * Check if the avatar is initialized and ready.
 * @returns {boolean}
 */
function getIsReady() {
    return isReady;
}

/**
 * Clean up avatar resources. Called on session end.
 */
function destroy() {
    isReady = false;

    if (head) {
        try { head.streamStop(); } catch (e) { /* ignore */ }
        try { head.stop(); } catch (e) { /* ignore */ }
    }

    if (headaudio) {
        try { headaudio.close(); } catch (e) { /* ignore */ }
        headaudio = null;
    }

    head = null;
}

export { init, feedAudio, interrupt, setMood, getIsReady, destroy };
