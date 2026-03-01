const Joi = require('joi');
const clientService = require('../services/clientService');
const validateBody = require('../middleware/validate');

const registerClientSchema = Joi.object({
  clientId: Joi.string().trim().min(3).max(100).required(),
  apiKey: Joi.string().min(8).max(256).required(),
  maxRequests: Joi.number().integer().min(1).optional(),
  windowSeconds: Joi.number().integer().min(1).optional()
});

const registerClient = async (req, res, next) => {
  try {
    const client = await clientService.registerClient(req.body);
    return res.status(201).json(client);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerClientSchema,
  registerClientValidation: validateBody(registerClientSchema),
  registerClient
};
