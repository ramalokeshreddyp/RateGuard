const logger = require('../config/logger');

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error' : error.message;

  logger.error(
    {
      requestId: req.id,
      statusCode,
      err: error,
      path: req.originalUrl,
      method: req.method
    },
    'Request failed'
  );

  res.status(statusCode).json({ message });
  next();
};

module.exports = errorHandler;
