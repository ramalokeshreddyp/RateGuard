const pino = require('pino');
const config = require('./index');

const logger = pino({
  level: config.logLevel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;