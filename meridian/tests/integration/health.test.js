const http = require('http');
const express = require('express');
const healthRouter = require('../../server/routes/health');
const { pool } = require('../../server/db/pool');

jest.mock('../../server/db/pool', () => ({
    pool: { query: jest.fn() }
}));

describe('GET /api/health', () => {
    let app;
    let server;

    beforeAll((done) => {
        app = express();
        app.use('/api/health', healthRouter);
        server = http.createServer(app);
        server.listen(0, done);
    });

    afterAll((done) => {
        server.close(done);
    });

    it('returns 200 with status ok when database is connected', async () => {
        pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

        const port = server.address().port;
        const response = await fetch(`http://localhost:${port}/api/health`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.database).toBe('connected');
        expect(body.timestamp).toBeDefined();
        expect(body.uptime).toBeDefined();
    });

    it('returns 503 when database is disconnected', async () => {
        pool.query.mockRejectedValue(new Error('Connection refused'));

        const port = server.address().port;
        const response = await fetch(`http://localhost:${port}/api/health`);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('error');
        expect(body.database).toBe('disconnected');
    });
});
