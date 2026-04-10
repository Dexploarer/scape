#!/usr/bin/env bash
#
# xRSPS docker entrypoint.
#
# Both `ensure-cache.ts` and the server are run through tsx under
# Node. We deliberately do NOT use Bun at runtime: Bun 1.3.12's
# module loader fails to resolve tsx's internal `./cjs/index.cjs`
# import and every tsx invocation dies with "Cannot find module
# './cjs/index.cjs' from ''". Node + tsx is the supported combo.
#
# Bun is still used at build time (see Dockerfile) for fast
# dependency installation — it reads bun.lock natively and beats npm
# by ~10×.
#
# 1. Ensure the OSRS cache is present (downloads on first boot if
#    the caches volume is empty — this is the ~minute-long hiccup a
#    fresh deployment takes once).
# 2. Boot the server.

set -euo pipefail

log() {
  printf '[entrypoint] %s\n' "$*"
}

TSX_BIN="/app/node_modules/.bin/tsx"
if [ ! -x "$TSX_BIN" ]; then
  log "tsx binary missing at $TSX_BIN — did bun install run in the image?"
  exit 1
fi

log "ensuring OSRS cache is present (downloads on first boot only)..."
"$TSX_BIN" scripts/ensure-cache.ts --server

if [ ! -d "/app/server/data" ]; then
  mkdir -p /app/server/data
fi

log "starting xRSPS server..."
exec "$TSX_BIN" server/src/index.ts
