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

log "ensuring OSRS cache is present (downloads on first boot only)..."
bunx tsx scripts/ensure-cache.ts --server

if [ ! -d "/app/server/data" ]; then
  mkdir -p /app/server/data
fi

log "starting xRSPS server..."
exec bunx tsx server/src/index.ts
