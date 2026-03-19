const router = require('express').Router();
const sessionService = require('../services/sessionService');
const { validateUuid } = require('../lib/validators');

router.post('/', async (req, res, next) => {
    try {
        const session = await sessionService.create();
        res.status(201).json(session);
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        validateUuid(req.params.id, 'id');
        const session = await sessionService.getById(req.params.id);
        if (!session) {
            return res.status(404).json({
                error: { message: 'Session not found', status: 404 }
            });
        }
        res.json(session);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/end', async (req, res, next) => {
    try {
        validateUuid(req.params.id, 'id');
        const session = await sessionService.end(req.params.id);
        res.json(session);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
