# 🏗️ ARCHITECTURE — RateGuard Rate Limiting Microservice

## 1. Objective and Core Idea

RateGuard is a **dedicated, stateless microservice** that enforces per-client, per-endpoint API rate limits across a distributed system. It removes rate-limiting logic from individual application services and centralises it in one reliable, horizontally-scalable layer.

**Key design goals:**
- Accurate distributed rate limiting with zero race conditions
- Per-client policy management independent of the service being protected
- One-command local setup for development and testing
- Production-grade containerisation and CI/CD automation

---

## 2. High-Level Architecture

```mermaid
flowchart TB
    subgraph External["🌐 External Callers"]
        GW[/"API Gateway\nor Reverse Proxy"/]
        ADM[/"Internal Admin\nor Provisioning Tool"/]
    end

    subgraph RateGuard["⚡ RateGuard Microservice (stateless, horizontally scalable)"]
        direction TB
        HELM["helmet — HTTP security headers"]
        LOG["pino-http — structured request logging\n(includes x-request-id)"]
        AUTH["authInternal middleware\n(x-internal-api-key gate)"]
        VAL["validate middleware\n(Joi schema → 400 on error)"]
        ERR["errorHandler middleware\n(generic 500, detailed internal logs)"]
        CC["clientsController\nPOST /api/v1/clients"]
        RC["rateLimitController\nPOST /api/v1/ratelimit/check"]
        HC["Health endpoint\nGET /health"]
        CS["clientService\n(bcrypt + SHA-256 + MongoDB)"]
        RLS["rateLimitService\n(Redis Lua Token Bucket)"]
        TBM["tokenBucketMath\n(pure math, independently testable)"]
    end

    subgraph Stores["💾 Storage Layer"]
        MDB[("🍃 MongoDB 7\nclients collection\nPolicies + hashed keys")]
        RDS[("🔴 Redis 7\nToken bucket state\nHMSET per clientId+path")]
    end

    GW  -->|POST /ratelimit/check| HELM --> LOG
    ADM -->|POST /clients + x-internal-api-key| HELM
    LOG --> AUTH
    LOG --> VAL
    AUTH --> CC --> CS --> MDB
    VAL  --> RC --> RLS --> RDS
    RC  -.->|fetch client policy| CS
    RLS -.->|pure math helper| TBM
    HC  -->|ping| MDB
    HC  -->|ping| RDS
    ERR -.->|catches all errors| RC
    ERR -.->|catches all errors| CC
```

---

## 3. Layered Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| **HTTP / Transport** | Express 4, Helmet | Route registration, HTTP security headers |
| **Middleware** | Joi, pino-http, custom | Input validation, structured logging, auth guard, error normalisation |
| **Controllers** | Express handlers | Use-case orchestration, HTTP response shaping |
| **Services** | bcrypt, ioredis, Lua | Business logic: client registration, rate-limit evaluation |
| **Data (Config)** | MongoDB 7, Mongoose | Persistent client policy storage |
| **Data (State)** | Redis 7, ioredis | Ephemeral token-bucket state (in-memory, atomic) |
| **Containers** | Docker, Compose | Reproducible multi-service environments |
| **CI/CD** | GitHub Actions | Automated build, test, image publish |

---

## 4. Why Token Bucket?

### Comparison of algorithms

| Property | Token Bucket | Fixed Window | Sliding Log | Leaky Bucket |
|---|---|---|---|---|
| Burst handling | ✅ Yes (up to capacity) | ❌ Boundary bursts | ✅ Yes | ❌ Smoothed only |
| Memory per client | ✅ O(1) | ✅ O(1) | ❌ O(n) | ✅ O(1) |
| Atomic Redis update | ✅ HMSET | ✅ INCR | ❌ ZADD + range | ✅ HMSET |
| Distributed safe | ✅ via Lua | ⚠️ Race-prone | ✅ via Lua | ✅ via Lua |
| Real-world feel | ✅ Natural | ⚠️ Reset spikes | ✅ Smooth | ⚠️ Rigid |

**Token Bucket was chosen** because it allows controlled bursting (important for real-world API clients), stores minimal state (two fields per key), and integrates naturally with Redis atomic Lua execution.

### Mathematical definition

```
Given:
  C = capacity (maxRequests)
  W = windowSeconds
  r = C / W              refill rate (tokens/second)
  rMs = r / 1000         refill rate (tokens/millisecond)

On each request:
  elapsed  = now_ms − lastRefill_ms
  refilled = elapsed × rMs
  tokens   = min(C, tokens_prev + refilled)
  allowed  = tokens >= 1

  if allowed:
    tokens = tokens − 1

Store: { tokens, lastRefill = now_ms }
```

### Redis Lua implementation

The entire read-modify-write cycle executes in a single `redis.call('EVAL', ...)` — guaranteeing atomicity without `MULTI/EXEC` complexity:

