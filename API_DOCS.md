# API Documentation

## Base URL

`http://localhost:3000`

## 1) Register Client

### Endpoint

`POST /api/v1/clients`

### Headers

- `Content-Type: application/json`
- `x-internal-api-key: <INTERNAL_API_KEY>`

### Request Body

```json
{
  "clientId": "string",
  "apiKey": "string",
  "maxRequests": 100,
  "windowSeconds": 60
}
```

### Success Response (`201`)

```json
{
  "clientId": "string",
  "maxRequests": 100,
  "windowSeconds": 60
}
```

### Error Responses

- `400 Bad Request` invalid payload
- `401 Unauthorized` missing/invalid `x-internal-api-key`
- `409 Conflict` duplicate `clientId` or `apiKey`

## 2) Check Rate Limit

### Endpoint

`POST /api/v1/ratelimit/check`

### Headers

- `Content-Type: application/json`

### Request Body

```json
{
  "clientId": "string",
  "path": "/v1/orders"
}
```

### Success Response (`200`)

```json
{
  "allowed": true,
  "remainingRequests": 42,
  "resetTime": "2026-03-01T12:34:56.000Z"
}
```

### Rate Limited Response (`429`)

Response header includes: `Retry-After: <seconds>`

```json
{
  "allowed": false,
  "retryAfter": 1,
  "resetTime": "2026-03-01T12:34:58.000Z"
}
```

### Error Responses

- `400 Bad Request` invalid payload
- `404 Not Found` unknown `clientId`

## Health

### Endpoint

`GET /health`

### Success (`200`)

```json
{
  "status": "ok",
  "mongoOk": true,
  "redisOk": true
}
```

### Degraded (`503`)

```json
{
  "status": "degraded",
  "mongoOk": false,
  "redisOk": true
}
```
