const logger = require('../lib/logger');

function errorHandler(err, req, res, _next) {
    const status = err.status || 500;
    const message = status === 500 ? 'Internal server error' : err.message;

    logger.error('Request error', {
        status,
        message: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack
    });

    res.status(status).json({
        error: {
            message,
            status
        }
    });
}

module.exports = errorHandler;
