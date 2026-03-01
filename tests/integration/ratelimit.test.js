require('./setupIntegration');
const request = require('supertest');
const app = require('../../src/app');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

describe('POST /api/v1/ratelimit/check', () => {
  test('allows within limit then blocks when exceeded', async () => {
    await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', INTERNAL_KEY)
      .send({
        clientId: 'limited-client',
        apiKey: 'super-secret-key-limited',
        maxRequests: 2,
        windowSeconds: 10
      });

    const requestBody = {
      clientId: 'limited-client',
      path: '/v1/orders'
    };

    const first = await request(app).post('/api/v1/ratelimit/check').send(requestBody);
    const second = await request(app).post('/api/v1/ratelimit/check').send(requestBody);
    const third = await request(app).post('/api/v1/ratelimit/check').send(requestBody);

    expect(first.status).toBe(200);
    expect(first.body.allowed).toBe(true);

    expect(second.status).toBe(200);
    expect(second.body.allowed).toBe(true);

    expect(third.status).toBe(429);
    expect(third.body.allowed).toBe(false);
    expect(third.body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(third.headers['retry-after']).toBeDefined();
  });

  test('returns 404 for unknown clientId', async () => {
    const response = await request(app).post('/api/v1/ratelimit/check').send({
      clientId: 'does-not-exist',
      path: '/any/path'
    });

    expect(response.status).toBe(404);
  });

  test('returns 400 for invalid payload', async () => {
    const response = await request(app).post('/api/v1/ratelimit/check').send({
      clientId: '',
      path: ''
    });

    expect(response.status).toBe(400);
  });
});