```lua
local key      = KEYS[1]
local now      = tonumber(ARGV[1])   -- current epoch ms
local capacity = tonumber(ARGV[2])   -- maxRequests
local rateMs   = tonumber(ARGV[3])   -- tokens per ms
local ttlMs    = tonumber(ARGV[5])   -- key TTL (window × 2)

local data      = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens    = tonumber(data[1]) or capacity
local lastRefill = tonumber(data[2]) or now

-- Refill
if now > lastRefill then
  tokens = math.min(capacity, tokens + (now - lastRefill) * rateMs)
  lastRefill = now
end

-- Consume
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('PEXPIRE', key, ttlMs)

return { allowed, tokens, lastRefill }
```

Redis key pattern: `ratelimit:{clientId}:{base64url(path)}`  
TTL: `windowSeconds × 2` milliseconds (auto-expires idle bucket keys)

---

## 5. Request Lifecycle — Check Rate Limit

```mermaid
sequenceDiagram
    autonumber
    participant U as 🌐 Upstream
    participant M as 🌿 Middleware
    participant C as 🎮 Controller
    participant S as ⚙️ clientService
    participant R as 🔴 rateLimitService
    participant DB as 🍃 MongoDB
    participant RD as 🔴 Redis

    U->>M: POST /api/v1/ratelimit/check
    M->>M: Joi validates {clientId, path}
    M->>C: next() with sanitised body
    C->>S: getClientByClientId(clientId)
    S->>DB: findOne({clientId})
    DB-->>S: {maxRequests, windowSeconds}
    S-->>C: client document
    C->>R: checkRateLimit({clientId, path, maxRequests, windowSeconds})
    R->>RD: EVAL Lua script (single atomic call)
    RD-->>R: [allowed, tokens, lastRefill]
    R-->>C: {allowed, remainingRequests, retryAfter, resetTime}

    alt ✅ Allowed (tokens ≥ 1)
        C-->>U: 200 {allowed:true, remainingRequests, resetTime}
    else 🚫 Denied (tokens < 1)
        C-->>U: 429 + Retry-After header<br/>{allowed:false, retryAfter, resetTime}
    end
```

---

## 6. Request Lifecycle — Register Client

```mermaid
sequenceDiagram
    autonumber
    participant A as 🔧 Admin Tool
    participant M as 🌿 Middleware
    participant C as 🎮 Controller
    participant S as ⚙️ clientService
    participant DB as 🍃 MongoDB

    A->>M: POST /api/v1/clients<br/>x-internal-api-key: <key>
    M->>M: authInternal — verify header
    M->>M: Joi — validate {clientId, apiKey, maxRequests, windowSeconds}
    M->>C: next()
    C->>S: registerClient(body)
    S->>S: bcrypt.hash(apiKey, 12)
    S->>S: sha256(apiKey) → fingerprint
    S->>DB: Client.create({clientId, hashedApiKey, fingerprint, ...})

    alt ✅ Success
        DB-->>S: saved document
        S-->>C: {clientId, maxRequests, windowSeconds}
        C-->>A: 201 Created
    else 🔴 Duplicate (code 11000)
        DB-->>S: MongoServerError duplicate key
        S-->>C: ApiError(409, "clientId or apiKey already exists")
        C-->>A: 409 Conflict
    end
```

---

## 7. Data Design

### MongoDB — `clients` collection

| Field | Type | Constraint | Purpose |
|---|---|---|---|
| `_id` | ObjectId | Primary key | Mongo auto-generated |
| `clientId` | String | Unique index | Human-readable identifier |
| `hashedApiKey` | String | — | bcrypt hash (cost 12) |
| `apiKeyFingerprint` | String | Unique index | SHA-256 for uniqueness enforcement |
| `maxRequests` | Number | ≥ 1 | Bucket capacity |
| `windowSeconds` | Number | ≥ 1 | Refill window duration |
| `createdAt` | Date | — | Mongo timestamps |
| `updatedAt` | Date | — | Mongo timestamps |

### Redis — token bucket state

```
Key:    ratelimit:{clientId}:{base64url(path)}
Type:   Hash
Fields:
  tokens     Float   remaining token count
  lastRefill Int     epoch milliseconds of last state write

TTL:    windowSeconds × 2000 ms (auto-expired when idle)
```

---

## 8. Module Responsibilities

```mermaid
flowchart LR
    subgraph src["src/"]
        APP["app.js\nExpress + middleware wiring\n+ /health endpoint"]
        SRV["server.js\nBootstrap: connect Mongo+Redis\nthen app.listen()"]

        subgraph config["config/"]
            CFG["index.js — env vars"]
            DB["db.js — Mongoose connect/disconnect"]
            RED["redis.js — ioredis client"]
            LOG["logger.js — pino instance"]
        end

        subgraph mw["middleware/"]
            AUT["authInternal.js\n→ 401 if wrong key"]
            VAL["validate.js\n→ 400 on Joi fail"]
            ERR["errorHandler.js\n→ 500 generic / N specific"]
        end

        subgraph mdl["models/"]
            CLI["Client.js\nMongoose schema\n+ unique indexes"]
        end

        subgraph svc["services/"]
            CSS["clientService.js\nbcrypt + SHA-256\nMongo CRUD"]
            RLS["rateLimitService.js\nLua EVAL executor\ncalculates resetTime"]
            TBM["tokenBucketMath.js\nPure refill math\n(no I/O — fully unit testable)"]
        end

        subgraph ctrl["controllers/"]
            CLC["clientsController.js\nOrchestrates registration"]
            RLC["rateLimitController.js\nOrchestrates rate check"]
        end
    end
```

