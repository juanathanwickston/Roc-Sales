const requiredNow = ['PORT', 'DATABASE_URL', 'GEMINI_API_KEY'];

const requiredLater = [];

for (const key of requiredNow) {
    if (!process.env[key]) {
        console.error(`Missing required env var: ${key}`);
        process.exit(1);
    }
}

for (const key of requiredLater) {
    if (!process.env[key]) {
        console.warn(`Optional env var not set: ${key}`);
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
    geminiLive: {
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Erinome'
    },
    replicate: {
        apiToken: process.env.REPLICATE_API_TOKEN || null
    }
};
