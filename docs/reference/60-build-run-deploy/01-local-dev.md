# 60.1 — Local development

This page walks you from a fresh clone to a running server + client.

## 1. Install dependencies

```sh
bun install
```

Installs all JavaScript dependencies. Both `src/` (client) and `server/` share the same `node_modules` — there's a single top-level `package.json`.

## 2. Fetch the OSRS cache

The server and client both need the OSRS data cache. On the first run of `bun run start` (client) or `bun run server:start` (server), `scripts/ensure-cache.ts` auto-downloads and extracts the cache from the URL configured in `scripts/download-caches.js`. Subsequent runs use the cached copy under the repo's `caches/` directory.

You can force a re-download with:

```sh
rm -rf caches/
bun run ensure-cache
```

See [60.3 — The OSRS cache](./03-cache.md).

## 3. Start the dev environment

```sh
bun run dev
```

This launches `mprocs` with `mprocs.yaml`, which brings up three tabs:

- **server** — the game server (WebSocket on `127.0.0.1:43594`, bot-SDK on `43595` if enabled).
- **client** — the React dev server on `http://localhost:3000`.
- **agent-dev** — a local browser launcher. It waits for the client dev server, opens your default browser at `http://localhost:3000/?username=...&password=...&autoplay=1`, and relies on the in-browser autoplay loop for movement.

Navigate mprocs with `Ctrl-A` then `Tab`, `r` to restart the focused process, `q` to quit everything.

### Running individual procs

```sh
mprocs -n server     # just the server
mprocs -n client     # just the client
```

Or run the raw commands without mprocs:

```sh
bun run server:start     # server
bun run start            # client (react-scripts via craco)
```

## 4. Open the client

Open `http://localhost:3000` in a browser if `agent-dev` did not already do it for you. The client falls back to `ws://localhost:43594` when `REACT_APP_WS_URL` is not set.

On first connect you should see:

1. A login screen if you opened the page manually.
2. If `agent-dev` launched the browser, the query params auto-fill a persisted dev identity and may auto-log you in immediately.
3. You can still log in manually with any username + password pair that meets the minimum length. The default `JsonAccountStore` auto-registers on first login.

## 5. Edit things

- **Client TSX/CSS** — edited files hot-reload via craco (React fast refresh).
- **Server TS** — `bun run server:start` runs the server via `tsx` once. Restart it manually via mprocs (`Ctrl-A r`) or rerun the command after server-side edits.
- **Extrascripts** — changes to `server/extrascripts/<id>/index.ts` trigger a reload of just that extrascript without restarting the server (if the dev loader is running — see [50.3](../50-gamemodes-scripts/03-extrascripts.md)).
- **Gamemodes** — no hot reload; restart the server to pick up changes.
- **JSON data files** — no hot reload; restart the server.

## 6. Kill the dev environment

In mprocs: `Ctrl-A q`. The child procs shut down cleanly — the server runs a final save of every connected account before exiting.

## Common pitfalls

- **Port already in use** — stale server on `:43594`. `lsof -i :43594` and kill it.
- **Cache download fails** — check that `scripts/download-caches.js` points to a reachable URL, or drop an extracted cache into `caches/` by hand.
- **Client connects, server rejects** — the server has an origin allowlist set in `ServerConfig.allowedOrigins`. Add `http://localhost:3000` if you're customizing it.
- **Client shows "disconnected" instantly** — version mismatch. Client and server embed a version constant that must match. See `src/network/packet/ClientBinaryEncoder.ts` and `server/src/network/LoginHandshakeService.ts`.
- **Accounts or player-state corruption** — delete `server/data/accounts.json` to reset auth records, and/or delete `server/data/gamemodes/<gamemode>/player-state.json` to wipe saved gameplay state for that gamemode.

## Environment variables

- **`REACT_APP_WS_URL`** — override the client's WebSocket URL (e.g. `wss://game.example.com`).
- **`REACT_APP_SERVER_NAME`** — name shown in the client UI.
- **`BOT_SDK_TOKEN`** — shared secret for external bot-SDK clients on port `43595`. The default `bun run dev` flow does not need it.
- **`TICK_PROFILE=1`** — server-side: log per-tick timing.
- **`SYNC_DUMP=1`** — server-side: dump raw sync packet bytes for one tick.
- **`LOG_LEVEL=debug|info|warn|error`** — server log verbosity.

## Canonical facts

- **Dev orchestrator**: `mprocs.yaml`.
- **Cache fetcher**: `scripts/ensure-cache.ts`.
- **Server entrypoint**: `server/src/index.ts`.
- **Client entrypoint**: `src/index.tsx`.
- **Dev browser launcher**: `scripts/agent-dev.ts`.
- **Default client WebSocket URL**: `ws://localhost:43594`.
- **Default server port**: `43594`.
- **Default bot-SDK port**: `43595`.
- **Default client dev port**: `3000`.
- **Accounts file**: `server/data/accounts.json`.
- **Local player-state file**: `server/data/gamemodes/<gamemode>/player-state.json`.
- **Rule**: Bun is the preferred runtime; avoid `npm`/`yarn`/`pnpm` and `ts-node`/`jest`/`vitest`.
