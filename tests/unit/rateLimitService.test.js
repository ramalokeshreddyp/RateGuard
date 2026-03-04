/**
 * Unit tests for rateLimitService.checkRateLimit
 * Uses ioredis-mock so no real Redis is required.
 */

// Patch ioredis before any require of the module under test
jest.mock('ioredis', () => require('ioredis-mock'));

// Re-require the module after the mock is in place
const { checkRateLimit } = require('../../src/services/rateLimitService');

describe('rateLimitService.checkRateLimit', () => {
    const baseArgs = {
        clientId: 'unit-client',
        path: '/v1/resource',
        maxRequests: 5,
        windowSeconds: 60
    };

    test('first request is allowed with correct remainingRequests', async () => {
        const result = await checkRateLimit(baseArgs);

        expect(result.allowed).toBe(true);
        expect(typeof result.remainingRequests).toBe('number');
        expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
        expect(result.remainingRequests).toBeLessThan(baseArgs.maxRequests);
    });

    test('remainingRequests decreases on each successive call', async () => {
        const first = await checkRateLimit(baseArgs);
        const second = await checkRateLimit(baseArgs);

        expect(first.allowed).toBe(true);
        expect(second.allowed).toBe(true);
        expect(second.remainingRequests).toBeLessThan(first.remainingRequests);
    });

    test('request is denied when limit is exhausted', async () => {
        const args = {
            clientId: 'unit-client-exhaust',
            path: '/v1/data',
            maxRequests: 2,
            windowSeconds: 60
        };

        await checkRateLimit(args); // 1st
        await checkRateLimit(args); // 2nd (exhausts)
        const denied = await checkRateLimit(args); // 3rd – must be denied

        expect(denied.allowed).toBe(false);
    });

    test('retryAfter is at least 1 when denied', async () => {
        const args = {
            clientId: 'unit-client-retry',
            path: '/v1/orders',
            maxRequests: 1,
            windowSeconds: 60
        };

        await checkRateLimit(args); // consume the only token
        const denied = await checkRateLimit(args);

        expect(denied.allowed).toBe(false);
        expect(denied.retryAfter).toBeGreaterThanOrEqual(1);
    });

    test('resetTime is a valid ISO 8601 datetime string', async () => {
        const result = await checkRateLimit(baseArgs);

        expect(result.resetTime).toBeDefined();
        const parsed = new Date(result.resetTime);
        expect(parsed.getTime()).not.toBeNaN();
        expect(result.resetTime).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 prefix
    });

    test('different paths tracked independently', async () => {
        const args = {
            clientId: 'unit-client-paths',
            path: '/v1/path-a',
            maxRequests: 1,
            windowSeconds: 60
        };

        await checkRateLimit(args); // exhaust path-a
        const pathADenied = await checkRateLimit(args);

        const pathBAllowed = await checkRateLimit({ ...args, path: '/v1/path-b' });

        expect(pathADenied.allowed).toBe(false);
        expect(pathBAllowed.allowed).toBe(true);
    });
});