---

## 9. Security Architecture

```mermaid
flowchart TD
    R1[Incoming request] --> H1[Helmet\nCSP · HSTS · X-Frame]
    H1 --> H2{Route?}
    H2 -->|/api/v1/clients| H3[authInternal\nVerify x-internal-api-key]
    H3 -->|Invalid| E1[401 Unauthorized]
    H3 -->|Valid| H4[Joi Validation]
    H2 -->|/api/v1/ratelimit/check| H4
    H4 -->|Invalid| E2[400 Bad Request]
    H4 -->|Valid| H5[Business Logic]
    H5 --> H6[Error handler]
    H6 -->|ApiError| E3[4xx with message]
    H6 -->|Unknown error| E4[500 — generic message\nFull detail in server logs only]
```

| Threat | Mitigation |
|---|---|
| Plaintext API key storage | bcrypt (cost 12) — irreversible hash |
| Duplicate API keys | SHA-256 fingerprint with unique Mongo index |
| Unauthorized client creation | `x-internal-api-key` header gate |
| Race conditions in rate logic | Atomic Redis Lua `EVAL` |
| Error information leakage | 500 returns generic string; detail only logged server-side |
| HTTP header vulnerabilities | `helmet` middleware |
| Sensitive config in code | All secrets via environment variables |

---

## 10. Scalability & Reliability Architecture

```mermaid
flowchart TB
    LB[/"⚖️ Load Balancer"/] --> P1["⚡ RateGuard Pod 1\n(stateless)"]
    LB --> P2["⚡ RateGuard Pod 2\n(stateless)"]
    LB --> P3["⚡ RateGuard Pod 3\n(stateless)"]

    P1 & P2 & P3 --> R[("🔴 Redis\nShared token state\nAtomic across all pods")]
    P1 & P2 & P3 --> M[("🍃 MongoDB\nShared client policies\nRead-heavy, low churn")]
```

**Why this works:**
- App nodes are completely stateless — no in-process rate-limit state
- All rate decisions go through Redis Lua atomically, regardless of which pod handles the request
- MongoDB is read-heavy (policy lookup per request) — well-suited for replica sets / Atlas

---

## 11. CI/CD Architecture

```mermaid
flowchart LR
    GIT["fa:fa-code-branch GitHub\npush / PR"] --> CI

    subgraph CI["GitHub Actions — build-and-test"]
        B1["Checkout"] --> B2["docker compose build\napp + test images"] --> B3
        B3["docker compose up -d\nmongo + redis"] --> B4["Run unit tests\nnpm run test:unit"]
        B4 --> B5["Run integration tests\nnpm run test:integration"] --> B6["docker compose down -v"]
    end

    CI -->|"main branch + secrets present"| PUSH

    subgraph PUSH["GitHub Actions — push-image"]
        P1["Checkout"] --> P2["docker/login-action\nDocker Hub"] --> P3
        P3["docker/build-push-action\ntarget: runner\ntags: latest + SHA"]
    end
```

### Dockerfile stages

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:20-alpine` | Install all dependencies (dev + prod) |
| `test` | inherits `deps` | Copy full source — used by CI `docker compose run test` |
| `prod-deps` | `node:20-alpine` | Install production-only dependencies |
| `runner` | `node:20-alpine` | Copy prod deps + `src/` only — minimal final image |

---

## 12. Pros, Cons & Trade-offs

### Advantages
- **Distributed correctness** — Redis Lua atomicity prevents over-counting under concurrency
- **Horizontal scalability** — stateless pods, shared Redis state
- **Separation of concerns** — policy (Mongo) vs state (Redis) vs logic (Node.js)
- **Burst tolerance** — Token Bucket naturally handles bursty API clients
- **Testability** — `tokenBucketMath.js` is pure I/O-free and unit tested in isolation
- **One-command setup** — `docker compose up --build` starts everything with test data seeded

### Trade-offs
- **Operational complexity** — requires MongoDB + Redis alongside the service
- **Redis availability** — if Redis is unavailable, the decision path fails (mitigated by Redis HA/Sentinel in production)
- **Internal API key auth** — minimal; production environments should use mTLS or JWT
- **No built-in dashboard** — rate limit metrics require external tooling (Prometheus, Grafana)

---

## 13. Production Recommendations

| Area | Recommendation |
|---|---|
| Redis HA | Deploy Redis Sentinel or Redis Cluster with AOF persistence |
| MongoDB | Use a replica set or Atlas M10+ for HA |
| Auth | Replace internal API key with mTLS or signed JWTs |
| Observability | Add Prometheus `/metrics` endpoint + Grafana dashboard |
| Tracing | Instrument with OpenTelemetry for distributed traces |
| Deployment | Provide Kubernetes manifests with HPA for autoscaling |
| Secrets | Use Vault, AWS Secrets Manager, or Kubernetes Secrets — never hardcode |
