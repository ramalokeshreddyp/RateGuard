const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const { mongoose } = require('./config/db');
const { redisClient } = require('./config/redis');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || uuidv4(),
    customProps: (req) => ({ requestId: req.id })
  })
);

app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;

  try {
    redisOk = (await redisClient.ping()) === 'PONG';
  } catch (error) {
    redisOk = false;
  }

  if (!mongoOk || !redisOk) {
    return res.status(503).json({ status: 'degraded', mongoOk, redisOk });
  }

  return res.status(200).json({ status: 'ok', mongoOk, redisOk });
});

app.use(routes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

module.exports = app;
