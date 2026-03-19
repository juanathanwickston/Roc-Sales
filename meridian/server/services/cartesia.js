const config = require('../config');

const CARTESIA_ENDPOINT = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2026-03-01';

/**
 * Maps emotion tags from Claude to Cartesia generation_config.emotion values.
 * Cartesia supports combined emotions (space-separated) for nuanced expression.
 * Voices tagged as "emotive" (e.g. Tessa, Maya) respond best to these.
 */
const EMOTION_MAP = {
    neutral: null,
    curious: 'curiosity:high',
    skeptical: 'curiosity:low sadness:low',
    warm: 'positivity:high',
    annoyed: 'anger:low surprise:low',
    hesitant: 'sadness:low surprise:low',
    firm: 'anger:low positivity:low',
    friendly: 'positivity:high curiosity:low',
    impatient: 'anger:medium',
    frustrated: 'anger:high sadness:low',
    interested: 'curiosity:high positivity:low'
};

/**
 * Converts text to speech using Cartesia Sonic 3.
 * Returns a Buffer of MP3 audio data.
 *
 * Emotion tags from Claude are mapped to Cartesia's generation_config.emotion
 * for expressive, non-robotic delivery.
 *
 * Supports AbortSignal for barge-in cancellation and retries once on failure.
 */
async function synthesize(text, options = {}) {
    const startTime = Date.now();
    const signal = options.signal || null;

    // Build emotion config from tag
    const emotionTag = options.emotionTag || null;
    const emotionValue = emotionTag ? (EMOTION_MAP[emotionTag] || null) : null;

    const requestBody = {
        model_id: 'sonic-3',
        transcript: text,
        voice: {
            mode: 'id',
            id: config.cartesia.voiceId
        },
        output_format: {
            container: 'mp3',
            bit_rate: 128000,
            sample_rate: 48000
        },
        language: 'en'
    };

    // Only add emotion if we have a non-neutral tag
    if (emotionValue) {
        requestBody.generation_config = {
            emotion: [emotionValue]
        };
    }

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.cartesia.apiKey}`,
            'Cartesia-Version': CARTESIA_VERSION,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
    };

    let response;

    try {
        response = await fetch(CARTESIA_ENDPOINT, fetchOptions);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.info('[cartesia] Request cancelled (barge-in or timeout)');
            throw err;
        }

        // Retry once after 500ms
        console.warn('[cartesia] First attempt failed, retrying in 500ms', { error: err.message });
        await new Promise((r) => setTimeout(r, 500));

        try {
            response = await fetch(CARTESIA_ENDPOINT, fetchOptions);
        } catch (retryErr) {
            if (retryErr.name === 'AbortError') throw retryErr;
            throw retryErr;
        }
    }

    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        console.error('[cartesia] API error', {
            status: response.status,
            body: errorBody.substring(0, 200)
        });
        throw new Error(`Cartesia TTS error: ${response.status}`);
    }

    // Response is raw audio bytes
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const latencyMs = Date.now() - startTime;
    console.info('[cartesia] TTS complete', {
        textLen: text.length,
        audioBytes: audioBuffer.length,
        latencyMs
    });

    return audioBuffer;
}

module.exports = { synthesize };
