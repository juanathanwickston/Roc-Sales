const requiredNow = ['PORT', 'DATABASE_URL', 'CLAUDE_API_KEY', 'DEEPGRAM_API_KEY', 'CARTESIA_API_KEY'];
const requiredLater = ['REPLICATE_API_TOKEN'];

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
        apiKey: process.env.CLAUDE_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        maxTokens: 300
    },
    deepgram: {
        apiKey: process.env.DEEPGRAM_API_KEY,
        model: 'nova-3',
        endpointing: 800
    },
    cartesia: {
        apiKey: process.env.CARTESIA_API_KEY,
        voiceId: process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091'
    },
    replicate: {
        apiToken: process.env.REPLICATE_API_TOKEN || null
    }
};

