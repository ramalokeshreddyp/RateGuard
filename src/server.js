const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { connectMongo } = require('./config/db');
const { redisClient } = require('./config/redis');

const start = async () => {
  try {
    await connectMongo();
    await redisClient.ping();

    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Rate limiting service started');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start service');
    process.exit(1);
  }
};

start();
