const config = require('../config');

const INWORLD_ENDPOINT = 'https://api.inworld.ai/tts/v1/voice';
const TIMEOUT_MS = 10000;

/**
 * Converts text to speech using Inworld TTS 1.5 Max.
 * Returns a Buffer containing MP3 audio data.
 *
 * @param {string} text - Text to convert to speech
 * @param {object} options - Optional overrides
 * @param {string} options.voiceId - Voice to use (default from config)
 * @param {AbortSignal} options.signal - AbortSignal for cancellation (barge-in)
 * @returns {Promise<Buffer>} MP3 audio buffer
 */
async function synthesize(text, options = {}) {
    const startTime = Date.now();
    const voiceId = options.voiceId || config.inworld.voiceId;
    const signal = options.signal || null;

    const body = {
        text,
        voiceId,
        modelId: config.inworld.modelId,
        timestampType: 'WORD'
    };

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${config.inworld.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };

    // Attach abort signal for barge-in cancellation
    if (signal) {
        fetchOptions.signal = signal;
    }

    let response;

    try {
        // Apply timeout via AbortController if no external signal
        const controller = signal ? null : new AbortController();
        if (controller) {
            fetchOptions.signal = controller.signal;
            setTimeout(() => controller.abort(), TIMEOUT_MS);
        }

        response = await fetch(INWORLD_ENDPOINT, fetchOptions);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.info('[inworld] Request cancelled (barge-in or timeout)');
            throw err;
        }

        // Retry once with 1s backoff
        console.warn('[inworld] First attempt failed, retrying in 1s', { error: err.message });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const retryController = new AbortController();
        fetchOptions.signal = retryController.signal;
        setTimeout(() => retryController.abort(), TIMEOUT_MS);

        response = await fetch(INWORLD_ENDPOINT, fetchOptions);
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[inworld] API error', {
            status: response.status,
            body: errorText.substring(0, 200)
        });
        throw new Error(`Inworld TTS error: ${response.status}`);
    }

    const result = await response.json();

    // Defensive: check expected field exists
    if (!result || !result.audioContent) {
        console.error('[inworld] Unexpected response format', {
            keys: result ? Object.keys(result) : 'null'
        });
        throw new Error('Inworld TTS response missing audioContent');
    }

    const audioBuffer = Buffer.from(result.audioContent, 'base64');
    const latencyMs = Date.now() - startTime;

    console.info('[inworld] TTS complete', {
        textLength: text.length,
        audioSizeBytes: audioBuffer.length,
        latencyMs
    });

    return audioBuffer;
}

module.exports = { synthesize };
