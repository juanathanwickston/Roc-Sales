const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Keys that must never appear in log output
const SENSITIVE_KEYS = ['apiKey', 'apiToken', 'password', 'secret', 'token', 'connectionString', 'authorization'];

let currentLevel = 'info';

function setLevel(level) {
    if (LEVELS[level] !== undefined) {
        currentLevel = level;
    }
}

function stripSensitive(context) {
    if (!context || typeof context !== 'object') {
        return context;
    }
    const cleaned = {};
    for (const [key, value] of Object.entries(context)) {
        if (SENSITIVE_KEYS.includes(key)) {
            cleaned[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = stripSensitive(value);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function formatEntry(level, message, context) {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(context ? { context: stripSensitive(context) } : {})
    });
}

function log(level, message, context) {
    if (LEVELS[level] < LEVELS[currentLevel]) {
        return;
    }
    const entry = formatEntry(level, message, context);
    if (level === 'error') {
        console.error(entry);
    } else if (level === 'warn') {
        console.warn(entry);
    } else {
        console.log(entry);
    }
}

module.exports = {
    setLevel,
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context)
};
