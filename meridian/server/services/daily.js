const config = require('../config');
const logger = require('../lib/logger');
const { ExternalApiError } = require('../lib/errors');

const DAILY_API_BASE = 'https://api.daily.co/v1';
const DEFAULT_TIMEOUT = 10000;

async function apiCall(method, endpoint, body) {
    const url = `${DAILY_API_BASE}${endpoint}`;
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.daily.apiKey}`
            },
            signal: controller.signal
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const latency = Date.now() - start;

        logger.info('Daily.co API call', {
            method,
            endpoint,
            status: response.status,
            latencyMs: latency
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new ExternalApiError(
                `Daily.co returned ${response.status}: ${errorBody}`,
                'daily'
            );
        }

        return await response.json();
    } catch (err) {
        if (err instanceof ExternalApiError) {
            throw err;
        }
        if (err.name === 'AbortError') {
            throw new ExternalApiError('Daily.co request timed out', 'daily');
        }
        throw new ExternalApiError(`Daily.co request failed: ${err.message}`, 'daily');
    } finally {
        clearTimeout(timeout);
    }
}

async function withRetry(fn) {
    try {
        return await fn();
    } catch (err) {
        logger.warn('Daily.co call failed, retrying once', {
            error: err.message,
            service: 'daily'
        });
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await fn();
    }
}

async function createRoom() {
    return withRetry(() => apiCall('POST', '/rooms', {
        properties: {
            max_participants: 2,
            exp: Math.floor(Date.now() / 1000) + (30 * 60),
            enable_chat: false,
            enable_screenshare: false
        }
    }));
}

async function generateToken(roomName) {
    return withRetry(() => apiCall('POST', '/meeting-tokens', {
        properties: {
            room_name: roomName,
            exp: Math.floor(Date.now() / 1000) + (30 * 60),
            is_owner: false
        }
    }));
}

async function deleteRoom(roomName) {
    return apiCall('DELETE', `/rooms/${roomName}`);
}

module.exports = { createRoom, generateToken, deleteRoom };
