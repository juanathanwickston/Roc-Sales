const config = require('../config');

const CARTESIA_ENDPOINT = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2026-03-01';

/**
 * Maps emotion tags from Claude to Cartesia generation_config.emotion values.
 *
 * Evidence: Cartesia Sonic 3 docs confirm generation_config.emotion accepts
 * a SINGLE STRING, not an array. Format: "emotion_name:level" where level
 * is one of: lowest, low, high, highest. Multiple emotions can be combined
 * with spaces in a single string: "positivity:high curiosity:low".
 *
 * Source: Cartesia API reference, pipecat-ai integration docs (2026-03).
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
    impatient: 'anger:high',
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

    // Add generation_config with emotion (single string, NOT array)
    // and speed for natural pacing
    if (emotionValue) {
        requestBody.generation_config = {
            emotion: emotionValue,
            speed: 'normal'
        };
    } else {
        requestBody.generation_config = {
            speed: 'normal'
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

    // Log the request for debugging emotion delivery
    console.info('[cartesia] TTS request', {
        textLen: text.length,
        textPreview: text.substring(0, 60),
        emotionTag,
        emotionValue: emotionValue || 'none'
    });

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
            body: errorBody.substring(0, 200),
            emotionTag,
            emotionValue
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
        latencyMs,
        emotionTag: emotionTag || 'none'
    });

    return audioBuffer;
}

module.exports = { synthesize };
