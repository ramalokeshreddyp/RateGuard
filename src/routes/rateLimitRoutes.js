const express = require('express');
const rateLimitController = require('../controllers/rateLimitController');

const router = express.Router();

router.post(
  '/ratelimit/check',
  rateLimitController.checkRateLimitValidation,
  rateLimitController.checkRateLimit
);

module.exports = router;
