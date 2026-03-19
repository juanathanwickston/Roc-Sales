const config = require('../config');

const CARTESIA_ENDPOINT = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2025-04-16';

/**
 * Converts text to speech using Cartesia Sonic 3.
 * Returns a Buffer of MP3 audio data.
 *
 * Supports AbortSignal for barge-in cancellation and retries once on failure.
 */
async function synthesize(text, options = {}) {
    const startTime = Date.now();
    const signal = options.signal || null;

    // Map emotion tags to Cartesia generation_config emotion values
    const emotionMap = {
        skeptical: 'curiosity:low',
        warm: 'positivity:high',
        defensive: 'anger:low',
        frustrated: 'anger:high',
        interested: 'curiosity:high',
        neutral: 'neutral',
        hesitant: 'surprise:low',
        firm: 'anger:low',
        friendly: 'positivity:high',
        impatient: 'anger:low'
    };

    const emotion = options.emotionTag
        ? (emotionMap[options.emotionTag] || 'neutral')
        : 'neutral';

    const requestBody = {
        model_id: 'sonic-3',
        transcript: text,
        voice: {
            mode: 'id',
            id: config.cartesia.voiceId
        },
        output_format: {
            container: 'mp3',
            encoding: 'pcm_f32le',
            sample_rate: 24000
        },
        language: 'en',
        generation_config: {
            speed: 1,
            emotion: emotion
        }
    };

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
