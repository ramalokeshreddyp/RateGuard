<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=28&pause=1000&color=FF6B6B&center=true&vCenter=true&width=600&lines=⚡+RateGuard;Scalable+API+Rate+Limiting;Token+Bucket+%7C+Redis+%7C+Docker" alt="RateGuard Typing SVG"/>

# ⚡ RateGuard

### 🛡️ Production-Grade API Rate Limiting Microservice

[![CI/CD](https://github.com/ramalokeshreddyp/RateGuard/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ramalokeshreddyp/RateGuard/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Jest](https://img.shields.io/badge/Tests-27_Passing-C21325?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

<br/>

> **RateGuard** is a dedicated, high-performance, stateless microservice that enforces per-client, per-endpoint API rate limits across any distributed system — powered by a Redis-atomic **Token Bucket** algorithm, secured by **bcrypt**, and shipped as a fully Dockerized, CI/CD-automated service.

<br/>

[📖 API Docs](API_DOCS.md) &nbsp;·&nbsp; [🏗️ Architecture](ARCHITECTURE.md) &nbsp;·&nbsp; [📋 Full Documentation](projectdocumentation.md) &nbsp;·&nbsp; [🐛 Issues](https://github.com/ramalokeshreddyp/RateGuard/issues)

</div>

---

## 📌 Table of Contents

- [🌟 Why RateGuard?](#-why-rateguard)
- [🔧 Tech Stack](#-tech-stack)
- [🏗️ System Architecture](#️-system-architecture)
- [🔁 Execution Flow](#-execution-flow)
- [🪣 Token Bucket Algorithm](#-token-bucket-algorithm)
- [⚙️ CI/CD Pipeline](#️-cicd-pipeline)
- [🗂️ Project Structure](#️-project-structure)
- [🚀 Quick Start](#-quick-start)
- [📡 API Reference](#-api-reference)
- [🧪 Testing](#-testing)
- [🌍 Environment Variables](#-environment-variables)
- [🔐 Security Model](#-security-model)
- [📈 Scalability](#-scalability)
- [📚 Documentation](#-documentation)

---

## 🌟 Why RateGuard?

In distributed microservice architectures, uncontrolled API traffic leads to:

| Problem | Impact |
|---|---|
| Runaway clients | Service degradation for all users |
| DDoS / abuse | Complete outages |
| Fair-usage violations | Revenue and SLA loss |
| In-process rate limits | Break under horizontal scaling |

**RateGuard solves all of these** with a centralized, stateless, horizontally scalable rate-limiting layer:

| Feature | Implementation |
|---|---|
| 🧮 Algorithm | **Token Bucket** — burst-friendly, continuously refilling |
| ⚛️ Distributed consistency | **Redis Lua** atomic scripts — zero race conditions at scale |
| 🗄️ Policy store | **MongoDB** — per-client `maxRequests` + `windowSeconds` |
| 🔑 API key security | **bcrypt** (cost 12) + SHA-256 uniqueness fingerprint |
| 🐳 Containerization | **Multi-stage Dockerfile** — minimal, secure production image |
| 🔄 CI/CD | **GitHub Actions** — build → test → push on every merge to `main` |
| 🚀 One-command setup | `docker compose up --build` starts everything |

---

## 🔧 Tech Stack

<table>
<tr>
  <th>Layer</th>
  <th>Technology</th>
  <th>Version</th>
  <th>Purpose</th>
</tr>
<tr>
  <td>Runtime</td>
  <td>🟢 Node.js</td>
  <td>20 LTS</td>
  <td>Async I/O event loop, ideal for proxy-style services</td>
</tr>
<tr>
  <td>Framework</td>
  <td>⚡ Express</td>
  <td>4.x</td>
  <td>Lightweight HTTP routing and middleware</td>
</tr>
<tr>
  <td>Rate State</td>
  <td>🔴 Redis</td>
  <td>7.x</td>
  <td>In-memory atomic token bucket state via Lua EVAL</td>
</tr>
<tr>
  <td>Policy Store</td>
  <td>🍃 MongoDB</td>
  <td>7.x</td>
  <td>Persistent client configuration and hashed API keys</td>
</tr>
<tr>
  <td>ODM</td>
  <td>📦 Mongoose</td>
  <td>8.x</td>
  <td>Schema validation + unique indexes for MongoDB</td>
</tr>
<tr>
  <td>Redis Client</td>
  <td>🔌 ioredis</td>
  <td>5.x</td>
  <td>Redis connection + Lua EVAL execution</td>
</tr>
<tr>
  <td>Validation</td>
  <td>✅ Joi</td>
  <td>17.x</td>
  <td>Request body schema validation → 400 errors</td>
</tr>
<tr>
  <td>Security</td>
  <td>🔐 bcryptjs</td>
  <td>2.x</td>
  <td>API key hashing at cost factor 12</td>
</tr>
<tr>
  <td>HTTP Security</td>
  <td>🪖 Helmet</td>
  <td>8.x</td>
  <td>CSP, HSTS, X-Frame-Options headers</td>
</tr>
<tr>
  <td>Logging</td>
  <td>📝 Pino</td>
  <td>9.x</td>
  <td>Structured JSON logs with request-ID tracing</td>
</tr>
<tr>
  <td>Testing</td>
  <td>🧪 Jest + Supertest</td>
  <td>29.x / 7.x</td>
  <td>Unit + integration test suite (27 tests)</td>
</tr>
<tr>
  <td>Containers</td>
  <td>🐳 Docker + Compose</td>
  <td>Compose v2</td>
  <td>Multi-stage build + full stack orchestration</td>
</tr>
<tr>
  <td>CI/CD</td>
  <td>⚙️ GitHub Actions</td>
  <td>—</td>
  <td>Automated build, test, and Docker Hub push</td>
</tr>
</table>

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Clients["🌐 External Callers"]
        GW[/"⚖️ API Gateway\nor Reverse Proxy"/]
        ADM[/"🔧 Admin Tool\nor Provisioning Service"/]
    end

    subgraph RateGuard["⚡ RateGuard Microservice  (stateless — horizontally scalable)"]
        direction TB
        subgraph Middleware["Middleware Pipeline"]
            HELM["🪖 Helmet\nHTTP Security Headers"]
            PINO["📝 pino-http\nStructured Request Logging"]
            AUTH["🔑 authInternal\nx-internal-api-key guard"]
            VAL["✅ validate\nJoi Schema → 400"]
            ERR["🚨 errorHandler\nGeneric 500 / Specific 4xx"]
        end

        subgraph Endpoints["Route Handlers"]
            HC["❤️ GET /health\nMongo + Redis ping"]
            CC["👤 POST /api/v1/clients\nclientsController"]
            RC["⚡ POST /api/v1/ratelimit/check\nrateLimitController"]
        end

        subgraph Services["Business Logic"]
            CS["clientService\nbcrypt + SHA-256 + Mongo"]
            RLS["rateLimitService\nRedis Lua Token Bucket"]
            TBM["tokenBucketMath\nPure math — unit testable"]
        end
    end

    subgraph Storage["💾 Storage Layer"]
        MDB[("🍃 MongoDB 7\nclients collection\nPolicies + hashed keys")]
        RDS[("🔴 Redis 7\nToken bucket state\nHMSET per clientId+path\nAtomic Lua EVAL")]
    end

    GW  -->|"POST /ratelimit/check"| HELM
    ADM -->|"POST /clients + header"| HELM
    HELM --> PINO --> AUTH --> VAL
    VAL --> CC & RC & HC
    CC --> CS --> MDB
    RC --> RLS --> RDS
    RC -.->|"fetch policy"| CS
    RLS -.->|"pure math helper"| TBM
    ERR -.->|"catches errors"| RC & CC
```

---

## 🔁 Execution Flow

### ▶️ Rate Limit Check Flow

```mermaid
sequenceDiagram
    autonumber
    participant GW as ⚖️ API Gateway
    participant MW as 🌿 Middleware
    participant RC as 🎮 rateLimitController
    participant CS as ⚙️ clientService
    participant RLS as ⚡ rateLimitService
    participant MDB as 🍃 MongoDB
    participant RDS as 🔴 Redis

    GW->>MW: POST /api/v1/ratelimit/check<br/>{"clientId": "my-app", "path": "/v1/orders"}
    MW->>MW: Joi validation → if invalid → 400
    MW->>RC: next() with sanitised body
    RC->>CS: getClientByClientId("my-app")
    CS->>MDB: db.clients.findOne({clientId: "my-app"})
    MDB-->>CS: {maxRequests: 100, windowSeconds: 60}
    CS-->>RC: client document
    RC->>RLS: checkRateLimit({clientId, path, maxRequests: 100, windowSeconds: 60})
    RLS->>RDS: EVAL Lua script<br/>key="ratelimit:my-app:L3YxL29yZGVycw"<br/>capacity=100, refillPerMs=0.00167
    RDS-->>RLS: [allowed=1, tokens=99.0, lastRefill=1740000000000]
    RLS-->>RC: {allowed: true, remainingRequests: 99, resetTime: "2026-03-03T..."}

    alt ✅ Allowed (tokens ≥ 1)
        RC-->>GW: 200 OK<br/>{allowed: true, remainingRequests: 99, resetTime: "..."}
    else 🚫 Denied (tokens < 1)
        RC-->>GW: 429 Too Many Requests<br/>Retry-After: 36<br/>{allowed: false, retryAfter: 36, resetTime: "..."}
    end
```

### ▶️ Client Registration Flow

```mermaid
sequenceDiagram
    autonumber
    participant ADM as 🔧 Admin Tool
    participant AUTH as 🔑 authInternal
    participant VAL as ✅ validate
    participant CC as 👤 clientsController
    participant CS as ⚙️ clientService
    participant MDB as 🍃 MongoDB

    ADM->>AUTH: POST /api/v1/clients<br/>x-internal-api-key: dev-internal-key
    AUTH->>AUTH: header present & matches config.internalApiKey?

    alt ❌ Missing or wrong key
        AUTH-->>ADM: 401 Unauthorized
    end

    AUTH->>VAL: next()
    VAL->>VAL: Joi validates {clientId, apiKey, maxRequests, windowSeconds}

    alt ❌ Invalid payload
        VAL-->>ADM: 400 Bad Request + validation message
    end

    VAL->>CC: next()
    CC->>CS: registerClient({clientId, apiKey, maxRequests, windowSeconds})
    CS->>CS: bcrypt.hash(apiKey, 12)
    CS->>CS: sha256(apiKey) → apiKeyFingerprint
    CS->>MDB: Client.create({clientId, hashedApiKey, apiKeyFingerprint, ...})

    alt ✅ Success
        MDB-->>CS: Saved document
        CS-->>CC: {clientId, maxRequests, windowSeconds}
        CC-->>ADM: 201 Created
    else 🔴 Duplicate key (code 11000)
        MDB-->>CS: MongoServerError
        CS-->>CC: ApiError(409, "clientId or apiKey already exists")
        CC-->>ADM: 409 Conflict
    end
```

---

## 🪣 Token Bucket Algorithm

```mermaid
flowchart TD
    A([🚀 New Request Arrives]) --> B{Redis bucket\nexists?}

    B -->|"No — first request"| C["🆕 Initialize bucket\ntokens = maxRequests\nlastRefill = now"]
    B -->|"Yes"| D["📦 HMGET tokens + lastRefill"]

    C --> E
    D --> E["⏱️ Calculate elapsed time\nΔt = now_ms − lastRefill_ms"]
    E --> F["♻️ Refill tokens\nnewTokens = min(capacity, tokens + Δt × refillRate)\nlastRefill = now_ms"]
    F --> G{newTokens ≥ 1?}

    G -->|"✅ Yes — consume"| H["➖ tokens = tokens − 1\nHMSET + PEXPIRE"]
    G -->|"🚫 No — deny"| I["🔒 HMSET + PEXPIRE\n(state saved, no consumption)"]

    H --> J["📤 Return\nallowed=true\nremainingRequests=⌊tokens⌋\nresetTime = ISO 8601"]
    I --> K["📤 Return\nallowed=false\nretryAfter = seconds until 1 token\nresetTime = ISO 8601"]

    J --> L([200 OK ✅])
    K --> M([429 Too Many Requests 🚫])

    style A fill:#4CAF50,color:#fff
    style L fill:#4CAF50,color:#fff
    style M fill:#f44336,color:#fff
    style G fill:#FF9800,color:#fff
```

**Formula:**
```
refillRate = maxRequests / windowSeconds          (tokens/second)
refillPerMs = refillRate / 1000                   (tokens/millisecond)
tokensNew = min(capacity, tokensOld + Δt × refillPerMs)
allowed = tokensNew ≥ 1
```

**Redis key structure:**
```
Key:    ratelimit:{clientId}:{base64url(path)}
Type:   Hash
Fields: tokens (float), lastRefill (epoch ms)
TTL:    windowSeconds × 2000 ms  (auto-expires idle buckets)
```

> **⚛️ Atomic guarantee:** The entire read-refill-consume-write cycle executes in a **single `EVAL` Lua call** — making it safe under any number of concurrent service instances without a single race condition.

---

## ⚙️ CI/CD Pipeline

```mermaid
flowchart LR
    DEV(["👨‍💻 Developer\ngit push / PR"])

    subgraph GHA["🔄 GitHub Actions"]
        subgraph BUILD["Job: build-and-test  🔧"]
            B1["📥 Checkout code"] --> B2
            B2["🐳 docker compose build\napp + test images"] --> B3
            B3["▶️ docker compose up -d\nmongo + redis"] --> B4
            B4["🧪 Run Unit Tests\nnpm run test:unit\n8 pure algorithm tests"] --> B5
            B5["🔗 Run Integration Tests\nnpm run test:integration\n19 endpoint tests"] --> B6
            B6["🗑️ docker compose down -v\nCleanup"]
        end

        subgraph PUSH["Job: push-image  🚀"]
            P1["📥 Checkout"] --> P2
            P2["🔑 Login to Docker Hub\nvia secrets"] --> P3
            P3["📦 Build & Push\n:latest + :SHA tag"]
        end
    end

    DEV --> BUILD
    BUILD -->|"✅ Tests pass\nmain branch only"| PUSH
    BUILD -->|"❌ Tests fail"| FAIL(["🚨 Pipeline fails\nNotify developer"])

    style BUILD fill:#1a1a2e,color:#e0e0e0
    style PUSH fill:#16213e,color:#e0e0e0
    style DEV fill:#0f3460,color:#fff
    style FAIL fill:#c0392b,color:#fff
```

**Secrets required** (GitHub → Settings → Secrets → Actions):

| Secret | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub account name |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

> The pipeline gracefully skips the push step if secrets are not configured, while still running all tests.

---

## 🗂️ Project Structure

```
RateGuard/
├── 📁 src/
│   ├── app.js                      ← Express app wiring + /health endpoint
│   ├── server.js                   ← Bootstrap: connect Mongo+Redis, app.listen()
│   │
│   ├── 📁 config/
│   │   ├── index.js                ← All env vars parsed + exported
│   │   ├── db.js                   ← MongoDB connect/disconnect helpers
│   │   ├── redis.js                ← ioredis client + connection events
│   │   └── logger.js               ← Pino structured logger instance
│   │
│   ├── 📁 controllers/
│   │   ├── clientsController.js    ← Register client: orchestrate + shape response
│   │   └── rateLimitController.js  ← Check rate limit: orchestrate + shape response
│   │
│   ├── 📁 middleware/
│   │   ├── authInternal.js         ← x-internal-api-key gate → 401
│   │   ├── validate.js             ← Joi schema validation → 400
│   │   └── errorHandler.js         ← Centralised 4xx/5xx error formatter
│   │
│   ├── 📁 models/
│   │   └── Client.js               ← Mongoose schema + unique indexes
│   │
│   ├── 📁 routes/
│   │   ├── index.js                ← Mount /api/v1 router
│   │   ├── clientsRoutes.js        ← POST /clients (auth + validate + handler)
│   │   └── rateLimitRoutes.js      ← POST /ratelimit/check (validate + handler)
│   │
│   ├── 📁 services/
│   │   ├── clientService.js        ← bcrypt + SHA-256 + MongoDB CRUD
│   │   ├── rateLimitService.js     ← Redis Lua EVAL executor + time calculations
│   │   └── tokenBucketMath.js      ← Pure refill math (no I/O — fully unit testable)
│   │
│   └── 📁 utils/
│       └── ApiError.js             ← Custom Error class with HTTP statusCode
│
├── 📁 tests/
│   ├── 📁 unit/
│   │   └── tokenBucketMath.test.js ← 8 pure algorithm tests (no DB/Redis needed)
│   └── 📁 integration/
│       ├── setupIntegration.js     ← beforeAll/afterAll: connect, flush, disconnect
│       ├── clients.test.js         ← 9 endpoint tests (201, 409, 400, 401)
│       └── ratelimit.test.js       ← 10 endpoint tests (200, 429, 400, 404)
│
├── 📁 .github/
│   └── 📁 workflows/
│       └── ci.yml                  ← GitHub Actions: build → test → Docker push
│
├── Dockerfile                      ← Multi-stage: deps → test → prod-deps → runner
├── docker-compose.yml              ← Orchestrate: app + test + mongo + redis
├── init-db.js                      ← MongoDB seed script (3 clients, idempotent upsert)
├── jest.config.js                  ← Jest: runInBand, 30s timeout, node env
├── package.json                    ← Dependencies, npm scripts
├── .env.example                    ← Environment variable template
├── .gitignore
├── API_DOCS.md                     ← Full endpoint reference + cURL examples
├── ARCHITECTURE.md                 ← Architecture decisions + all diagrams
└── projectdocumentation.md         ← Complete project documentation
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Container runtime + Compose v2 |
| [Git](https://git-scm.com/) | Latest | Clone the repository |

### Step 1 — Clone the repository

```bash
git clone https://github.com/ramalokeshreddyp/RateGuard.git
cd RateGuard
```

### Step 2 — Configure environment (optional)

```bash
cp .env.example .env
# Edit .env to override any defaults
```

### Step 3 — Launch the full stack

```bash
docker compose up --build
```

This single command:
1. 🏗️ Builds multi-stage Docker image (deps → test → prod)
2. 🍃 Starts MongoDB with **3 pre-seeded test clients**
3. 🔴 Starts Redis 7
4. ⚡ Starts RateGuard API on port `3000`

> ⏱️ First build takes ~60-90 seconds. Subsequent starts are near-instant.

### Step 4 — Verify it's running

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "mongoOk": true,
  "redisOk": true
}
```

---

## 📡 API Reference

### 🔵 `POST /api/v1/clients` — Register a Client

> Requires `x-internal-api-key` header. API key is hashed before storage — never returned.

```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: dev-internal-key" \
  -d '{
    "clientId":     "my-service",
    "apiKey":       "super-strong-api-key-123",
    "maxRequests":  10,
    "windowSeconds": 60
  }'
```

**201 Created:**
```json
{
  "clientId":      "my-service",
  "maxRequests":   10,
  "windowSeconds": 60
}
```

**409 Conflict** (duplicate clientId or apiKey):
```json
{ "message": "clientId or apiKey already exists" }
```

---

### 🟢 `POST /api/v1/ratelimit/check` — Check Rate Limit

```bash
curl -X POST http://localhost:3000/api/v1/ratelimit/check \
  -H "Content-Type: application/json" \
  -d '{ "clientId": "my-service", "path": "/v1/orders" }'
```

**200 OK (allowed):**
```json
{
  "allowed":           true,
  "remainingRequests": 9,
  "resetTime":         "2026-03-03T12:31:00.000Z"
}
```

**429 Too Many Requests:**
```json
{
  "allowed":    false,
  "retryAfter": 36,
  "resetTime":  "2026-03-03T12:31:36.000Z"
}
```
> + Header: `Retry-After: 36`

---

### 🟡 `GET /health` — Health Check

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "mongoOk": true, "redisOk": true }
```

---

### 🌱 Pre-seeded Test Clients

Available immediately on `docker compose up` — no registration needed:

| `clientId` | `maxRequests` | `windowSeconds` | Use case |
|---|---|---|---|
| `seed-client-basic` | 10 | 60 | Test basic limiting |
| `seed-client-pro` | 100 | 60 | Test higher throughput |
| `seed-client-burst` | 500 | 60 | Test burst tolerance |

**Example — exhaust the limit:**
```bash
for i in $(seq 1 12); do
  echo -n "Request $i: "
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/v1/ratelimit/check \
    -H "Content-Type: application/json" \
    -d '{"clientId":"seed-client-basic","path":"/v1/orders"}'
done
# Requests 1-10: 200
# Requests 11+:  429
```

---

## 🧪 Testing

### Run all tests inside Docker

```bash
docker compose run --rm test npm run test:all
```

### Run individual suites

```bash
# Unit tests only (no DB needed — pure algorithm math)
docker compose run --rm test npm run test:unit

# Integration tests only (live Mongo + Redis)
docker compose run --rm test npm run test:integration
```

### Test results

```
 PASS  tests/unit/tokenBucketMath.test.js      (8 tests)
 PASS  tests/integration/clients.test.js       (9 tests)
 PASS  tests/integration/ratelimit.test.js     (10 tests)

 Test Suites:   3 passed, 3 total
 Tests:         27 passed, 27 total
 Snapshots:     0 total
 Time:          ~18s
```

### Test coverage map

| Suite | What's tested |
|---|---|
| `tokenBucketMath.test.js` | First request, burst cap, fractional tokens, zero-elapsed refill, long idle, undefined state |
| `clients.test.js` | 201 success, defaults applied, apiKey hidden, duplicate clientId 409, duplicate apiKey 409, invalid payload 400, missing clientId 400, missing auth key 401, wrong auth key 401 |
| `ratelimit.test.js` | Allow → allow → deny flow, remainingRequests integer, ISO resetTime on 200, ISO resetTime on 429, per-path isolation, Retry-After header format, 404 unknown client, 400 missing clientId, 400 missing path, 400 empty strings |

---

## 🌍 Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3000` | No | HTTP server port |
| `MONGO_URI` | `mongodb://mongo:27017/ratelimitdb` | Yes | MongoDB connection string |
| `REDIS_URL` | `redis://redis:6379` | Yes | Redis connection string |
| `DEFAULT_RATE_LIMIT_MAX_REQUESTS` | `100` | No | Default bucket capacity |
| `DEFAULT_RATE_LIMIT_WINDOW_SECONDS` | `60` | No | Default refill window (seconds) |
| `INTERNAL_API_KEY` | `dev-internal-key` | Yes | Secret for client registration endpoint |
| `LOG_LEVEL` | `info` | No | Pino log level (trace/debug/info/warn/error) |
| `NODE_ENV` | `development` | No | Runtime environment |

Copy `.env.example` → `.env` and update values before running outside Docker.

---

## 🔐 Security Model

```mermaid
flowchart TD
    REQ(["🌐 Incoming Request"]) --> H1["🪖 Helmet\nCSP · HSTS · X-Frame-Options"]
    H1 --> R1{Which route?}

    R1 -->|"/api/v1/clients"| A1["🔑 authInternal\ncheck x-internal-api-key"]
    A1 -->|"❌ Missing/Wrong"| E1(["401 Unauthorized"])
    A1 -->|"✅ Valid"| V1

    R1 -->|"/api/v1/ratelimit/check"| V1["✅ Joi Validation\nschema check"]
    V1 -->|"❌ Invalid body"| E2(["400 Bad Request"])
    V1 -->|"✅ Valid"| BL["⚙️ Business Logic"]

    BL --> EH["🚨 Error Handler"]
    EH -->|"ApiError"| E3(["4xx specific message"])
    EH -->|"Unknown error"| E4(["500 generic message\n+ detail in server logs only"])

    style REQ fill:#2196F3,color:#fff
    style E1 fill:#f44336,color:#fff
    style E2 fill:#FF9800,color:#fff
    style E3 fill:#FF9800,color:#fff
    style E4 fill:#f44336,color:#fff
```

| Security Concern | Mitigation |
|---|---|
| API key exposure | bcrypt hash (cost 12) — keys never stored in plaintext |
| Duplicate API keys | SHA-256 fingerprint with unique MongoDB index |
| Unauthorized registration | `x-internal-api-key` header gate |
| Race conditions | Atomic Redis Lua `EVAL` — single operation, no TOCTOU |
| Error information leakage | Generic `"Internal server error"` for 500s; detail only in server logs |
| HTTP header attacks | `helmet` middleware (HSTS, CSP, X-Frame-Options, etc.) |
| Hardcoded secrets | All credentials via environment variables |

---

## 📈 Scalability

```mermaid
flowchart TB
    LB[/"⚖️ Load Balancer\n(nginx / AWS ALB)"/]

    LB --> P1["⚡ RateGuard Pod 1\n(stateless)"]
    LB --> P2["⚡ RateGuard Pod 2\n(stateless)"]
    LB --> P3["⚡ RateGuard Pod 3\n(stateless)"]

    P1 & P2 & P3 --> RD[("🔴 Redis Cluster\nShared token state\nAtomic across all pods\nO(1) per request")]
    P1 & P2 & P3 --> MG[("🍃 MongoDB Replica Set\nShared client policies\nRead-heavy, low churn")]
```

- **Stateless pods** — any pod can handle any request
- **Redis Lua atomicity** — guaranteed correctness across all pods simultaneously
- **O(1) Redis operations** — HMGET + HMSET per request, regardless of total client count
- Scale horizontally by adding more RateGuard pods behind the load balancer

---

## 📚 Documentation

| Document | Description |
|---|---|
| [API_DOCS.md](API_DOCS.md) | Complete endpoint reference with schemas, cURL examples, and full error table |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detailed architecture decisions, all diagrams, data design, security, and scalability |
| [projectdocumentation.md](projectdocumentation.md) | Problem statement, tech rationale, module breakdown, testing strategy, production readiness |

---

<div align="center">

**Built with ❤️ using Node.js · Redis · MongoDB · Docker · GitHub Actions**

⭐ Star this repo if you find it useful!

[🐛 Report Bug](https://github.com/ramalokeshreddyp/RateGuard/issues) &nbsp;·&nbsp; [💡 Request Feature](https://github.com/ramalokeshreddyp/RateGuard/issues)

</div>
