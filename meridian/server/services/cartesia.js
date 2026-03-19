const config = require('../config');
const crypto = require('crypto');

const CARTESIA_ENDPOINT = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2026-03-01';

/**
 * Maps emotion tags from Claude to Cartesia generation_config.emotion values.
 * Format: "emotion_name:level" combined with spaces in a single string.
 * Source: Cartesia API docs, pipecat-ai integration (2026-03).
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
    interested: 'curiosity:high positivity:low',
    amused: 'positivity:high surprise:low'
};

/**
 * Determines speech speed based on sentence characteristics.
 * Based on measured data from real sales call recordings:
 * - Short acks fast (1.2x)
 * - Deliberation/hedging sentences slower (0.8x): questions, sentences starting with Uh/Well/Oh
 * - Listing/rushing sentences faster (1.1x)
 * - Everything else normal (1.0x)
 */
function getSpeedForText(text) {
    const wordCount = text.split(/\s+/).length;
    const trimmed = text.trim();

    // Very short (1-3 words): fast, like "Yeah" or "Okay" or "Right, right"
    if (wordCount <= 3) return 1.2;

    // Deliberation: sentences starting with Uh/Well/Oh or containing a question
    const startsWithHedge = /^(uh|um|well|oh|hmm)\b/i.test(trimmed);
    const isQuestion = trimmed.endsWith('?');
    if (startsWithHedge || isQuestion) return 0.85;

    // Short sentences (4-8 words): slightly faster conversational pace
    if (wordCount <= 8) return 1.1;

    // Medium (9-15 words): default pace
    if (wordCount <= 15) return 1.0;

    // Long (16+ words): slower for clarity
    return 0.9;
}

/**
 * Converts text to speech using Cartesia Sonic 3.
 * Returns a Buffer of MP3 audio data.
 *
 * Uses context_id to maintain prosodic continuity across sentences
 * within the same turn. This prevents each sentence from sounding
 * like a fresh start.
 */
async function synthesize(text, options = {}) {
    const startTime = Date.now();
    const signal = options.signal || null;

    // Emotion mapping
    const emotionTag = options.emotionTag || null;
    const emotionValue = emotionTag ? (EMOTION_MAP[emotionTag] || null) : null;

    // Speed based on sentence length
    const speed = getSpeedForText(text);

    // Context ID for prosodic continuity within a turn
    const contextId = options.contextId || null;

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

    // Context continuation: same context_id across sentences keeps prosody flowing
    if (contextId) {
        requestBody.context_id = contextId;
    }

    // Build generation_config with emotion and speed
    const genConfig = {};
    if (emotionValue) genConfig.emotion = emotionValue;
    if (speed !== 1.0) genConfig.speed = speed;
    if (Object.keys(genConfig).length > 0) {
        requestBody.generation_config = genConfig;
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

    console.info('[cartesia] TTS request', {
        textLen: text.length,
        textPreview: text.substring(0, 60),
        emotionTag,
        emotionValue: emotionValue || 'none',
        speed,
        contextId: contextId ? contextId.substring(0, 8) : 'none'
    });

    let response;

    try {
        response = await fetch(CARTESIA_ENDPOINT, fetchOptions);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.info('[cartesia] Request cancelled (barge-in or timeout)');
            throw err;
        }

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
            emotionValue,
            speed
        });
        throw new Error(`Cartesia TTS error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const latencyMs = Date.now() - startTime;
    console.info('[cartesia] TTS complete', {
        textLen: text.length,
        audioBytes: audioBuffer.length,
        latencyMs,
        emotionTag: emotionTag || 'none',
        speed
    });

    return audioBuffer;
}

/**
 * Generates a context ID for prosodic continuity within a turn.
 * All sentences in the same turn share a context_id so Cartesia
 * maintains consistent prosody across them.
 */
function createContextId() {
    return crypto.randomUUID();
}

module.exports = { synthesize, createContextId };
