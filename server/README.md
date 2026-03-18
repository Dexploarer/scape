Server (WebSocket)

-   Entrypoint: `server/src/index.ts`
-   Tick: 600ms (configurable via `TICK_MS`)
-   Port: 43594 (configurable via `PORT`), host `0.0.0.0` by default.

Scripts (from repo root):

-   `yarn server:start` — run server once via tsx
-   `yarn server:dev` — run with watch/reload via tsx
-   `yarn server:build` — build to `server/dist`

Environment variables:

-   `HOST` — host to bind (default `0.0.0.0`)
-   `PORT` — port to listen (default `43594`)
-   `TICK_MS` — tick duration in ms (default `600`)

Messages:

-   Server->Client: `welcome`, `anim`, `handshake`, `pos`, `tick`, `players`
-   Client->Server: `hello` (on connect), `handshake` (send desired name/appearance), `walk`, `face`, `pathfind`, `teleport`, `emote`

`anim` payload (sent on connect):

-   `{ idle, walk, run }` sequence IDs; defaults use Zaros OSRS values: `idle=808`, `walk=819`, `run=824`.

Handshake flow:

-   On connect: server sends `welcome` and `anim`.
-   Client sends `handshake` with optional `{ name, appearance }`.
-   Server responds with `handshake` `{ id, name?, appearance? }` confirming the assigned id and accepted appearance.
-   Only after handshake: server sends initial `pos` (spawn), then regular `tick`/`pos` updates.

`players` payload (periodic per-socket broadcast):

-   `{ list: [{ id, x, y, level, rot?, running?, appearance?, name? }, ...] }` for other connected players and bots.

Teleport:

-   Client sends `{ type: "teleport", payload: { to: { x, y }, level? } }` in world tile coordinates.
-   Server snaps player to that tile and replies with `pos` including `snap: true` so the client does not animate.

Emotes:

-   Client sends `{ type: "emote", payload: { index, loop?, seq? } }`.
-   Server maps `index` (0..54) to a SeqType id via `server/src/game/emotes.ts` and replies to the same socket with a `pos` containing `seq` so the client plays the emote immediately.
-   If `emotes.ts` does not have a mapping for this `index`, the server will fall back to a client-suggested `seq` when provided. This makes it easy to support additional emotes while you build out the full table for your cache revision.
-   The mapping is revision-specific and can be extended in `EMOTE_SEQ_MAP`.
