# syntax=docker/dockerfile:1

# ---- Builder: install workspace deps (better-sqlite3 native build) + build the client ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Toolchain for better-sqlite3's native addon, in case no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci

# Copy the rest of the sources and build the client bundle into packages/client/dist,
# which the server serves in production. Domain + server run from TS via tsx — no build.
COPY . .
RUN npm run build -w @cmt/client

# ---- Runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring over installed node_modules (with the compiled better-sqlite3 binary — same
# base image + arch, so it's compatible), the sources, and the built client/dist.
COPY --from=builder /app ./

# The server reads CMT_PORT (never PORT — that would collide with Vite in dev).
ENV CMT_PORT=8080
EXPOSE 8080

# `npm start -w @cmt/server` runs `tsx src/index.ts` with cwd = packages/server.
CMD ["npm", "start", "-w", "@cmt/server"]
