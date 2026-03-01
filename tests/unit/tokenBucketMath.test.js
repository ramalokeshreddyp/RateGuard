const { calculateTokenBucket } = require('../../src/services/tokenBucketMath');

describe('Token bucket math', () => {
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
});
