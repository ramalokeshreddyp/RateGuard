const mongoose = require('mongoose');
const config = require('./index');
const logger = require('./logger');

const connectMongo = async () => {
  await mongoose.connect(config.mongoUri);
  logger.info({ mongoUri: config.mongoUri }, 'MongoDB connected');
};

const disconnectMongo = async () => {
  await mongoose.connection.close();
};

module.exports = {
  connectMongo,
  disconnectMongo,
  mongoose
};
