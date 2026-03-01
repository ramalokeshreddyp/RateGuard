const calculateTokenBucket = ({
  nowMs,
  capacity,
  refillPerMs,
  requested,
  previousTokens,
  previousRefillMs
}) => {
  const safePreviousTokens = typeof previousTokens === 'number' ? previousTokens : capacity;
  const safePreviousRefill = typeof previousRefillMs === 'number' ? previousRefillMs : nowMs;
  const elapsedMs = Math.max(0, nowMs - safePreviousRefill);
  const refilled = elapsedMs * refillPerMs;
  const available = Math.min(capacity, safePreviousTokens + refilled);
  const allowed = available >= requested;
  const nextTokens = allowed ? available - requested : available;

  return {
    allowed,
    tokens: nextTokens,
    lastRefillMs: nowMs
  };
};

module.exports = {
  calculateTokenBucket
};
