require('./setupIntegration');
const request = require('supertest');
const app = require('../../src/app');

describe('GET /health', () => {
    test('returns 200 with ok status when all services are healthy', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.mongoOk).toBe(true);
        expect(res.body.redisOk).toBe(true);
    });
});

describe('Unknown routes', () => {
    test('returns 404 for an unknown GET route', async () => {
        const res = await request(app).get('/api/v1/nonexistent-route');
        expect(res.status).toBe(404);
    });

    test('returns 404 for an unknown POST route', async () => {
        const res = await request(app).post('/not/a/real/path').send({});
        expect(res.status).toBe(404);
    });
});
