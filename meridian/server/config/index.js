const requiredNow = ['PORT', 'DATABASE_URL'];
const requiredLater = ['CLAUDE_API_KEY', 'DEEPGRAM_API_KEY', 'INWORLD_API_KEY', 'REPLICATE_API_TOKEN'];

const missing = requiredNow.filter(key => !process.env[key]);
if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const warnMissing = requiredLater.filter(key => !process.env[key]);
if (warnMissing.length > 0) {
    console.warn(`[config] Not yet configured (needed in later phases): ${warnMissing.join(', ')}`);
}

module.exports = {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    db: {
        connectionString: process.env.DATABASE_URL
    },
    claude: {
        apiKey: process.env.CLAUDE_API_KEY || null
    },
    deepgram: {
        apiKey: process.env.DEEPGRAM_API_KEY || null
    },
    inworld: {
        apiKey: process.env.INWORLD_API_KEY || null
    },
    replicate: {
        apiToken: process.env.REPLICATE_API_TOKEN || null
    }
};
