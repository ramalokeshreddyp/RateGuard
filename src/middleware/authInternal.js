const config = require('../config');
const ApiError = require('../utils/ApiError');

const requireInternalApiKey = (req, res, next) => {
  const provided = req.header('x-internal-api-key');

  if (!provided || provided !== config.internalApiKey) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  return next();
};

module.exports = requireInternalApiKey;
