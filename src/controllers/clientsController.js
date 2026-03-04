const Joi = require('joi');
const clientService = require('../services/clientService');
const validateBody = require('../middleware/validate');
const ApiError = require('../utils/ApiError');

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

const getClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const client = await clientService.getClientByClientId(clientId);

    if (!client) {
      throw new ApiError(404, 'Client not found');
    }

    return res.status(200).json({
      clientId: client.clientId,
      maxRequests: client.maxRequests,
      windowSeconds: client.windowSeconds
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerClientSchema,
  registerClientValidation: validateBody(registerClientSchema),
  registerClient,
  getClient
};
