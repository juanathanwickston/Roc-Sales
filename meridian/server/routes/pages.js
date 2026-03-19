const path = require('path');
const router = require('express').Router();

// Serve the live session page
router.get('/session', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'pages', 'live-session.html'));
});

module.exports = router;
