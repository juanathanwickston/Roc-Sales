require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const config = require('./config');
const logger = require('./lib/logger');
const createSecurityMiddleware = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const { testConnection } = require('./db/pool');

// Set log level from config
logger.setLevel(config.logLevel);

const app = express();

// Security middleware
const security = createSecurityMiddleware();
security.forEach(mw => app.use(mw));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Static file serving
app.use(express.static(path.join(__dirname, '..', 'client')));

// Page routes
app.use('/', require('./routes/pages'));

// API routes
app.use('/api/health', require('./routes/health'));
app.use('/api/sessions', require('./routes/sessions'));

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server for real-time audio pipeline
const { setupWebSocket } = require('./ws/handler');
setupWebSocket(server);

async function start() {
    const dbConnected = await testConnection();
    if (!dbConnected) {
        logger.warn('Server starting without database connection');
    }

    server.listen(config.port, () => {
        logger.info('Server started', {
            port: config.port,
            env: config.nodeEnv
        });
    });
}

start();

module.exports = { app, server };
