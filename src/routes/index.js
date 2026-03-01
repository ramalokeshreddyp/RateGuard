const express = require('express');
const clientsRoutes = require('./clientsRoutes');
const rateLimitRoutes = require('./rateLimitRoutes');

const router = express.Router();

router.use('/api/v1', clientsRoutes);
router.use('/api/v1', rateLimitRoutes);

module.exports = router;
