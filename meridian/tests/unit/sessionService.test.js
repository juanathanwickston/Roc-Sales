const sessionService = require('../../server/services/sessionService');
const daily = require('../../server/services/daily');
const { pool } = require('../../server/db/pool');

// Mock dependencies
jest.mock('../../server/services/daily');
jest.mock('../../server/db/pool', () => ({
    pool: { query: jest.fn() }
}));

describe('sessionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('calls daily.createRoom and stores the session in the database', async () => {
            const mockRoom = { name: 'test-room', url: 'https://test.daily.co/test-room' };
            const mockToken = { token: 'test-token-123' };
            const mockSession = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                daily_room_url: mockRoom.url,
                daily_room_name: mockRoom.name,
                status: 'waiting',
                created_at: '2026-03-18T00:00:00Z'
            };

            daily.createRoom.mockResolvedValue(mockRoom);
            daily.generateToken.mockResolvedValue(mockToken);
            pool.query.mockResolvedValue({ rows: [mockSession] });

            const result = await sessionService.create();

            expect(daily.createRoom).toHaveBeenCalledTimes(1);
            expect(daily.generateToken).toHaveBeenCalledWith(mockRoom.name);
            expect(pool.query).toHaveBeenCalledTimes(1);
            expect(result.id).toBe(mockSession.id);
            expect(result.roomUrl).toBe(mockRoom.url);
            expect(result.token).toBe(mockToken.token);
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

    describe('end', () => {
        it('calculates duration and updates session status', async () => {
            const startedAt = new Date(Date.now() - 600000); // 10 minutes ago
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

            // First call is getById, second is end query
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
