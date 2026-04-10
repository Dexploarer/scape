# `'scape` server deployment

Deploying the xRSPS server is a single Docker image. Run it anywhere that speaks Docker — VPS, bare metal, any container host.

## What's in this directory

| File | Purpose |
|---|---|
| [`../Dockerfile`](../Dockerfile) | Builds the server runtime image (Bun + source + deps) |
| [`../docker-compose.yml`](../docker-compose.yml) | Wires the server + Caddy (optional) together |
| [`../.dockerignore`](../.dockerignore) | Keeps the client / docs / git history out of the image |
| [`Caddyfile`](Caddyfile) | Standalone Caddy config for bare-metal installs (not containerized) |
| [`Caddyfile.docker`](Caddyfile.docker) | Caddy config used by `docker-compose.yml` (env-var driven) |
| [`docker-entrypoint.sh`](docker-entrypoint.sh) | Container entrypoint — runs `ensure-cache.ts --server` then boots the game server |

## Quick start

### Server only (no TLS — for a platform that terminates TLS for you)

```bash
docker build -t scape-server .

docker run -d --name scape-server --restart unless-stopped \
  -p 43594:43594 \
  -v scape_cache:/app/caches \
  -v scape_data:/app/server/data \
  -e ALLOWED_ORIGINS="https://play.yourdomain.com" \
  scape-server
```

That's the whole deployment. The container downloads the OSRS cache on first boot (~5 minutes, ~700 MB), then listens on port 43594 for WebSocket connections.

Works unchanged on Fly.io, Railway, Koyeb, Render, Back4App, a VPS, your laptop — anywhere.

### Server + Caddy (full TLS stack)

```bash
export SCAPE_DOMAIN=game.yourdomain.com
export SCAPE_ACME_EMAIL=you@yourdomain.com
export SCAPE_ALLOWED_ORIGINS="https://play.yourdomain.com"

docker compose --profile tls up -d --build
```

Caddy auto-provisions a Let's Encrypt cert on first boot. Game server binds to loopback only; Caddy forwards `wss://game.yourdomain.com` to it.

## Persistent volumes

Two named volumes hold state that must survive container restarts:

| Volume | Contents | Back up? |
|---|---|---|
| `scape_cache` | OSRS cache (~700 MB) | No — re-downloadable from OpenRS2 |
| `scape_data` | `accounts.json`, `dev-agent-identity.json`, player save files | **Yes** — daily |

Back up `scape_data`:

```bash
docker run --rm -v scape_data:/data -v $PWD:/backup alpine \
  tar czf /backup/scape-data-$(date +%F).tar.gz -C /data .
```

## Environment variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `ALLOWED_ORIGINS` | Prod | (none) | Comma-separated list of origins allowed to open a WebSocket. Required in prod; without it non-loopback connections are rejected. |
| `NODE_ENV` | No | `development` | Set to `production` to enable strict origin checking and scrypt auth enforcement. |
| `BOT_SDK_TOKEN` | Optional | (unset) | Shared secret for the bot-SDK endpoint. Leave unset to disable it. |
| `SCAPE_DOMAIN` | If using Caddy | `localhost` | Domain Caddy provisions a cert for (compose wrapper only) |
| `SCAPE_ACME_EMAIL` | If using Caddy | (empty) | Let's Encrypt renewal notification address (compose wrapper only) |
| `SCAPE_ALLOWED_ORIGINS` | If using Caddy | `https://localhost:3000` | Compose wrapper for `ALLOWED_ORIGINS`; the compose file substitutes this into the container's `ALLOWED_ORIGINS` env var |

## Updating

```bash
git pull
docker compose --profile tls up -d --build
```

Old volumes are reused so players keep their characters.

## Platform notes

**Fly.io / Railway / Render / Koyeb / Back4App** — deploy the `scape-server` service only. They handle TLS themselves, so you don't need the `tls` profile. Mount the two volumes via the platform's volume UI.

**Any VPS** — use the full `docker compose --profile tls up -d` stack. Open ports 80/443 on the host firewall.

**Your laptop** — `docker compose up scape-server` runs the server at `ws://localhost:43594`. Handy for testing the client build against a real server without exposing anything.
