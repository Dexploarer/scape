#!/usr/bin/env bash
#
# xRSPS docker entrypoint.
#
# 1. Ensure the OSRS cache is present (downloads on first boot if the
#    caches volume is empty — this is the ~minute-long hiccup a fresh
#    deployment takes once).
# 2. Boot the server under bun.
#
# This script runs as uid bun:bun (set in the Dockerfile). The
# writable directories (/app/caches, /app/server/data) are chown'd to
# the bun user during image build.

set -euo pipefail

log() {
  printf '[entrypoint] %s\n' "$*"
}

# Bun 1.3.12's `bunx tsx` fails to resolve tsx's own CJS bootstrap
# inside this image (error: Cannot find module './cjs/index.cjs'
# from ''). Invoke tsx's CLI entrypoint directly via bun instead —
# this sidesteps bunx's binary-resolution path entirely and runs
# the same tsx code we'd use locally.
TSX_CLI="/app/node_modules/tsx/dist/cli.mjs"
if [ ! -f "$TSX_CLI" ]; then
  log "tsx CLI missing at $TSX_CLI — check that bun install ran in the image"
  exit 1
fi

log "ensuring OSRS cache is present (downloads on first boot only)..."
bun "$TSX_CLI" scripts/ensure-cache.ts --server

if [ ! -d "/app/server/data" ]; then
  mkdir -p /app/server/data
fi

log "starting xRSPS server..."
exec bun "$TSX_CLI" server/src/index.ts
