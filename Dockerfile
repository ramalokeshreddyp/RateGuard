FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM deps AS test
WORKDIR /app
COPY . .

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
