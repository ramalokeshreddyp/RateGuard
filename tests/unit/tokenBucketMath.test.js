const { calculateTokenBucket } = require('../../src/services/tokenBucketMath');

describe('Token bucket math', () => {
  // --- Original tests ---
  test('allows request when capacity available', () => {
    const result = calculateTokenBucket({
      nowMs: 1000,
      capacity: 10,
      refillPerMs: 0.1,
      requested: 1,
      previousTokens: 10,
      previousRefillMs: 900
    });

    expect(result.allowed).toBe(true);
    expect(result.tokens).toBeGreaterThanOrEqual(9);
  });

  test('blocks request when no tokens and no refill elapsed', () => {
    const result = calculateTokenBucket({
      nowMs: 1000,
      capacity: 5,
      refillPerMs: 0.001,
      requested: 1,
      previousTokens: 0.2,
      previousRefillMs: 1000
    });

    expect(result.allowed).toBe(false);
    expect(result.tokens).toBeCloseTo(0.2);
  });

  test('refills over time and allows after refill', () => {
    const result = calculateTokenBucket({
      nowMs: 5000,
      capacity: 3,
      refillPerMs: 0.001,
      requested: 1,
      previousTokens: 0,
      previousRefillMs: 3500
    });

    expect(result.allowed).toBe(true);
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.tokens).toBeLessThan(3);
  });

  // --- Edge cases ---
  test('first request with no prior state defaults to full capacity', () => {
    const result = calculateTokenBucket({
      nowMs: 1000,
      capacity: 5,
      refillPerMs: 0.01,
      requested: 1,
      previousTokens: undefined,
      previousRefillMs: undefined
    });

    // Full bucket (5) - 1 requested = 4 remaining
    expect(result.allowed).toBe(true);
    expect(result.tokens).toBeCloseTo(4);
  });

  test('tokens are capped at capacity after long idle window', () => {
    const result = calculateTokenBucket({
      nowMs: 1_000_000,
      capacity: 10,
      refillPerMs: 1,   // would generate millions of tokens if uncapped
      requested: 1,
      previousTokens: 0,
      previousRefillMs: 0
    });

    // Resulting tokens must never exceed capacity
    expect(result.tokens).toBeLessThanOrEqual(10);
    expect(result.allowed).toBe(true);
  });

  test('blocks when available tokens are fractionally below request amount', () => {
    const result = calculateTokenBucket({
      nowMs: 1000,
      capacity: 5,
      refillPerMs: 0.001,
      requested: 3,
      previousTokens: 2.9,
      previousRefillMs: 1000  // zero elapsed → no refill
    });

    expect(result.allowed).toBe(false);
    expect(result.tokens).toBeCloseTo(2.9);
  });

  test('zero elapsed time does not change token count', () => {
    const result = calculateTokenBucket({
      nowMs: 5000,
      capacity: 10,
      refillPerMs: 0.5,
      requested: 1,
      previousTokens: 7,
      previousRefillMs: 5000   // same timestamp → zero elapsed
    });

    expect(result.allowed).toBe(true);
    expect(result.tokens).toBeCloseTo(6);  // 7 - 1, no refill
  });

  test('lastRefillMs on result matches nowMs input', () => {
    const result = calculateTokenBucket({
      nowMs: 9999,
      capacity: 5,
      refillPerMs: 0.01,
      requested: 1,
      previousTokens: 5,
      previousRefillMs: 9000
    });

    expect(result.lastRefillMs).toBe(9999);
  });
});
