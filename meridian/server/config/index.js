// Which conversation engine to use: 'gemini' or 'openai'
const conversationEngine = process.env.CONVERSATION_ENGINE || 'gemini';

const requiredNow = ['PORT', 'DATABASE_URL'];

// Require the right API key based on engine selection
if (conversationEngine === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.error('Missing required env var: GEMINI_API_KEY (engine=gemini)');
    process.exit(1);
}
if (conversationEngine === 'openai' && !process.env.OPENAI_API_KEY) {
    console.error('Missing required env var: OPENAI_API_KEY (engine=openai)');
    process.exit(1);
}

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
    conversationEngine: conversationEngine,
    db: {
        connectionString: process.env.DATABASE_URL
    },
    geminiLive: {
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-live-2.5-flash-native-audio',
        voiceName: 'Erinome'
    },
    openaiRealtime: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-realtime',
        voice: 'coral'
    },
    replicate: {
        apiToken: process.env.REPLICATE_API_TOKEN || null
    }
};
