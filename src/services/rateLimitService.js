const { redisClient } = require('../config/redis');
const { calculateTokenBucket } = require('./tokenBucketMath');

const TOKEN_BUCKET_LUA_SCRIPT = `
local key = KEYS[1]

local nowMs = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillPerMs = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local previousTokens = tonumber(data[1])
local previousRefill = tonumber(data[2])

if previousTokens == nil then
  previousTokens = capacity
end

if previousRefill == nil then
  previousRefill = nowMs
end

local elapsedMs = nowMs - previousRefill
if elapsedMs < 0 then
  elapsedMs = 0
end

local available = previousTokens + (elapsedMs * refillPerMs)
if available > capacity then
  available = capacity
end

local allowed = 0
if available >= 1 then
  allowed = 1
  available = available - 1
end

redis.call('HMSET', key, 'tokens', tostring(available), 'lastRefill', tostring(nowMs))
redis.call('PEXPIRE', key, ttlMs)

return { allowed, tostring(available), tostring(nowMs) }
`;

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

  let allowed;
  let tokens;

  try {
    const [allowedRaw, tokensRaw] = await redisClient.eval(
      TOKEN_BUCKET_LUA_SCRIPT,
      1,
      key,
      String(nowMs),
      String(maxRequests),
      String(refillPerMs),
      String(ttlMs)
    );

    allowed = Number(allowedRaw) === 1;
    tokens = parseFloat(tokensRaw);
  } catch (error) {
    const [tokensRaw, lastRefillRaw] = await redisClient.hmget(key, 'tokens', 'lastRefill');

    const previousTokens = tokensRaw !== null ? parseFloat(tokensRaw) : undefined;
    const previousRefillMs = lastRefillRaw !== null ? parseFloat(lastRefillRaw) : undefined;

    const fallbackResult = calculateTokenBucket({
      nowMs,
      capacity: maxRequests,
      refillPerMs,
      requested: 1,
      previousTokens,
      previousRefillMs
    });

    allowed = fallbackResult.allowed;
    tokens = fallbackResult.tokens;

    await redisClient
      .pipeline()
      .hmset(key, 'tokens', String(tokens), 'lastRefill', String(fallbackResult.lastRefillMs))
      .pexpire(key, ttlMs)
      .exec();
  }

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
