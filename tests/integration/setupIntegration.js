const { connectMongo, disconnectMongo } = require('../../src/config/db');
const { redisClient, disconnectRedis } = require('../../src/config/redis');
const Client = require('../../src/models/Client');

beforeAll(async () => {
  await connectMongo();
  await redisClient.ping();
});

beforeEach(async () => {
  await Client.deleteMany({});
  await redisClient.flushdb();
});

afterAll(async () => {
  await Client.deleteMany({});
  await redisClient.flushdb();
  await disconnectRedis();
  await disconnectMongo();
});
