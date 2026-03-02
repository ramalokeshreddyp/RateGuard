# API Documentation — Rate Limiting Microservice

Base URL: `http://localhost:3000`

All request bodies must be `Content-Type: application/json`.

---

## Endpoints

### 1. Health Check

```
GET /health
```

No authentication required.

**Response — 200 OK (all services healthy)**
```json
{ "status": "ok", "mongoOk": true, "redisOk": true }
```

**Response — 503 Service Unavailable (degraded)**
```json
{ "status": "degraded", "mongoOk": false, "redisOk": true }
```

---

### 2. Register Client

```
POST /api/v1/clients
```

Registers a new API client with a rate-limit policy. The `apiKey` is hashed with **bcrypt** before storage; it is never returned or logged.

**Authentication:** `x-internal-api-key: <INTERNAL_API_KEY>` header required.

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `clientId` | string | ✅ | 3–100 characters |
| `apiKey` | string | ✅ | 8–256 characters |
| `maxRequests` | integer | ❌ | ≥ 1, defaults to `DEFAULT_RATE_LIMIT_MAX_REQUESTS` env var (100) |
| `windowSeconds` | integer | ❌ | ≥ 1, defaults to `DEFAULT_RATE_LIMIT_WINDOW_SECONDS` env var (60) |

```json
{
  "clientId": "my-gateway",
  "apiKey": "my-strong-api-key-123",
  "maxRequests": 50,
  "windowSeconds": 60
}
```

#### Responses

**201 Created** — Registration successful.
```json
{
  "clientId": "my-gateway",
  "maxRequests": 50,
  "windowSeconds": 60
}
```

**400 Bad Request** — Missing or invalid fields.
```json
{ "message": "\"clientId\" is not allowed to be empty" }
```

**401 Unauthorized** — Missing or wrong `x-internal-api-key` header.
```json
{ "message": "Unauthorized" }
```

**409 Conflict** — `clientId` or `apiKey` already exists.
```json
{ "message": "clientId or apiKey already exists" }
```

**500 Internal Server Error**
```json
{ "message": "Internal server error" }
```

#### cURL example

```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: dev-internal-key" \
  -d '{
    "clientId": "my-gateway",
    "apiKey": "my-strong-api-key-123",
    "maxRequests": 50,
    "windowSeconds": 60
  }'
```

---

### 3. Check Rate Limit

```
POST /api/v1/ratelimit/check
```

Checks whether a request from a specific client against a given path is within configured limits. Uses an atomic **Token Bucket** algorithm executed as a Redis Lua script — safe for concurrent multi-instance deployments.

Rate limit state is keyed by `clientId + path`, so each path has its own independent bucket per client.

No authentication header required (assumes upstream API gateway has already verified the caller).

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `clientId` | string | ✅ | 3–100 characters, must be a registered client |
| `path` | string | ✅ | 1–500 characters |

```json
{
  "clientId": "my-gateway",
  "path": "/v1/orders"
}
```

#### Responses

**200 OK** — Request is within the rate limit.

| Field | Type | Description |
|---|---|---|
| `allowed` | boolean | Always `true` |
| `remainingRequests` | integer | Tokens left in the current window |
| `resetTime` | string | ISO 8601 datetime when the bucket will be full again |

```json
{
  "allowed": true,
  "remainingRequests": 49,
  "resetTime": "2026-03-02T09:01:12.345Z"
}
```

**429 Too Many Requests** — Rate limit exceeded.

Response header: `Retry-After: <seconds>` (integer)

| Field | Type | Description |
|---|---|---|
| `allowed` | boolean | Always `false` |
| `retryAfter` | integer | Seconds until at least one token refills |
| `resetTime` | string | ISO 8601 datetime of the retry point |

```json
{
  "allowed": false,
  "retryAfter": 3,
  "resetTime": "2026-03-02T09:01:15.000Z"
}
```

**400 Bad Request** — Missing or invalid fields.
```json
{ "message": "\"clientId\" is not allowed to be empty, \"path\" is not allowed to be empty" }
```

**404 Not Found** — `clientId` is not registered.
```json
{ "message": "Client not found" }
```

**500 Internal Server Error**
```json
{ "message": "Internal server error" }
```

#### cURL examples

```bash
# Check rate limit (allowed)
curl -X POST http://localhost:3000/api/v1/ratelimit/check \
  -H "Content-Type: application/json" \
  -d '{"clientId": "my-gateway", "path": "/v1/orders"}'

# Trigger 429 (run after exhausting the limit)
curl -v -X POST http://localhost:3000/api/v1/ratelimit/check \
  -H "Content-Type: application/json" \
  -d '{"clientId": "my-gateway", "path": "/v1/orders"}'
# Look for: HTTP/1.1 429 and Retry-After header
```

---

## Error Reference

| HTTP Code | Meaning | When |
|---|---|---|
| 200 | OK | Request is within rate limit |
| 201 | Created | Client registered successfully |
| 400 | Bad Request | Validation failed (missing or malformed fields) |
| 401 | Unauthorized | Missing or invalid `x-internal-api-key` header |
| 404 | Not Found | `clientId` not registered |
| 409 | Conflict | Duplicate `clientId` or `apiKey` |
| 429 | Too Many Requests | Rate limit exceeded — check `Retry-After` header |
| 500 | Internal Server Error | Unexpected server-side error |

---

## Rate Limiting Algorithm

The service uses the **Token Bucket** algorithm:

- Each `(clientId, path)` pair has its own bucket with a capacity of `maxRequests` tokens.
- Tokens refill continuously at a rate of `maxRequests / windowSeconds` per second.
- Each request consumes 1 token.
- If no token is available, the request is rejected with HTTP 429.
- State is stored in Redis using an **atomic Lua script** (`EVAL`) so multiple service instances share the same bucket safely.

Bucket state key format: `ratelimit:{clientId}:{base64url(path)}`
TTL: `windowSeconds × 2` (auto-expires idle buckets)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Listening port |
| `MONGO_URI` | `mongodb://mongo:27017/ratelimitdb` | MongoDB connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `DEFAULT_RATE_LIMIT_MAX_REQUESTS` | `100` | Default bucket capacity when client omits `maxRequests` |
| `DEFAULT_RATE_LIMIT_WINDOW_SECONDS` | `60` | Default window when client omits `windowSeconds` |
| `INTERNAL_API_KEY` | `dev-internal-key` | Secret header value for client registration endpoint |
| `LOG_LEVEL` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `silent`) |
| `NODE_ENV` | `development` | Runtime environment |
