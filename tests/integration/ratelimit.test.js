require('./setupIntegration');
const request = require('supertest');
const app = require('../../src/app');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

// Helper: register a test client
const seedClient = (overrides = {}) =>
  request(app)
    .post('/api/v1/clients')
    .set('x-internal-api-key', INTERNAL_KEY)
    .send(
      Object.assign(
        {
          clientId: 'limited-client',
          apiKey: 'super-secret-key-limited',
          maxRequests: 2,
          windowSeconds: 10
        },
        overrides
      )
    );

// Helper: check rate limit
const checkLimit = (clientId, path) =>
  request(app)
    .post('/api/v1/ratelimit/check')
    .send({ clientId, path });

describe('POST /api/v1/ratelimit/check', () => {
  test('allows within limit then blocks when exceeded', async () => {
    await seedClient();

    const first = await checkLimit('limited-client', '/v1/orders');
    const second = await checkLimit('limited-client', '/v1/orders');
    const third = await checkLimit('limited-client', '/v1/orders');

    expect(first.status).toBe(200);
    expect(first.body.allowed).toBe(true);

    expect(second.status).toBe(200);
    expect(second.body.allowed).toBe(true);

    expect(third.status).toBe(429);
    expect(third.body.allowed).toBe(false);
    expect(third.body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(third.headers['retry-after']).toBeDefined();
  });

  test('200 response includes remainingRequests as integer', async () => {
    await seedClient({ clientId: 'client-remaining', apiKey: 'remaining-key-abcdef1', maxRequests: 5, windowSeconds: 60 });

    const res = await checkLimit('client-remaining', '/v1/resource');

    expect(res.status).toBe(200);
    expect(Number.isInteger(res.body.remainingRequests)).toBe(true);
    expect(res.body.remainingRequests).toBeGreaterThanOrEqual(0);
  });

  test('200 response contains a valid ISO 8601 resetTime', async () => {
    await seedClient({ clientId: 'client-iso', apiKey: 'iso-time-key-abcdef12', maxRequests: 5, windowSeconds: 60 });

    const res = await checkLimit('client-iso', '/v1/resource');

    expect(res.status).toBe(200);
    expect(res.body.resetTime).toBeDefined();
    const date = new Date(res.body.resetTime);
    expect(date.getTime()).not.toBeNaN();
  });

  test('429 response contains a valid ISO 8601 resetTime', async () => {
    await seedClient({ clientId: 'client-429-iso', apiKey: 'client-429-iso-key-x1', maxRequests: 1, windowSeconds: 60 });

    await checkLimit('client-429-iso', '/v1/resource');       // consume the only token
    const res = await checkLimit('client-429-iso', '/v1/resource');  // should 429

    expect(res.status).toBe(429);
    const date = new Date(res.body.resetTime);
    expect(date.getTime()).not.toBeNaN();
  });

  test('different paths are tracked independently for the same client', async () => {
    await seedClient({ clientId: 'client-paths', apiKey: 'path-isolation-key-abcd', maxRequests: 1, windowSeconds: 60 });

    // exhaust path-A
    await checkLimit('client-paths', '/v1/path-a');
    const pathASecond = await checkLimit('client-paths', '/v1/path-a');

    // path-B should still have a fresh bucket
    const pathBFirst = await checkLimit('client-paths', '/v1/path-b');

    expect(pathASecond.status).toBe(429);   // path-a exhausted
    expect(pathBFirst.status).toBe(200);    // path-b is independent
    expect(pathBFirst.body.allowed).toBe(true);
  });

  test('Retry-After header is a positive integer string on 429', async () => {
    await seedClient({ clientId: 'client-header', apiKey: 'retry-after-header-key12', maxRequests: 1, windowSeconds: 30 });

    await checkLimit('client-header', '/v1/resource');
    const res = await checkLimit('client-header', '/v1/resource');

    expect(res.status).toBe(429);
    const retryAfterHeader = res.headers['retry-after'];
    expect(retryAfterHeader).toBeDefined();
    const parsed = parseInt(retryAfterHeader, 10);
    expect(Number.isInteger(parsed)).toBe(true);
    expect(parsed).toBeGreaterThan(0);
  });

  test('returns 404 for unknown clientId', async () => {
    const response = await checkLimit('does-not-exist', '/any/path');
    expect(response.status).toBe(404);
  });

  test('returns 400 when clientId is missing', async () => {
    const response = await request(app)
      .post('/api/v1/ratelimit/check')
      .send({ path: '/v1/resource' });

    expect(response.status).toBe(400);
  });

  test('returns 400 when path is missing', async () => {
    const response = await request(app)
      .post('/api/v1/ratelimit/check')
      .send({ clientId: 'some-client' });

    expect(response.status).toBe(400);
  });

  test('returns 400 for invalid payload (empty strings)', async () => {
    const response = await checkLimit('', '');
    expect(response.status).toBe(400);
  });

  // X-RateLimit-* standard header tests
  describe('X-RateLimit-* response headers', () => {
    test('200 response includes X-RateLimit-Limit header matching maxRequests', async () => {
      await seedClient({ clientId: 'header-limit', apiKey: 'header-limit-key-xyz01', maxRequests: 7, windowSeconds: 60 });

      const res = await checkLimit('header-limit', '/v1/resource');

      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('7');
    });

    test('200 response includes X-RateLimit-Remaining header as non-negative integer', async () => {
      await seedClient({ clientId: 'header-remaining', apiKey: 'header-remaining-key012', maxRequests: 5, windowSeconds: 60 });

      const res = await checkLimit('header-remaining', '/v1/resource');

      expect(res.status).toBe(200);
      const remaining = parseInt(res.headers['x-ratelimit-remaining'], 10);
      expect(Number.isInteger(remaining)).toBe(true);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThan(5);
    });

    test('200 response includes X-RateLimit-Reset header as ISO 8601 string', async () => {
      await seedClient({ clientId: 'header-reset', apiKey: 'header-reset-key-abcde1', maxRequests: 5, windowSeconds: 60 });

      const res = await checkLimit('header-reset', '/v1/resource');

      expect(res.status).toBe(200);
      const resetHeader = res.headers['x-ratelimit-reset'];
      expect(resetHeader).toBeDefined();
      const date = new Date(resetHeader);
      expect(date.getTime()).not.toBeNaN();
    });

    test('429 response includes X-RateLimit-Limit, Remaining, and Reset headers', async () => {
      await seedClient({ clientId: 'header-429', apiKey: 'header-429-key-abcdef0', maxRequests: 1, windowSeconds: 30 });

      await checkLimit('header-429', '/v1/resource'); // consume token
      const res = await checkLimit('header-429', '/v1/resource'); // 429

      expect(res.status).toBe(429);
      expect(res.headers['x-ratelimit-limit']).toBe('1');
      const remaining = parseInt(res.headers['x-ratelimit-remaining'], 10);
      expect(remaining).toBe(0);
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});
