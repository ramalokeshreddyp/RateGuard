require('./setupIntegration');
const request = require('supertest');
const app = require('../../src/app');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

// Helper: register a client and return the supertest response
const registerClient = (payload) =>
  request(app)
    .post('/api/v1/clients')
    .set('x-internal-api-key', INTERNAL_KEY)
    .send(payload);

describe('POST /api/v1/clients', () => {
  test('registers client successfully', async () => {
    const response = await registerClient({
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

  test('applies default maxRequests and windowSeconds when omitted', async () => {
    const response = await registerClient({
      clientId: 'client-defaults',
      apiKey: 'super-secret-key-defaults-xyz'
    });

    expect(response.status).toBe(201);
    expect(response.body.clientId).toBe('client-defaults');
    expect(typeof response.body.maxRequests).toBe('number');
    expect(typeof response.body.windowSeconds).toBe('number');
    expect(response.body.maxRequests).toBeGreaterThan(0);
    expect(response.body.windowSeconds).toBeGreaterThan(0);
  });

  test('returns 201 without apiKey in the response body', async () => {
    const response = await registerClient({
      clientId: 'client-apikey-hidden',
      apiKey: 'should-not-be-returned-abc123',
      maxRequests: 10,
      windowSeconds: 30
    });

    expect(response.status).toBe(201);
    expect(response.body.hashedApiKey).toBeUndefined();
    expect(response.body.apiKey).toBeUndefined();
    expect(response.body.apiKeyFingerprint).toBeUndefined();
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

    await registerClient(payloadA);
    const response = await registerClient(payloadB);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  test('returns 409 for duplicate apiKey with different clientId', async () => {
    const payloadA = {
      clientId: 'client-unique-1',
      apiKey: 'shared-api-key-value-xyz9',
      maxRequests: 5,
      windowSeconds: 60
    };

    const payloadB = {
      clientId: 'client-unique-2',
      apiKey: 'shared-api-key-value-xyz9',  // same apiKey
      maxRequests: 5,
      windowSeconds: 60
    };

    await registerClient(payloadA);
    const response = await registerClient(payloadB);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  test('returns 400 for invalid payload', async () => {
    const response = await registerClient({
      clientId: '',
      apiKey: 'short'
    });

    expect(response.status).toBe(400);
  });

  test('returns 400 when clientId is missing entirely', async () => {
    const response = await registerClient({
      apiKey: 'valid-api-key-abcdef12'
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

  test('returns 401 when internal key is wrong', async () => {
    const response = await request(app)
      .post('/api/v1/clients')
      .set('x-internal-api-key', 'wrong-key')
      .send({
        clientId: 'client-y',
        apiKey: 'super-secret-key-4-abcdef'
      });

    expect(response.status).toBe(401);
  });
});
