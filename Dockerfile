# syntax=docker/dockerfile:1.6
#
# xRSPS server — server-only runtime image.
#
# What's in here:
#   - Bun (runs TypeScript directly, no transpile step)
#   - The repo source needed for the server (server/, src/rs, src/shared, scripts/)
#   - node_modules with devDependencies (we use `bunx tsx` at runtime)
#
# What's NOT in here (mounted as volumes):
#   - caches/      → OSRS cache. Downloaded on first boot via
#                    `ensure-cache.ts --server`. ~700 MB. Persist this volume
#                    or every container restart re-downloads.
#   - server/data/ → accounts.json, dev-agent-identity.json, player state.
#                    Persist this or players lose their characters on restart.
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
# Run (production, with origin allowlist + scrypt auth):
#   docker run -d --name scape-server --restart unless-stopped \
#     -p 127.0.0.1:43594:43594 \
#     -v scape_cache:/app/caches \
#     -v scape_data:/app/server/data \
#     -e NODE_ENV=production \
#     -e ALLOWED_ORIGINS="https://play.yourdomain.com" \
#     scape-server
#
# Behind Caddy for TLS: see docker-compose.yml for the full setup.

FROM oven/bun:1.3-slim AS runtime

# ─── System dependencies ───────────────────────────────────────────────
# - ca-certificates: TLS for the OpenRS2 cache download
# - curl: healthcheck + debugging
# - tini: PID 1 reaper so SIGTERM propagates cleanly to the server
# Everything else xRSPS needs (sharp, xxhash-wasm, threads.js) is pure
# JS or ships native binaries in the npm package.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Dependencies ──────────────────────────────────────────────────────
# Copy lockfile + package.json first so Docker caches the install layer
# across source changes. tsx is a devDependency but we need it at
# runtime (`bunx tsx server/src/index.ts`), so install the full tree.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Source ────────────────────────────────────────────────────────────
# We only need the server runtime, the shared RS helpers it imports
# from `src/`, and the scripts that run at boot. We intentionally skip
# the React client (src/client, src/ui, src/webgl) to keep the image
# lean — the client ships from a CDN in production.
COPY server ./server
COPY src/rs ./src/rs
COPY src/shared ./src/shared
COPY src/util ./src/util
COPY scripts ./scripts
COPY target.txt ./
COPY tsconfig.json ./

# ─── Runtime state directories ─────────────────────────────────────────
# Declared as VOLUMEs so operators who forget to mount them don't lose
# data to the container's writable layer (docker gives each VOLUME an
# anonymous named volume by default).
RUN mkdir -p /app/caches /app/server/data \
  && chown -R bun:bun /app

USER bun

VOLUME ["/app/caches", "/app/server/data"]

# ─── Entrypoint ────────────────────────────────────────────────────────
# `ensure-cache.ts --server` is idempotent: if the target cache already
# exists and validates, it exits in milliseconds. If it's missing (first
# boot with an empty volume) it downloads ~700 MB from OpenRS2. No
# prompts — the `--server` flag skips the map-image generation
# question.
COPY --chown=bun:bun deployment/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 43594

# tini → entrypoint script → bun server. tini ensures Ctrl-C and
# `docker stop` deliver SIGTERM to bun (not the shell), so the server
# runs its shutdown path and flushes player state to disk.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Healthcheck: the server's binary WebSocket endpoint rejects non-WS
# HTTP requests with a 400, which is enough to prove the port is live.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:43594/ \
      | grep -qE "^(400|426)$" || exit 1
