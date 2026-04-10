# syntax=docker/dockerfile:1.6
#
# xRSPS server — server-only runtime image.
#
# Runtime is Node.js 22. Bun is installed as a build-time helper for
# fast, deterministic dependency installs (it reads bun.lock), but
# tsx and the game server itself run under Node because Bun 1.3.12's
# module loader can't resolve tsx's internal `./cjs/index.cjs` import
# and fails with "Cannot find module './cjs/index.cjs' from ''" on
# every tsx invocation. This is a Bun + tsx 4.x incompatibility, not
# a bug in our code. Running tsx under Node (its native runtime)
# sidesteps it entirely.
#
# Build:
#   docker build -t scape-server .
#
# Run (dev):
#   docker run --rm -p 43594:43594 \
#     -v scape_cache:/app/caches \
#     -v scape_data:/app/server/data \
#     scape-server
#
# Run (production, with origin allowlist):
#   docker run -d --name scape-server --restart unless-stopped \
#     -p 127.0.0.1:43594:43594 \
#     -v scape_cache:/app/caches \
#     -v scape_data:/app/server/data \
#     -e NODE_ENV=production \
#     -e ALLOWED_ORIGINS="https://play.yourdomain.com" \
#     scape-server
#
# Behind Caddy for TLS: see docker-compose.yml for the full setup.

FROM node:22-slim AS runtime

# ─── System dependencies ───────────────────────────────────────────────
# - ca-certificates: TLS for the OpenRS2 cache download
# - curl: healthcheck + debugging + bun installer
# - unzip: bun installer extracts a zip
# - tini: PID 1 reaper so SIGTERM propagates cleanly to the server
# Everything else xRSPS needs (sharp, xxhash-wasm, threads.js) is pure
# JS or ships native binaries in the npm package.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      unzip \
      tini \
  && rm -rf /var/lib/apt/lists/*

# ─── Install Bun (build-time helper only) ──────────────────────────────
# We use Bun strictly for `bun install` because it reads bun.lock
# natively and is 10× faster than npm. Runtime is Node.js — see the
# entrypoint for why.
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /root/.bun && \
    bun --version

WORKDIR /app

# ─── Dependencies ──────────────────────────────────────────────────────
# Copy lockfile + package.json first so Docker caches the install
# layer across source changes. tsx is a devDependency but we need it
# at runtime (to transpile TypeScript on the fly), so we install the
# full tree — this is expected for a tsx-based runtime.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && \
    ls -la /app/node_modules/.bin/tsx

# ─── Source ────────────────────────────────────────────────────────────
# We only need the server runtime, the shared RS helpers it imports
# from `src/`, and the scripts that run at boot. We intentionally
# skip the React client (src/client, src/ui, src/webgl) to keep the
# image lean — the client ships from a CDN in production.
COPY server ./server
COPY src/rs ./src/rs
COPY src/shared ./src/shared
COPY src/util ./src/util
COPY scripts ./scripts
COPY target.txt ./
COPY tsconfig.json ./

# ─── Runtime state directories ─────────────────────────────────────────
# Declared as VOLUMEs so operators who forget to mount them don't lose
# data to the container's writable layer. Sevalla / Fly / Railway
# / Render all ignore VOLUME directives and manage their own volumes;
# docker-compose uses the named volumes declared in docker-compose.yml.
RUN mkdir -p /app/caches /app/server/data && \
    chown -R node:node /app

USER node

VOLUME ["/app/caches", "/app/server/data"]

# ─── Entrypoint ────────────────────────────────────────────────────────
# Entry script runs `ensure-cache.ts --server` (idempotent: exits
# fast if the cache already exists) then hands off to the server.
# Both are invoked via tsx running under Node.
COPY --chown=node:node deployment/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 43594

# tini → entrypoint script → node. tini ensures Ctrl-C and
# `docker stop` deliver SIGTERM to Node (not the shell), so the
# server runs its shutdown path and flushes player state to disk.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Healthcheck: the server's binary WebSocket endpoint rejects non-WS
# HTTP requests with a 400, which is enough to prove the port is live.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT:-43594}/" \
      | grep -qE "^(400|426)$" || exit 1
