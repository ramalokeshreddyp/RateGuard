# 🏗️ ARCHITECTURE — RateGuard Rate Limiting Microservice

<div align="center">

> A deep technical reference covering every architectural decision, design pattern, data structure, and trade-off in the RateGuard system.

**Version:** 2.0.0 &nbsp;|&nbsp; **Updated:** March 2026 &nbsp;|&nbsp; **Status:** Production-Ready

</div>

---

## 📑 Table of Contents

1. [Objective & Core Idea](#1-objective--core-idea)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Layered Architecture](#3-layered-architecture)
4. [Module Responsibilities](#4-module-responsibilities)
5. [Why Token Bucket?](#5-why-token-bucket)
6. [Lua Script — Atomic Rate Decision](#6-lua-script--atomic-rate-decision)
7. [Request Lifecycle Diagrams](#7-request-lifecycle-diagrams)
8. [Data Design](#8-data-design)
9. [API Design Decisions](#9-api-design-decisions)
10. [Security Architecture](#10-security-architecture)
11. [CI/CD Architecture](#11-cicd-architecture)
12. [Dockerfile Architecture](#12-dockerfile-architecture)
13. [Scalability & Reliability](#13-scalability--reliability)
14. [Observability Architecture](#14-observability-architecture)
15. [Pros, Cons & Trade-offs](#15-pros-cons--trade-offs)
16. [Production Recommendations](#16-production-recommendations)

---

## 1. Objective & Core Idea

RateGuard is a **dedicated, stateless microservice** that enforces per-client, per-endpoint API rate limits across a distributed system. It removes rate-limiting logic from individual application services and centralises it in a single, reliable, horizontally-scalable layer.

```mermaid
mindmap
  root((RateGuard))
    Core Goals
      Zero race conditions
      Horizontal scalability
      Per-client policies
      One-command setup
    Algorithm
      Token Bucket
      Redis Lua EVAL
      Burst tolerance
      O(1) state per client
    Storage
      MongoDB
        Client policies
        Hashed API keys
        bcryptRounds configurable
      Redis
        Token bucket state
        TTL auto-expiry
        ioredis-mock for unit tests
    API Surface
      POST /api/v1/clients
      GET /api/v1/clients/:clientId
      POST /api/v1/ratelimit/check
      GET /health
      X-RateLimit-* headers
    Operations
      4-stage multi-stage Docker
      .dockerignore for lean builds
      GitHub Actions CI
      GHA layer cache
      Structured logging
```

**Key design philosophies:**
- **Stateless compute, stateful storage** — app nodes hold no in-memory rate state; all state lives in Redis
- **Separation of concerns** — client policy (MongoDB) vs. volatile rate state (Redis) vs. business logic (Node.js)
- **Standard HTTP semantics** — `X-RateLimit-Limit/Remaining/Reset` headers on every rate-limit response
- **Fail loudly, log verbosely** — 4xx errors carry clear human messages; 500s return generic strings with full detail in server logs
- **Testing as a first-class concern** — pure math module decoupled for unit testing without I/O; Redis logic unit-tested via `ioredis-mock`

---

## 2. High-Level Architecture

```mermaid
flowchart TB
    subgraph External["🌐 External Callers"]
        GW[/"⚖️ API Gateway\nor Reverse Proxy"/]
        ADM[/"🔧 Internal Admin\nor Provisioning Tool"/]
    end

    subgraph RG["⚡ RateGuard Microservice  (stateless — horizontally scalable)"]
        direction TB

        subgraph HTTP["HTTP Layer"]
            HELM["🪖 Helmet\nHTTP Security Headers"]
            PINO["📝 pino-http\nStructured Request Logging + Request ID"]
        end

        subgraph MW["Middleware Pipeline"]
            AUTH["🔑 authInternal\nx-internal-api-key gate → 401"]
            VAL["✅ Joi Validation\nBody schema → 400"]
            ERR["🚨 errorHandler\n4xx specific / 500 generic"]
        end

        subgraph Routes["Route Handlers"]
            HC["❤️ GET /health"]
            CC["👤 POST /api/v1/clients"]
            GC["🔍 GET /api/v1/clients/:clientId"]
            RC["⚡ POST /api/v1/ratelimit/check\n+ X-RateLimit-* headers"]
        end

        subgraph Svc["Services"]
            CS["clientService\nbcrypt(bcryptRounds) · SHA-256 · Mongo"]
            RLS["rateLimitService\nRedis Lua executor"]
            TBM["tokenBucketMath\nPure math (no I/O)"]
        end
    end

    subgraph Store["💾 Storage"]
        MDB[("🍃 MongoDB 7\nclients collection")]
        RDS[("🔴 Redis 7\nToken bucket state")]
    end

    GW  -->|"POST /ratelimit/check"| HELM
    ADM -->|"POST/GET /clients + x-internal-api-key"| HELM
    HELM --> PINO --> AUTH & VAL
    AUTH --> CC & GC --> CS --> MDB
    VAL --> RC --> RLS --> RDS
    RC -.->|"policy fetch"| CS
    RLS -.->|"math helper"| TBM
    HC -.->|"ping"| MDB & RDS
    ERR -.->|"catches"| CC & GC & RC
```

---

## 3. Layered Architecture

```mermaid
flowchart LR
    subgraph L1["Layer 1 — Transport"]
        E["Express 4\nHelmet\npino-http"]
    end
    subgraph L2["Layer 2 — Middleware"]
        M["authInternal\nJoi validate\nerrorHandler"]
    end
    subgraph L3["Layer 3 — Controllers"]
        C["clientsController\n(register + get)\nrateLimitController\n(check + X-RateLimit headers)"]
    end
    subgraph L4["Layer 4 — Services"]
        S["clientService\nrateLimitService\ntokenBucketMath"]
    end
    subgraph L5["Layer 5 — Models"]
        D["Mongoose Client model\nioredis client"]
    end
    subgraph L6["Layer 6 — Data"]
        DB["MongoDB 7\nRedis 7"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

| Layer | Technology | Responsibility |
|---|---|---|
| **Transport** | Express 4, Helmet, pino-http | HTTP routing, security headers, structured request logging |
| **Middleware** | Joi, custom auth, errorHandler | Input validation → 400, auth gate → 401, error normalisation |
| **Controllers** | Express handlers | Use-case orchestration, HTTP response shaping + X-RateLimit-* headers |
| **Services** | bcrypt, ioredis, Lua, crypto | Business logic: register client, evaluate rate limit |
| **Models** | Mongoose | MongoDB schema + unique index enforcement |
| **Data** | MongoDB 7, Redis 7 | Persistent policy store + ephemeral rate state |
| **Infra** | Docker Compose, GitHub Actions | Reproducible environments, CI/CD automation |

---

## 4. Module Responsibilities

```mermaid
flowchart TD
    subgraph entry["Entry Points"]
        SRV["server.js\n• Connect MongoDB\n• Ping Redis\n• app.listen()"]
        APP["app.js\n• Mount middleware\n• Mount routes\n• /health endpoint"]
    end

    subgraph cfg["config/"]
        CI["index.js\nParse all env vars\nbcryptRounds from BCRYPT_ROUNDS\nExport typed config object"]
        DB["db.js\nconnectMongo()\ndisconnectMongo()"]
        RD["redis.js\nioredis client instance\nconnection event logging"]
        LG["logger.js\nPino instance\nlog level from config"]
    end

    subgraph mw["middleware/"]
        AU["authInternal.js\nReads x-internal-api-key header\nCompares to config.internalApiKey\n→ 401 if mismatch"]
        VL["validate.js\nHOF: accepts Joi schema\nReturns middleware fn\n→ 400 with details on fail"]
        EH["errorHandler.js\nExpress error middleware (4 args)\nMasks 500s as generic\nLogs with request-id"]
    end

    subgraph mdl["models/"]
        CL["Client.js\nMongoose schema:\nclientId (unique)\nhashedApiKey\napiKeyFingerprint (unique)\nmaxRequests · windowSeconds\ntimestamps: true"]
    end

    subgraph svc["services/"]
        CSS["clientService.js\nregisterClient():\n  bcrypt.hash(apiKey, config.bcryptRounds)\n  sha256(apiKey) → fingerprint\n  Client.create()\ngetClientByClientId():\n  findOne({clientId}).lean()"]
        RLS["rateLimitService.js\ncheckRateLimit():\n  Build Redis key (base64url path)\n  EVAL Lua script\n  Calculate resetTime + retryAfter\n  Return normalized result"]
        TBM["tokenBucketMath.js\ncalculateTokenBucket():\n  PURE FUNCTION — no I/O\n  Handles undefined state\n  Caps at capacity\n  Returns {allowed, tokens, lastRefillMs}"]
    end

    subgraph ctrl["controllers/"]
        CC["clientsController.js\nregisterClient handler → 201\ngetClient handler → 200 / 404\n(no key material in responses)"]
        RC["rateLimitController.js\ncheckRateLimit handler:\n  Sets X-RateLimit-Limit header\n  Sets X-RateLimit-Remaining header\n  Sets X-RateLimit-Reset header\n  Sets Retry-After on 429\n  → 200 or 429 JSON"]
    end

    subgraph rts["routes/"]
        RTS["clientsRoutes.js\nPOST /clients (auth + validate + handler)\nGET /clients/:clientId (auth + handler)"]
        RTR["rateLimitRoutes.js\nPOST /ratelimit/check (validate + handler)"]
    end

    SRV --> APP --> cfg & mw & mdl & svc & ctrl & rts
```

---

## 5. Why Token Bucket?

### Algorithm Comparison

```mermaid
quadrantChart
    title Rate Limiting Algorithm Selection
    x-axis "Memory Efficiency" --> "Low Memory"
    y-axis "Rigid (No Burst)" --> "Burst Tolerant"
    quadrant-1 Ideal Zone
    quadrant-2 Burst OK, Memory Poor
    quadrant-3 Avoid
    quadrant-4 Precise, No Burst
    Token Bucket: [0.8, 0.85]
    Fixed Window: [0.85, 0.2]
    Sliding Log: [0.15, 0.9]
    Leaky Bucket: [0.8, 0.1]
```

| Property | Token Bucket ✅ | Fixed Window | Sliding Log | Leaky Bucket |
|---|---|---|---|---|
| Burst handling | ✅ Up to capacity | ❌ Boundary bursts | ✅ Yes | ❌ Smoothed only |
| Memory per client | ✅ O(1) — 2 fields | ✅ O(1) | ❌ O(n) — timestamp log | ✅ O(1) |
| Atomic Redis update | ✅ HMSET | ⚠️ INCR + expiry | ❌ ZADD + ZRANGE | ✅ HMSET |
| Race-condition safe | ✅ via Lua EVAL | ⚠️ Needs WATCH | ✅ via Lua | ✅ via Lua |
| Real-world feel | ✅ Natural | ⚠️ Reset spikes | ✅ Smooth | ⚠️ Rigid |
| Implementation complexity | Low | Very Low | High | Low |

**Token Bucket was chosen** because:
1. Allows controlled bursting — real API clients send traffic in bursts, not at perfectly even intervals
2. Stores exactly **two fields per Redis key** — maximally memory-efficient
3. Integrates naturally with Redis atomic Lua — single EVAL call covers refill + consume

### Mathematical Definition

```
Given:
  C    = capacity (maxRequests)
  W    = windowSeconds
  r    = C / W              refill rate (tokens/second)
  rMs  = r / 1000           refill rate (tokens/millisecond)

On each check request:
  Δt       = now_ms − lastRefill_ms          elapsed time
  refilled = Δt × rMs                        tokens earned
  tokens   = min(C, tokens_prev + refilled)  cap at capacity
  allowed  = tokens ≥ 1

  if allowed:
    tokens = tokens − 1

State stored: { tokens, lastRefill = now_ms }
TTL:          windowSeconds × 2000 ms
```

---

## 6. Lua Script — Atomic Rate Decision

The entire **read → refill → consume → write** cycle executes inside a single `redis.call('EVAL', ...)`, making it safe under any level of concurrency without locks:

```lua
local key         = KEYS[1]
local now         = tonumber(ARGV[1])   -- current time (epoch ms)
local capacity    = tonumber(ARGV[2])   -- maxRequests
local refillPerMs = tonumber(ARGV[3])   -- tokens per millisecond
local requested   = tonumber(ARGV[4])   -- always 1
local ttlMs       = tonumber(ARGV[5])   -- windowSeconds × 2000

-- 1. Load current state (or use defaults for new buckets)
local data       = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens     = tonumber(data[1]) or capacity
local lastRefill = tonumber(data[2]) or now

-- 2. Refill based on elapsed time
if now > lastRefill then
  local delta  = now - lastRefill
  local refill = delta * refillPerMs
  tokens       = math.min(capacity, tokens + refill)
  lastRefill   = now
end

-- 3. Consume or deny
local allowed = 0
if tokens >= requested then
  tokens  = tokens - requested
  allowed = 1
end

-- 4. Persist new state + refresh TTL
redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('PEXPIRE', key, ttlMs)

return { allowed, tokens, lastRefill }
```

**Redis key structure:**
```
ratelimit:{clientId}:{base64url(path)}

Example:
  clientId: "acme-payments"
  path:     "/v1/orders"
  key:      "ratelimit:acme-payments:L3YxL29yZGVycw"
```

---

## 7. Request Lifecycle Diagrams

### 7.1 Rate Limit Check (with X-RateLimit-* Headers)

```mermaid
sequenceDiagram
    autonumber
    participant U as ⚖️ Upstream
    participant MW as 🌿 Middleware
    participant RC as 🎮 rateLimitController
    participant CS as ⚙️ clientService
    participant RLS as ⚡ rateLimitService
    participant MDB as 🍃 MongoDB
    participant RDS as 🔴 Redis

    U->>MW: POST /api/v1/ratelimit/check<br/>{clientId, path}
    MW->>MW: Joi validates body → 400 if invalid
    MW->>RC: next() with sanitised body
    RC->>CS: getClientByClientId("acme")
    CS->>MDB: db.clients.findOne({clientId:"acme"})
    MDB-->>CS: {maxRequests:100, windowSeconds:60}
    CS-->>RC: client doc
    RC->>RLS: checkRateLimit({clientId, path, maxRequests:100, windowSeconds:60})
    Note over RLS: Build key, compute refillPerMs, TTL
    RLS->>RDS: EVAL Lua(key, now, capacity, refillPerMs, 1, ttlMs)
    Note over RDS: Atomic: HMGET → refill → consume → HMSET → PEXPIRE
    RDS-->>RLS: [allowed=1, tokens=99.3, lastRefill=1740000001234]
    RLS-->>RC: {allowed:true, remainingRequests:99, retryAfter:0, resetTime:"..."}
    RC->>RC: setHeader('X-RateLimit-Limit', '100')<br/>setHeader('X-RateLimit-Remaining', '99')<br/>setHeader('X-RateLimit-Reset', resetTime)

    alt ✅ Allowed
        RC-->>U: 200 + X-RateLimit-* headers<br/>{allowed:true, remainingRequests:99, resetTime:"..."}
    else 🚫 Rate Limited
        RC->>RC: setHeader('Retry-After', String(retryAfter))
        RC-->>U: 429 + Retry-After + X-RateLimit-* headers<br/>{allowed:false, retryAfter:36, resetTime:"..."}
    end
```

### 7.2 Client Registration

```mermaid
sequenceDiagram
    autonumber
    participant ADM as 🔧 Admin
    participant AUTH as 🔑 authInternal
    participant VAL as ✅ validate
    participant CC as 👤 clientsController
    participant CS as ⚙️ clientService
    participant MDB as 🍃 MongoDB

    ADM->>AUTH: POST /api/v1/clients<br/>x-internal-api-key: <secret>
    AUTH->>AUTH: header === config.internalApiKey?

    alt ❌ Invalid/Missing Key
        AUTH-->>ADM: 401 Unauthorized
    end

    AUTH->>VAL: next()
    VAL->>VAL: Joi: clientId ≥3chars, apiKey ≥8chars

    alt ❌ Validation Fails
        VAL-->>ADM: 400 Bad Request + details
    end

    VAL->>CC: next()
    CC->>CS: registerClient({clientId, apiKey, maxRequests, windowSeconds})
    CS->>CS: await bcrypt.hash(apiKey, config.bcryptRounds)
    CS->>CS: sha256(apiKey) → fingerprint
    CS->>MDB: Client.create({clientId, hashedApiKey, apiKeyFingerprint, maxRequests, windowSeconds})

    alt ✅ Success
        MDB-->>CS: saved document
        CS-->>CC: {clientId, maxRequests, windowSeconds}
        CC-->>ADM: 201 Created — no apiKey in response
    else 🔴 Duplicate (code 11000)
        MDB-->>CS: MongoServerError {code:11000}
        CS-->>CC: throw ApiError(409, "clientId or apiKey already exists")
        CC-->>ADM: 409 Conflict
    end
```

### 7.3 Get Client Config

```mermaid
sequenceDiagram
    autonumber
    participant ADM as 🔧 Admin
    participant AUTH as 🔑 authInternal
    participant GC as 🔍 clientsController.getClient
    participant CS as ⚙️ clientService
    participant MDB as 🍃 MongoDB

    ADM->>AUTH: GET /api/v1/clients/acme<br/>x-internal-api-key: <secret>
    AUTH->>AUTH: Validate internal key

    alt ❌ Invalid/Missing Key
        AUTH-->>ADM: 401 Unauthorized
    end

    AUTH->>GC: next()
    GC->>CS: getClientByClientId("acme")
    CS->>MDB: findOne({clientId: "acme"}).lean()

    alt ✅ Found
        MDB-->>CS: document
        CS-->>GC: document
        GC-->>ADM: 200 {clientId, maxRequests, windowSeconds}
    else ❌ Not Found
        MDB-->>CS: null
        GC-->>ADM: 404 {message: "Client not found"}
    end
```

### 7.4 Health Check

```mermaid
sequenceDiagram
    participant MON as 🔍 Monitor / Orchestrator
    participant HC as ❤️ /health handler
    participant MDB as 🍃 MongoDB
    participant RDS as 🔴 Redis

    MON->>HC: GET /health
    HC->>MDB: mongoose.connection.readyState === 1?
    HC->>RDS: redisClient.ping()
    MDB-->>HC: readyState = 1 (Connected)
    RDS-->>HC: "PONG"

    alt ✅ All healthy
        HC-->>MON: 200 {status:"ok", mongoOk:true, redisOk:true}
    else ⚠️ Degraded
        HC-->>MON: 503 {status:"degraded", mongoOk:false, redisOk:true}
    end
```

---

## 8. Data Design

### 8.1 MongoDB — `clients` Collection

```mermaid
erDiagram
    CLIENTS {
        ObjectId _id PK
        String clientId UK "unique, trimmed, required"
        String hashedApiKey "bcrypt cost = config.bcryptRounds"
        String apiKeyFingerprint UK "sha256 hex, unique index"
        Number maxRequests "min 1, default from env"
        Number windowSeconds "min 1, default from env"
        Date createdAt "auto via timestamps"
        Date updatedAt "auto via timestamps"
    }
```

**Index Strategy:**
```
db.clients.createIndex({ clientId: 1 }, { unique: true })          // O(log n) lookup
db.clients.createIndex({ apiKeyFingerprint: 1 }, { unique: true }) // Enforce key uniqueness
```

**Why two API key fields?**
- `hashedApiKey` (bcrypt) — for future authentication/verification flows
- `apiKeyFingerprint` (SHA-256) — fast deterministic uniqueness check without bcrypt compare

### 8.2 Redis — Token Bucket State

```mermaid
flowchart LR
    subgraph Redis["Redis — Hash Keys"]
        K1["ratelimit:acme-payments:L3YxL29yZGVycw\n──────────────────────────\ntokens:      99.333\nlastRefill:  1740000001234\n──────────────────────────\nTTL: 120000ms (2× window)"]
        K2["ratelimit:acme-payments:L3YxL3VzZXJz\n──────────────────────────\ntokens:      0.001\nlastRefill:  1740000005678\n──────────────────────────\nTTL: 60432ms (remaining)"]
        K3["ratelimit:payment-svc:L3YxL29yZGVycw\n──────────────────────────\ntokens:      500.000\nlastRefill:  1740000009012\n──────────────────────────\nTTL: 120000ms"]
    end
```

| Field | Type | Description |
|---|---|---|
| Key | String | `ratelimit:{clientId}:{base64url(path)}` |
| `tokens` | Float | Remaining token count (fractional precision) |
| `lastRefill` | Integer | Epoch milliseconds of last state computation |
| TTL | ms | `windowSeconds × 2000` — auto-expires idle buckets |

---

## 9. API Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `/check` is a POST, not GET | POST | Carries a request body; GET with body is non-standard |
| `retryAfter` in seconds | Integer | RFC 7231 §7.1.3 specifies `Retry-After` header as integer seconds |
| `resetTime` as ISO 8601 | String | Machine-parseable, timezone-explicit, universally understood |
| Standard `X-RateLimit-*` headers | All responses | Industry standard (GitHub, Twitter API, RFC 6585 draft) — clients expect them |
| apiKey not in any response | Omitted | Security: the key should never be echoed back |
| 404 for unknown client | Not 400 | The clientId format is valid; the resource simply doesn't exist |
| GET /clients/:clientId | New endpoint | Inspection/debugging without DB access; returns no key material |
| `x-internal-api-key` header | Custom header | Keeps auth simple; no bearer/OAuth complexity for internal calls |
| Prefix `/api/v1/` | Versioned | Allows future `/api/v2/` without breaking existing callers |
| `BCRYPT_ROUNDS` configurable | env var | Allows fast hashing in test env (rounds=4) vs secure prod (rounds=12+) |

---

## 10. Security Architecture

```mermaid
flowchart TD
    R["🌐 Incoming Request"] --> H["🪖 Helmet Middleware\nSets: HSTS · CSP · X-Frame-Options\nRemoves: X-Powered-By"]
    H --> L["📝 pino-http\nLogs: method · url · status · latency\nAttaches: requestId (UUID v4 or from header)"]
    L --> RT{Route type?}

    RT -->|"/api/v1/clients (any method)"| A1["🔑 authInternal\nChecks x-internal-api-key header"]
    A1 -->|"❌ Missing"| E401A(["401"])
    A1 -->|"❌ Wrong value"| E401B(["401"])
    A1 -->|"✅ Correct"| V1

    RT -->|"/api/v1/ratelimit/check"| V1["✅ Joi validate\nclientId: string min:3 max:100 trimmed\npath: string min:1 max:500 trimmed"]
    V1 -->|"❌ Schema fail"| E400(["400 + detail message"])
    V1 -->|"✅ Valid"| BL["⚙️ Business Logic"]

    BL --> EH["🚨 errorHandler\n(4-arg Express middleware)"]
    EH -->|"ApiError"| EN(["4xx — error.message"])
    EH -->|"Unknown error"| E500(["500 — 'Internal server error'\n+ full error in server logs only"])

    style R fill:#2196F3,color:#fff
    style E401A fill:#f44336,color:#fff
    style E401B fill:#f44336,color:#fff
    style E400 fill:#FF9800,color:#fff
    style EN fill:#FF9800,color:#fff
    style E500 fill:#f44336,color:#fff
```

### Security Controls Summary

| Threat Vector | Control | Implementation |
|---|---|---|
| API key exposure | Irreversible hashing | bcrypt (`config.bcryptRounds`, default 12) via `bcryptjs` |
| Duplicate API key bypass | Uniqueness fingerprint | SHA-256 → unique MongoDB index |
| Unauthorized client management | Header gate | `x-internal-api-key` middleware on all `/clients` routes |
| Concurrent race conditions | Atomic operations | Redis Lua `EVAL` — single operation |
| Error information leakage | Response masking | 500s return generic string only |
| HTTP header attacks | Security headers | `helmet` middleware |
| Credential hardcoding | Environment variables | All secrets via `process.env`; documented in `.env.example` |
| Body-size attacks | Express default limit | 100kb JSON body limit (Express default) |

---

## 11. CI/CD Architecture

```mermaid
flowchart TB
    DEV(["👨‍💻 Developer\ngit push / PR to main"]) --> GH

    subgraph GH["GitHub Actions — ci.yml"]

        subgraph JOB1["Job: build-and-test  🔧\nruns-on: ubuntu-latest"]
            B1["📥 actions/checkout@v4\n+ docker/setup-buildx-action@v3"] --> B2
            B2["🐳 docker compose build app test\n(multi-stage Dockerfile + GHA layer cache)"] --> B3
            B3["▶️ docker compose up -d mongo redis\n30×5s health-check polling loop"] --> B4
            B4["🧪 docker compose run --rm test\nnpm run test:unit\n(13 tests — incl. ioredis-mock)"] --> B5
            B5["🔗 docker compose run --rm test\nnpm run test:integration\n(30 endpoint tests)"] --> B6
            B6["📋 Show service logs (if: failure())\n🗑️ docker compose down -v (if: always())"]
        end

        subgraph JOB2["Job: push-image  🚀\nneeds: build-and-test\nif: push to main"]
            P1["📥 checkout + Buildx"] --> P2
            P2["🔑 docker/login-action@v3\nDOCKERHUB_USERNAME + DOCKERHUB_TOKEN"] --> P3
            P3["📦 docker/build-push-action@v6\ntarget: runner\ntags: :latest + :SHA\ncache-from/to: type=gha\npush: true"]
        end

    end

    JOB1 -->|"✅ All 43 tests pass"| JOB2
    JOB1 -->|"❌ Any test fails"| FAIL(["🚨 Pipeline fails\nNo image pushed"])
    JOB2 --> HUB(["🐳 Docker Hub\nImage published"])
```

**Trigger matrix:**

| Event | `build-and-test` | `push-image` |
|---|---|---|
| Push to `main` | ✅ | ✅ (if secrets set) |
| Pull request to `main` | ✅ | ❌ |
| Push to other branch | ❌ | ❌ |

---

## 12. Dockerfile Architecture

```mermaid
flowchart LR
    subgraph Stage1["Stage: deps\nnode:20-alpine"]
        D1["COPY package*.json\nRUN npm install\n(all dependencies incl. devDeps)"]
    end

    subgraph Stage2["Stage: test\nFROM deps"]
        D2["COPY . .\n(full source + tests)\nUsed by CI test runner\n& ioredis-mock available"]
    end

    subgraph Stage3["Stage: prod-deps\nnode:20-alpine"]
        D3["COPY package*.json\nRUN npm install --omit=dev\n(production deps only)"]
    end

    subgraph Stage4["Stage: runner\nnode:20-alpine ← FINAL IMAGE"]
        D4["COPY --from=prod-deps node_modules\nCOPY src/ only\napk add curl (for healthcheck)\nEXPOSE 3000\nCMD npm start"]
    end

    Stage1 --> Stage2
    Stage1 -.-> Stage3
    Stage3 --> Stage4

    style Stage4 fill:#1a237e,color:#fff
    style Stage2 fill:#1b5e20,color:#fff
```

| Stage | Base Image | Contents | Used For |
|---|---|---|---|
| `deps` | `node:20-alpine` | All npm packages (dev + prod) | Shared layer cache |
| `test` | inherits `deps` | Full source + tests + ioredis-mock | CI `docker compose run test` |
| `prod-deps` | `node:20-alpine` | Only prod npm packages | Production layer isolation |
| `runner` | `node:20-alpine` | prod deps + `src/` only | Final pushed image (~80MB) |

**.dockerignore** ensures the build context is lean by excluding:
```
node_modules / .git / .env* / tests/ / *.md / *.log / coverage/
```

---

## 13. Scalability & Reliability

```mermaid
flowchart TB
    INET["🌐 Internet"] --> LB[/"⚖️ Load Balancer\nnginx · AWS ALB · Kubernetes Service"/]

    LB --> P1["⚡ RateGuard\nPod 1"]
    LB --> P2["⚡ RateGuard\nPod 2"]
    LB --> P3["⚡ RateGuard\nPod 3"]
    LB --> PN["⚡ RateGuard\nPod N..."]

    P1 & P2 & P3 & PN --> RC["🔴 Redis Cluster\nor Redis Sentinel\nAtomic Lua across ALL pods\nO(1) per request"]
    P1 & P2 & P3 & PN --> MC["🍃 MongoDB Replica Set\nor Atlas\nRead-heavy — policy lookup\nlow write churn"]

    style P1 fill:#0d47a1,color:#fff
    style P2 fill:#0d47a1,color:#fff
    style P3 fill:#0d47a1,color:#fff
    style PN fill:#0d47a1,color:#fff
```

**Why horizontal scaling works:**
1. **No in-process state** — app pods carry zero rate-limit memory
2. **Redis Lua atomicity** — regardless of which pod processes a request, the Lua script executes atomically on the Redis primary
3. **Consistent policy reads** — MongoDB is read-only in the hot path (policy lookup); writes only happen on client registration
4. **Stateless health checks** — `/health` endpoint checks external dependencies, not local state

**Redis complexity:**

| Operation | Redis Command | Time Complexity |
|---|---|---|
| Read + write bucket state | `HMGET` + `HMSET` | O(1) |
| Set TTL | `PEXPIRE` | O(1) |
| Total per check request | `EVAL` (single roundtrip) | O(1) |

---

## 14. Observability Architecture

```mermaid
flowchart LR
    subgraph Current["✅ Already Implemented"]
        L1["📝 Structured JSON logs\nvia pino (5-6× faster than Winston)"]
        L2["🔖 Request ID tracing\nx-request-id header or UUID v4"]
        L3["❤️ /health endpoint\nMongo + Redis readiness checks"]
        L4["🚨 Error logging\nFull stack + requestId in 500s"]
        L5["📊 X-RateLimit-* headers\nLimit/Remaining/Reset on every response"]
    end

    subgraph Recommended["🔮 Production Additions"]
        R1["📊 Prometheus /metrics\nrate_limit_allowed_total\nrate_limit_denied_total\nlatency histograms"]
        R2["📈 Grafana Dashboard\nReal-time rate limit visuals"]
        R3["🔍 OpenTelemetry\nDistributed traces\nSlack/PagerDuty alerts"]
    end
```

Current log format (pino structured JSON):
```json
{
  "level": "info",
  "time": "2026-03-04T08:01:41.000Z",
  "requestId": "a1b2c3d4-...",
  "req": { "method": "POST", "url": "/api/v1/ratelimit/check" },
  "res": { "statusCode": 429 },
  "responseTime": 4
}
```

---

## 15. Pros, Cons & Trade-offs

### ✅ Advantages

| Advantage | Detail |
|---|---|
| **Distributed correctness** | Redis Lua atomicity prevents over-counting under any concurrency |
| **Horizontal scalability** | Stateless pods + shared Redis state = infinite horizontal scale |
| **Burst tolerance** | Token Bucket naturally handles bursty real-world API traffic |
| **Separation of concerns** | Policy (Mongo) vs. state (Redis) vs. logic (Node.js) clearly separated |
| **Testability** | `tokenBucketMath.js` is I/O-free; `rateLimitService` unit-tested via `ioredis-mock` |
| **Standard headers** | `X-RateLimit-Limit/Remaining/Reset` on every response — clients don't need custom parsing |
| **One-command setup** | `docker compose up --build` starts everything with seeded test data |
| **Minimal Redis memory** | Only 2 fields (tokens + lastRefill) per clientId+path combination |
| **Auto-expiry** | Redis TTL auto-cleans idle bucket keys without manual cleanup |
| **Configurable security** | `BCRYPT_ROUNDS` env var allows fast test hashing and secure prod hashing |

### ⚠️ Trade-offs

| Trade-off | Mitigation |
|---|---|
| Requires Redis alongside app | Use Redis Sentinel / Cluster for HA; acceptable operational overhead |
| Redis unavailability blocks decisions | Implement circuit breaker (fail-open or fail-closed based on policy) |
| Internal API key is pre-shared secret | Replace with mTLS or signed JWT in production |
| No built-in metrics endpoint | Add Prometheus instrumentation for production observability |
| MongoDB adds latency per check request | Cache hot client policies in Redis (e.g., 30s TTL) for ultra-low latency |
| No UPDATE endpoint for client config | Add `PUT /api/v1/clients/:clientId` in Phase 2 |

---

## 16. Production Recommendations

```mermaid
flowchart TD
    subgraph OPS["🔧 Operations"]
        O1["Redis Sentinel / Cluster\nAOF persistence\nAutomatic failover"]
        O2["MongoDB Replica Set\nAtlas M10+ for HA\nRead replicas for policy lookups"]
        O3["Kubernetes Deployment\nHPA for autoscaling\nLiveness + Readiness probes → /health"]
    end

    subgraph SEC["🔐 Security"]
        S1["Replace x-internal-api-key\nwith mTLS or JWT"]
        S2["Use Vault / AWS Secrets Manager\nfor credential injection"]
        S3["Network policy:\nOnly trusted upstream → RateGuard"]
    end

    subgraph OBS["📊 Observability"]
        B1["Prometheus /metrics endpoint\nCounter: allowed/denied per client"]
        B2["Grafana dashboard\nRate limit heat maps"]
        B3["OpenTelemetry\nEnd-to-end request tracing"]
        B4["PagerDuty / Slack alerts\non error rate spikes"]
    end

    subgraph PERF["⚡ Performance"]
        P1["Redis policy cache\nCache client doc 30s in Redis\nEliminate MongoDB round-trip on hot path"]
        P2["Connection pooling\nMongoose pool size = pod count"]
        P3["Redis pipelining\nFor batch check endpoints"]
    end
```

| Area | Recommendation |
|---|---|
| **Redis HA** | Redis Sentinel (3 nodes) or Redis Cluster with AOF persistence |
| **MongoDB HA** | Replica set (1 primary + 2 secondaries) or MongoDB Atlas |
| **Auth upgrade** | Replace pre-shared key with mTLS between gateway and RateGuard |
| **Observability** | Add `/metrics` with Prometheus counters for allowed/denied by clientId |
| **Performance** | Cache client documents in Redis (30s TTL) to eliminate MongoDB reads on hot paths |
| **Kubernetes** | Deploy with HPA (scale on CPU/RPS), liveness probe → `/health`, readiness probe → `/health` |
| **Secrets** | Use HashiCorp Vault, AWS Secrets Manager, or Kubernetes Secrets |
| **Tracing** | Instrument with OpenTelemetry SDK for distributed request traces |
| **bcrypt rounds** | Set `BCRYPT_ROUNDS=12` in prod (default), `BCRYPT_ROUNDS=4` in dev/test |
