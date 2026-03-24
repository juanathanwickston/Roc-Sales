const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { pool } = require('../db/pool');
const sessionQueries = require('../db/queries/sessions');
const { createOrchestrator } = require('../services/orchestrator');

// Active orchestrators keyed by sessionId.
// Prevents creating a new AI session when the browser WebSocket reconnects.
const activeOrchestrators = new Map();

// Ping interval: 25 seconds keeps Railway (and most proxies) from
// treating the connection as idle and closing it.
const PING_INTERVAL_MS = 25000;

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Handles upgrade requests at /ws?session=UUID.
 */
function setupWebSocket(server) {
    const wss = new WebSocketServer({ noServer: true });

    // Server-level keepalive: ping every client on a fixed interval.
    // If a pong is not received before the next ping, the connection
    // is considered dead and is terminated.
    const pingInterval = setInterval(() => {
        wss.clients.forEach((client) => {
            if (client.isAlive === false) {
                client.terminate();
                return;
            }
            client.isAlive = false;
            client.ping();
        });
    }, PING_INTERVAL_MS);

    wss.on('close', () => clearInterval(pingInterval));

    server.on('upgrade', async (request, socket, head) => {
        try {
            const url = new URL(request.url, `http://${request.headers.host}`);

            if (url.pathname !== '/ws') {
                socket.destroy();
                return;
            }

            const sessionId = url.searchParams.get('session');
            if (!sessionId) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                socket.destroy();
                return;
            }

            // Validate session exists and is not ended
            const result = await pool.query(sessionQueries.getById, [sessionId]);
            if (result.rows.length === 0) {
                socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                socket.destroy();
                return;
            }

            const session = result.rows[0];
            if (session.status === 'ended') {
                socket.write('HTTP/1.1 410 Gone\r\n\r\n');
                socket.destroy();
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request, sessionId);
            });

        } catch (err) {
            console.error('[ws] Upgrade error', { error: err.message });
            socket.destroy();
        }
    });

    wss.on('connection', async (ws, request, sessionId) => {
        // Mark this socket as alive for ping/pong keepalive
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        console.info('[ws] Client connected', { sessionId });

        // Mark session as active
        try {
            await pool.query(sessionQueries.start, [sessionId]);
        } catch (err) {
            console.error('[ws] Failed to start session', {
                sessionId,
                error: err.message
            });
        }

        /**
         * Send a message to the connected browser client.
         * JSON messages are stringified. Binary audio is sent as-is.
         */
        function sendToClient(message) {
            if (ws.readyState !== ws.OPEN) return;

            if (message.type === 'ai_audio') {
                // Send binary audio data
                ws.send(message.data, { binary: true });
            } else {
                ws.send(JSON.stringify(message));
            }
        }

        // Check if an orchestrator already exists for this session.
        // If the browser reconnected (e.g. after a transient network drop),
        // reuse the existing orchestrator so the AI conversation continues
        // without restarting.
        const existing = activeOrchestrators.get(sessionId);
        if (existing) {
            console.info('[ws] Reconnect: reusing existing orchestrator', { sessionId });
            existing.updateSendToClient(sendToClient);

            // Wire up message and close handlers to the existing orchestrator
            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    existing.receiveAudio(data);
                }
            });

            ws.on('close', (code, reason) => {
                console.info('[ws] Client disconnected', {
                    sessionId,
                    code,
                    reason: reason.toString()
                });
                // Do NOT destroy the orchestrator on disconnect.
                // The client may reconnect. The orchestrator is cleaned up
                // only when the session is explicitly ended or times out.
            });

            ws.on('error', (err) => {
                console.error('[ws] Connection error', {
                    sessionId,
                    error: err.message
                });
            });
            return;
        }

        // First connection: create a new orchestrator
        const orchestrator = createOrchestrator(sessionId, sendToClient);
        activeOrchestrators.set(sessionId, orchestrator);

        try {
            await orchestrator.init();
        } catch (err) {
            console.error('[ws] Orchestrator init failed', {
                sessionId,
                error: err.message
            });
            activeOrchestrators.delete(sessionId);
            sendToClient({
                type: 'error',
                message: 'Failed to initialize session. Please refresh and try again.'
            });
            ws.close(4002, 'Init failed');
            return;
        }

        // Handle incoming messages from the browser
        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                // Binary = raw audio from the browser mic
                orchestrator.receiveAudio(data);
            }
            // JSON control messages can be added here in future phases
        });

        ws.on('close', (code, reason) => {
            console.info('[ws] Client disconnected', {
                sessionId,
                code,
                reason: reason.toString()
            });
            // Do NOT destroy the orchestrator on disconnect.
            // The client may reconnect.
        });

        ws.on('error', (err) => {
            console.error('[ws] Connection error', {
                sessionId,
                error: err.message
            });
        });
    });

    console.info('[ws] WebSocket server attached');
}

module.exports = { setupWebSocket, activeOrchestrators };
