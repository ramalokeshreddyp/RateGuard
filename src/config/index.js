require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017/ratelimitdb',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  defaultMaxRequests: toInt(process.env.DEFAULT_RATE_LIMIT_MAX_REQUESTS, 100),
  defaultWindowSeconds: toInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_SECONDS, 60),
  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-key',
  logLevel: process.env.LOG_LEVEL || 'info'
};