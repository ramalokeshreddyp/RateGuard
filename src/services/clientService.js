const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const hashApiKeyFingerprint = (apiKey) =>
  crypto.createHash('sha256').update(apiKey).digest('hex');

const registerClient = async ({ clientId, apiKey, maxRequests, windowSeconds }) => {
  const hashedApiKey = await bcrypt.hash(apiKey, 12);
  const apiKeyFingerprint = hashApiKeyFingerprint(apiKey);

  const payload = {
    clientId,
    hashedApiKey,
    apiKeyFingerprint,
    maxRequests: maxRequests || config.defaultMaxRequests,
    windowSeconds: windowSeconds || config.defaultWindowSeconds
  };

  try {
    const client = await Client.create(payload);

    return {
      clientId: client.clientId,
      maxRequests: client.maxRequests,
      windowSeconds: client.windowSeconds
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'clientId or apiKey already exists');
    }

    throw error;
  }
};

const getClientByClientId = async (clientId) => Client.findOne({ clientId }).lean();

module.exports = {
  registerClient,
  getClientByClientId
};
