const { redisClient } = require('../config/redis');

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillPerMs = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttlMs = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if not tokens then
  tokens = capacity
end

if not lastRefill then
  lastRefill = now
end

if now > lastRefill then
  local delta = now - lastRefill
  local refill = delta * refillPerMs
  tokens = math.min(capacity, tokens + refill)
  lastRefill = now
end

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('PEXPIRE', key, ttlMs)

return {allowed, tokens, lastRefill}
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

  const [allowedRaw, tokensRaw] = await redisClient.eval(
    LUA_TOKEN_BUCKET,
    1,
    key,
    nowMs,
    maxRequests,
    refillPerMs,
    1,
    ttlMs
  );

  const allowed = Number(allowedRaw) === 1;
  const tokens = Number(tokensRaw);
  const remainingRequests = Math.max(0, Math.floor(tokens));

  const msUntilNextToken = Math.max(0, Math.ceil(((1 - tokens) / refillPerSecond) * 1000));
  const retryAfter = Math.ceil(msUntilNextToken / 1000);
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
