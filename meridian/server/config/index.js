const requiredNow = ['PORT', 'DATABASE_URL', 'OPENAI_API_KEY'];

for (const key of requiredNow) {
    if (!process.env[key]) {
        console.error(`Missing required env var: ${key}`);
        process.exit(1);
    }
}

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    logLevel: process.env.LOG_LEVEL || 'info',
    db: {
        connectionString: process.env.DATABASE_URL
    },
    openaiRealtime: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-realtime',
        voice: 'cedar'
    },
    replicate: {
        apiToken: process.env.REPLICATE_API_TOKEN || null
    }
};
