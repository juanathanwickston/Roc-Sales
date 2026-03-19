const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const EventEmitter = require('events');

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');
const VOICE_BASE_FILE = 'voice_base.md';

/**
 * Creates a Claude conversation engine for a single session.
 * Maintains conversation history and streams responses sentence by sentence.
 *
 * System prompt is built from two layers:
 * 1. voice_base.md: universal speech pattern rules (contractions, fillers, SSML)
 * 2. persona file: character identity, objections, backstory
 */
function createClaudeEngine(personaFile = 'karen_chen_v1.md') {
    const emitter = new EventEmitter();
    const client = new Anthropic({ apiKey: config.claude.apiKey });
    const conversationHistory = [];
    let systemPrompt = '';

    // Load voice base (universal speech rules)
    const voiceBasePath = path.join(PROMPTS_DIR, VOICE_BASE_FILE);
    let voiceBasePrompt = '';
    try {
        voiceBasePrompt = fs.readFileSync(voiceBasePath, 'utf-8').trim();
    } catch (err) {
        console.error('[claude] Failed to load voice base prompt', {
            path: voiceBasePath,
            error: err.message
        });
        throw new Error('Voice base prompt not found');
    }

    // Load persona-specific prompt
    const personaPath = path.join(PROMPTS_DIR, personaFile);
    let personaPrompt = '';
    try {
        personaPrompt = fs.readFileSync(personaPath, 'utf-8').trim();
    } catch (err) {
        console.error('[claude] Failed to load persona prompt', {
            path: personaPath,
            error: err.message
        });
        throw new Error('Persona prompt not found');
    }

    // Combine: voice rules first, then persona
    systemPrompt = voiceBasePrompt + '\n\n' + personaPrompt;

    /**
     * Sends user text to Claude and streams the response.
     * Emits 'sentence' events as each sentence completes,
     * and 'done' when the full response is available.
     * Returns a promise that resolves with the full response text.
     */
    async function respond(userText) {
        const startTime = Date.now();
        let firstTokenTime = null;

        // Add user turn to history
        conversationHistory.push({ role: 'user', content: userText });

        let fullResponse = '';
        let sentenceBuffer = '';

        try {
            const stream = await client.messages.create({
                model: config.claude.model,
                max_tokens: config.claude.maxTokens,
                system: systemPrompt,
                messages: conversationHistory,
                stream: true
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    const text = event.delta.text;

                    if (!firstTokenTime) {
                        firstTokenTime = Date.now();
                        const ttft = firstTokenTime - startTime;
                        console.info('[claude] First token', { ttftMs: ttft });
                        emitter.emit('ttft', ttft);
                    }

                    fullResponse += text;
                    sentenceBuffer += text;

                    // Extract complete sentences from buffer
                    const sentences = extractSentences(sentenceBuffer);
                    if (sentences.complete.length > 0) {
                        for (const sentence of sentences.complete) {
                            emitter.emit('sentence', sentence.text, sentence.emotionTag);
                        }
                        sentenceBuffer = sentences.remaining;
                    }
                }
            }

            // Flush any remaining text as a final sentence
            if (sentenceBuffer.trim()) {
                const tag = extractEmotionTag(sentenceBuffer);
                emitter.emit('sentence', tag.text, tag.emotionTag);
            }

            // Add AI turn to history
            conversationHistory.push({ role: 'assistant', content: fullResponse });

            const totalMs = Date.now() - startTime;
            console.info('[claude] Response complete', {
                totalMs,
                responseLength: fullResponse.length,
                turns: conversationHistory.length
            });

            emitter.emit('done', fullResponse);
            return fullResponse;

        } catch (err) {
            console.error('[claude] API error', { error: err.message });

            // Retry once
            try {
                console.info('[claude] Retrying...');
                const retryStream = await client.messages.create({
                    model: config.claude.model,
                    max_tokens: config.claude.maxTokens,
                    system: systemPrompt,
                    messages: conversationHistory,
                    stream: true
                });

                fullResponse = '';
                sentenceBuffer = '';

                for await (const event of retryStream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        const text = event.delta.text;
                        fullResponse += text;
                        sentenceBuffer += text;

                        const sentences = extractSentences(sentenceBuffer);
                        if (sentences.complete.length > 0) {
                            for (const sentence of sentences.complete) {
                                emitter.emit('sentence', sentence.text, sentence.emotionTag);
                            }
                            sentenceBuffer = sentences.remaining;
                        }
                    }
                }

                if (sentenceBuffer.trim()) {
                    const tag = extractEmotionTag(sentenceBuffer);
                    emitter.emit('sentence', tag.text, tag.emotionTag);
                }

                conversationHistory.push({ role: 'assistant', content: fullResponse });
                emitter.emit('done', fullResponse);
                return fullResponse;

            } catch (retryErr) {
                console.error('[claude] Retry failed', { error: retryErr.message });
                emitter.emit('error', retryErr);
                throw retryErr;
            }
        }
    }

    function getHistory() {
        return conversationHistory;
    }

    function clearHistory() {
        conversationHistory.length = 0;
    }

    return {
        respond,
        getHistory,
        clearHistory,
        on: emitter.on.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter)
    };
}

/**
 * Extracts complete sentences from a text buffer.
 * Handles emotion tags like [skeptical] at the start of sentences.
 * Preserves SSML tags (break, speed, volume, emotion) without
 * splitting on periods inside angle brackets.
 * Returns { complete: [{text, emotionTag}], remaining: string }.
 */
function extractSentences(buffer) {
    const complete = [];
    // Strip SSML tags temporarily to find real sentence boundaries,
    // then map positions back to the original text with SSML intact
    const ssmlPlaceholder = '\x00';
    const ssmlTags = [];
    const stripped = buffer.replace(/<[^>]+\/?>/g, (match, offset) => {
        ssmlTags.push({ match, offset });
        return ssmlPlaceholder.repeat(match.length);
    });

    const sentencePattern = /([^.!?]*[.!?])(?:\s|$)/g;
    let lastIndex = 0;
    let sentenceMatch;

    while ((sentenceMatch = sentencePattern.exec(stripped)) !== null) {
        // Get the original text (with SSML tags) for this range
        const start = sentenceMatch.index;
        const end = start + sentenceMatch[1].length;
        const originalSentence = buffer.substring(start, end).trim();

        if (originalSentence) {
            const tag = extractEmotionTag(originalSentence);
            complete.push(tag);
        }
        lastIndex = sentencePattern.lastIndex;
    }

    return {
        complete,
        remaining: buffer.substring(lastIndex)
    };
}

/**
 * Extracts an emotion tag like [skeptical] from the beginning of text.
 * Returns { text: 'cleaned text', emotionTag: 'skeptical' | null }.
 */
function extractEmotionTag(text) {
    const tagPattern = /^\[(\w+)\]\s*/;
    const match = text.match(tagPattern);

    if (match) {
        return {
            text: text.substring(match[0].length).trim(),
            emotionTag: match[1]
        };
    }

    return { text: text.trim(), emotionTag: 'friendly' };
}

module.exports = { createClaudeEngine, extractSentences, extractEmotionTag };
