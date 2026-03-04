# ── Stage 1: Install ALL dependencies (prod + dev) for the test stage ─────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ── Stage 2: Test image — full deps + source code (used by docker compose test) ──
FROM deps AS test
WORKDIR /app
COPY . .

# ── Stage 3: Install production-only dependencies ─────────────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ── Stage 4: Lean production runner ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# curl is needed for the Docker health check
RUN apk add --no-cache curl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
