const sessionService = require('../../server/services/sessionService');
const { pool } = require('../../server/db/pool');

jest.mock('../../server/db/pool', () => ({
    pool: { query: jest.fn() }
}));

describe('sessionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('creates a session in the database', async () => {
            const mockSession = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                status: 'waiting',
                created_at: '2026-03-18T00:00:00Z'
            };

            pool.query.mockResolvedValue({ rows: [mockSession] });

            const result = await sessionService.create();

            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(result.id).toBe(mockSession.id);
            expect(result.status).toBe('waiting');
        });
    });

    describe('getById', () => {
        it('returns the session when it exists', async () => {
            const mockSession = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                status: 'waiting'
            };
            pool.query.mockResolvedValue({ rows: [mockSession] });

            const result = await sessionService.getById(mockSession.id);

            expect(result).toEqual(mockSession);
        });

        it('returns null when session does not exist', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            const result = await sessionService.getById('550e8400-e29b-41d4-a716-446655440000');

            expect(result).toBeNull();
        });
    });

    describe('start', () => {
        it('updates session status to active', async () => {
            const mockSession = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                status: 'waiting'
            };
            const mockStarted = {
                ...mockSession,
                status: 'active',
                started_at: new Date().toISOString()
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockSession] })
                .mockResolvedValueOnce({ rows: [mockStarted] });

            const result = await sessionService.start(mockSession.id);

            expect(result.status).toBe('active');
        });

        it('throws NotFoundError when session does not exist', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            await expect(
                sessionService.start('550e8400-e29b-41d4-a716-446655440000')
            ).rejects.toThrow('Session not found');
        });
    });

    describe('end', () => {
        it('calculates duration and updates session status', async () => {
            const startedAt = new Date(Date.now() - 600000);
            const mockSession = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                started_at: startedAt.toISOString(),
                status: 'active'
            };
            const mockEnded = {
                ...mockSession,
                status: 'ended',
                ended_at: new Date().toISOString(),
                duration_seconds: 600
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockSession] })
                .mockResolvedValueOnce({ rows: [mockEnded] });

            const result = await sessionService.end(mockSession.id);

            expect(result.status).toBe('ended');
            expect(pool.query).toHaveBeenCalledTimes(2);
        });

        it('throws NotFoundError when session does not exist', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            await expect(
                sessionService.end('550e8400-e29b-41d4-a716-446655440000')
            ).rejects.toThrow('Session not found');
        });
    });
});
