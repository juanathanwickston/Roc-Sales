const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const EventEmitter = require('events');

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

/**
 * Creates a Claude conversation engine for a single session.
 * Maintains conversation history and streams responses sentence by sentence.
 */
function createClaudeEngine(promptFile = 'default_buyer_v1.md') {
    const emitter = new EventEmitter();
    const client = new Anthropic({ apiKey: config.claude.apiKey });
    const conversationHistory = [];
    let systemPrompt = '';

    // Load system prompt from file
    const promptPath = path.join(PROMPTS_DIR, promptFile);
    try {
        systemPrompt = fs.readFileSync(promptPath, 'utf-8').trim();
    } catch (err) {
        console.error('[claude] Failed to load prompt file', {
            path: promptPath,
            error: err.message
        });
        throw new Error('System prompt not found');
    }

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
            const stream = client.messages.stream({
                model: config.claude.model,
                max_tokens: config.claude.maxTokens,
                system: systemPrompt,
                messages: conversationHistory
            });

            for await (const text of stream.textStream) {
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
                const retryStream = client.messages.stream({
                    model: config.claude.model,
                    max_tokens: config.claude.maxTokens,
                    system: systemPrompt,
                    messages: conversationHistory
                });

                fullResponse = '';
                sentenceBuffer = '';

                for await (const text of retryStream.textStream) {
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
 * Returns { complete: [{text, emotionTag}], remaining: string }.
 */
function extractSentences(buffer) {
    const complete = [];
    // Split on sentence endings followed by a space or end of string
    const sentencePattern = /([^.!?]*[.!?])(?:\s|$)/g;
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(buffer)) !== null) {
        const sentence = match[1].trim();
        if (sentence) {
            const tag = extractEmotionTag(sentence);
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

    return { text: text.trim(), emotionTag: null };
}

module.exports = { createClaudeEngine, extractSentences, extractEmotionTag };
