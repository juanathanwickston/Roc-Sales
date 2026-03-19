const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

function createSecurityMiddleware() {
    const helmetMiddleware = helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
                fontSrc: ["'self'", 'fonts.gstatic.com'],
                connectSrc: ["'self'", '*.daily.co', 'wss://*.daily.co'],
                imgSrc: ["'self'", 'data:'],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"]
            }
        }
    });

    let corsOptions;
    if (config.nodeEnv === 'production') {
        corsOptions = {
            origin: config.corsOrigin,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        };
    } else {
        corsOptions = {
            origin: '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
        };
    }
    const corsMiddleware = cors(corsOptions);

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: { message: 'Too many requests, try again later', status: 429 } }
    });

    return [helmetMiddleware, corsMiddleware, limiter];
}

module.exports = createSecurityMiddleware;
