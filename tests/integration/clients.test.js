require('./setupIntegration');
const request = require('supertest');
const app = require('../../src/app');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

describe('POST /api/v1/clients', () => {
  test('registers client successfully', async () => {
    const response = await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', INTERNAL_KEY)
      .send({
        clientId: 'client-a',
        apiKey: 'super-secret-key-1',
        maxRequests: 5,
        windowSeconds: 60
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      clientId: 'client-a',
      maxRequests: 5,
      windowSeconds: 60
    });
  });

  test('returns conflict for duplicate clientId', async () => {
    const payloadA = {
      clientId: 'client-a',
      apiKey: 'super-secret-key-1',
      maxRequests: 5,
      windowSeconds: 60
    };

    const payloadB = {
      clientId: 'client-a',
      apiKey: 'super-secret-key-2',
      maxRequests: 10,
      windowSeconds: 30
    };

    await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', INTERNAL_KEY)
      .send(payloadA);

    const response = await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', INTERNAL_KEY)
      .send(payloadB);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  test('returns 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', INTERNAL_KEY)
      .send({
        clientId: '',
        apiKey: 'short'
      });

    expect(response.status).toBe(400);
  });

  test('returns 401 when internal key is missing', async () => {
    const response = await request(app).post('/api/v1/clients').send({
      clientId: 'client-x',
      apiKey: 'super-secret-key-3'
    });

    expect(response.status).toBe(401);
  });
});
