const ApiError = require('../utils/ApiError');

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return next(new ApiError(400, error.details.map((detail) => detail.message).join(', ')));
  }

  req.body = value;
  return next();
};

module.exports = validateBody;
