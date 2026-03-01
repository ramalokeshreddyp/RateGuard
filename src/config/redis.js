const Redis = require('ioredis');
const config = require('./index');
const logger = require('./logger');

const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true
});

redisClient.on('connect', () => {
  logger.info({ redisUrl: config.redisUrl }, 'Redis connected');
});

redisClient.on('error', (error) => {
  logger.error({ err: error }, 'Redis error');
});

const disconnectRedis = async () => {
  await redisClient.quit();
};

module.exports = {
  redisClient,
  disconnectRedis
};
