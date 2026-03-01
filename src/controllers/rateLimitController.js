const Joi = require('joi');
const validateBody = require('../middleware/validate');
const clientService = require('../services/clientService');
const rateLimitService = require('../services/rateLimitService');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const checkRateLimitSchema = Joi.object({
  clientId: Joi.string().trim().min(3).max(100).required(),
  path: Joi.string().trim().min(1).max(500).required()
});

const checkRateLimit = async (req, res, next) => {
  try {
    const { clientId, path } = req.body;
    const client = await clientService.getClientByClientId(clientId);

    if (!client) {
      throw new ApiError(404, 'Client not found');
    }

    const maxRequests = client.maxRequests || config.defaultMaxRequests;
    const windowSeconds = client.windowSeconds || config.defaultWindowSeconds;

    const result = await rateLimitService.checkRateLimit({
      clientId,
      path,
      maxRequests,
      windowSeconds
    });

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      return res.status(429).json({
        allowed: false,
        retryAfter: result.retryAfter,
        resetTime: result.resetTime
      });
    }

    return res.status(200).json({
      allowed: true,
      remainingRequests: result.remainingRequests,
      resetTime: result.resetTime
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  checkRateLimitSchema,
  checkRateLimitValidation: validateBody(checkRateLimitSchema),
  checkRateLimit
};
