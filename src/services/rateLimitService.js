const { redisClient } = require('../config/redis');
const { calculateTokenBucket } = require('./tokenBucketMath');

const buildRedisKey = (clientId, path) => {
  const encodedPath = Buffer.from(path).toString('base64url');
  return `ratelimit:${clientId}:${encodedPath}`;
};

const checkRateLimit = async ({ clientId, path, maxRequests, windowSeconds }) => {
  const nowMs = Date.now();
  const refillPerSecond = maxRequests / windowSeconds;
  const refillPerMs = refillPerSecond / 1000;
  const key = buildRedisKey(clientId, path);
  const ttlMs = windowSeconds * 2000;

  // Read existing bucket state from Redis
  const [tokensRaw, lastRefillRaw] = await redisClient.hmget(key, 'tokens', 'lastRefill');

  const previousTokens = tokensRaw !== null ? parseFloat(tokensRaw) : undefined;
  const previousRefillMs = lastRefillRaw !== null ? parseFloat(lastRefillRaw) : undefined;

  // Run pure-JS token bucket calculation (works with ioredis-mock in unit tests)
  const { allowed, tokens, lastRefillMs } = calculateTokenBucket({
    nowMs,
    capacity: maxRequests,
    refillPerMs,
    requested: 1,
    previousTokens,
    previousRefillMs
  });

  // Persist updated state back to Redis via pipeline
  await redisClient
    .pipeline()
    .hmset(key, 'tokens', String(tokens), 'lastRefill', String(lastRefillMs))
    .pexpire(key, ttlMs)
    .exec();

  const remainingRequests = Math.max(0, Math.floor(tokens));
  const msUntilNextToken = Math.max(0, Math.ceil(((1 - tokens) / refillPerSecond) * 1000));
  const retryAfter = Math.max(1, Math.ceil(msUntilNextToken / 1000));
  const resetAtMs =
    nowMs + Math.max(0, Math.ceil(((maxRequests - tokens) / refillPerSecond) * 1000));
  const retryAtMs = nowMs + msUntilNextToken;

  return {
    allowed,
    remainingRequests,
    retryAfter,
    resetTime: new Date(allowed ? resetAtMs : retryAtMs).toISOString()
  };
};

module.exports = {
  checkRateLimit
};
