# Agent Endpoint (`BotSdkServer`)

The xRSPS server exposes a second WebSocket endpoint for autonomous
agent clients, separate from the binary human-client protocol on
`ws://0.0.0.0:43594`. In production this agent endpoint is mounted at
`/botsdk` on the main world server; the legacy dedicated port is still
available for standalone local-only mode. This endpoint is what the `@elizaos/app-scape`
milady plugin connects to when an operator launches `'scape` from the
milady apps grid.

Agents spawned through this endpoint are **first-class players in the
xRSPS world**. They use the same scrypt-authenticated accounts, the
same persistence layer, the same tick loop, the same combat rules,
and the same save file format as human players. The only difference
is the I/O channel.

## When to enable it

Enable it whenever you want autonomous agents (human-drivable or
LLM-driven) playing in the world alongside real players. The
endpoint is **disabled by default** — without a `BOT_SDK_TOKEN` the
server refuses to start it, so a casual deployment that doesn't
know or care about agents never exposes an extra attack surface.

## Configuration

Four environment variables, all override `server/config.json`:

| Env var                         | Default              | Purpose                                                                                               |
|---------------------------------|----------------------|-------------------------------------------------------------------------------------------------------|
| `BOT_SDK_TOKEN`                 | *(unset = disabled)* | Shared secret. Agents send this in their first frame; mismatches get disconnected with `bad_token`. |
| `BOT_SDK_HOST`                  | `127.0.0.1`          | Bind address. Default is localhost-only; override for remote agent hosts.                           |
| `BOT_SDK_PORT`                  | `43595`              | Legacy standalone TCP port. Production uses `/botsdk` on the main world server.                     |
| `BOT_SDK_PERCEPTION_EVERY_N_TICKS` | `3`               | How often the perception emitter pushes a TOON snapshot to each connected agent.                    |
| `HOSTED_SESSION_SECRET`         | *(unset)*            | HMAC secret used to sign hosted human/agent session tickets.                                         |
| `HOSTED_SESSION_ISSUER_SECRET`  | *(unset)*            | Bearer token required for `POST /hosted-session/issue` when minting hosted session tickets.         |

Example `server/config.json` snippet for a private, LAN-only deployment
where you run milady on the same box:

```json
{
  "serverName": "Local Development",
  "maxPlayers": 2047,
  "gamemode": "vanilla",
  "allowedOrigins": ["http://localhost:3000"],
  "botSdkHost": "127.0.0.1",
  "botSdkPort": 43595
}
```

And the matching env var to actually enable it:

```bash
export BOT_SDK_TOKEN=dev-secret
bun run server:start
```

## Hosted session issuing

Hosted human and agent logins now support a ticket-based flow in
addition to the existing password flow. When both
`HOSTED_SESSION_SECRET` and `HOSTED_SESSION_ISSUER_SECRET` are set,
the game server exposes:

```text
POST /hosted-session/issue
Authorization: Bearer <HOSTED_SESSION_ISSUER_SECRET>
Content-Type: application/json
```

Example request:

```json
{
  "kind": "agent",
  "principalId": "principal:agent-77",
  "displayName": "Toon Agent",
  "worldCharacterId": "toon-77",
  "agentId": "agent-77",
  "ttlMs": 300000
}
```

Example response:

```json
{
  "sessionToken": "hs1....",
  "claims": {
    "version": 1,
    "kind": "agent",
    "principalId": "principal:agent-77",
    "worldId": "vanilla",
    "worldCharacterId": "toon-77",
    "displayName": "Toon Agent",
    "issuedAt": 1700000000000,
    "expiresAt": 1700000300000,
    "agentId": "agent-77"
  }
}
```

The web client can then launch with:

```text
/?sessionToken=<token>&worldCharacterId=<worldCharacterId>
```

The Bot SDK can send the same `sessionToken` and `worldCharacterId`
in its additive hosted spawn fields instead of using password auth.

For local ops/dev, you can mint one from the repo directly:

```bash
HOSTED_SESSION_ISSUER_SECRET=issuer-secret \
WEB_CLIENT_BASE_URL=http://127.0.0.1:3000 \
bun run hosted-session:issue \
  --kind agent \
  --principal-id principal:agent-77 \
  --display-name "Toon Agent" \
  --world-character-id toon-77 \
  --agent-id agent-77
```

## Protocol summary

The endpoint speaks **TOON** (Token-Oriented Object Notation,
`@toon-format/toon`), not JSON. The full frame reference lives in
`server/src/network/botsdk/BotSdkProtocol.ts`. At a high level:

**Client → server:**
- `auth` — shared-secret handshake, always sent first
- `spawn` — logs the agent into the world via the
  `AccountStore` + `PlayerPersistence` layer (scrypt verify + save
  restore, same as a human login)
- `action` — one of: `walkTo`, `chatPublic`, `attackNpc`, `dropItem`,
  `eatFood` (more land in later PRs)
- `disconnect` — graceful shutdown, triggers disconnect-save

**Server → client:**
- `authOk` / `error` — response to `auth`
- `spawnOk` — agent is in the world, here's the player id + position
- `ack` — response to an `action` that carried a `correlationId`
- `event` — high-signal TOON wakeup frame pushed immediately from the
  typed game event bus (`skill:levelUp`, `equipment:equip`,
  `npc:death` when the agent got the kill, etc.)
- `perception` — the agent's current view of the world (self, skills,
  inventory, equipment, nearby NPCs/players/objects, recent events)
- `operatorCommand` — pushed by the server when a human types
  `::steer <text>` in public chat; the plugin injects it into the
  next LLM prompt
- `event` — optional high-signal wakeup frame for event-driven agents;
  only sent when the client opts into `features: ["liveEvents"]`

## Why TOON and not JSON?

Agents read TOON-encoded state as LLM prompt context and emit
TOON-encoded actions. For the kinds of data the agent loop moves
around — inventory rows, nearby-NPC tables, recent-event lists — TOON
uses roughly 40-60% fewer tokens than the equivalent JSON. At ~4 steps
per minute over long sessions, that's a significant cost reduction,
and it also simplifies LLM output parsing (the model emits TOON more
reliably than JSON-with-escaping).

## Agent as first-class citizen

The agent layer is implemented as a non-invasive **component** hung
off `PlayerState`:

```ts
// server/src/game/player.ts (partial)
export class PlayerState extends Actor {
    // … unchanged fields …
    agent?: import("../agent").AgentComponent;
}
```

Existing services (`MovementService`, `CombatService`, `InventoryService`,
`PlayerPersistence`) work on any `PlayerState` regardless of whether
`.agent` is set. Agent-aware services read the component only when
present:

- `BotSdkPerceptionBuilder` builds the perception snapshot that the
  agent sees, including a bounded `recentEvents` FIFO sourced from the
  game event bus.
- `BotSdkPerceptionEmitter` pushes that snapshot down the wire every
  N ticks.
- `BotSdkEventBridge` subscribes to the typed game event bus and
  immediately pushes TOON `event` frames to the relevant connected
  agent, so autonomous loops can wake on world changes instead of
  relying on blind polling.
- `BotSdkActionRouter` turns incoming action frames into calls into
  the normal service layer — no duplicated logic, no gameplay code
  lives in the bot-SDK.

## Event-driven loop

The runtime is now explicitly **event-driven over TOON**:

- all Bot SDK wire frames are TOON-encoded (`auth`, `spawn`, `action`,
  `ack`, `event`, `perception`, `operatorCommand`)
- the server pushes `event` frames immediately on relevant world
  changes through the typed `GameEventBus`
- each agent also receives a periodic `perception` snapshot as a
  heartbeat / state resync channel

That means autonomous agents can run a simple loop:

1. Wake on `event`, `ack`, or `operatorCommand`
2. Re-read the latest TOON `perception`
3. Choose one action
4. Wait for the next pushed signal

The periodic perception tick is now a fallback, not the primary wakeup
mechanism.

This is the first step toward making xRSPS an ECS-for-agents. The
refactor can grow the component set over time without touching the
existing OO service code; human players remain entirely unaffected.

## In-game steering (`::steer`)

Any logged-in human player can issue an operator directive to
every connected agent by typing:

```
::steer mine copper ore in varrock
```

The chat handler routes it through `services.broadcastOperatorCommand`
→ `BotSdkServer.broadcastOperatorCommand` → every connected agent's
WebSocket as an `operatorCommand` TOON frame. The agent's plugin-side
game service receives it via `onOperatorCommand`, calls
`setOperatorGoal(text)`, and the next LLM step injects it into the
prompt as a highest-priority directive.

The server replies to the sender with either:
- `Steered N agents.` — success, N agents received the directive
- `No connected 'scape agents to steer.` — no agents currently online

## Security

The agent endpoint has a smaller attack surface than the human
endpoint but is not zero. The safeguards:

1. **Shared-secret token.** Unauthenticated agents can't connect;
   mismatched tokens get disconnected immediately with `bad_token`.
2. **Bind host.** Default `127.0.0.1` keeps the endpoint
   localhost-only. Only override when running milady on a different
   machine.
3. **Account auth.** Every spawn frame runs through the normal
   `AccountStore.verifyOrRegister` path with scrypt. Stealing a
   `BOT_SDK_TOKEN` still doesn't let you log in as an existing
   account without the password.
4. **Disconnect cleanup.** Sessions are reaped on disconnect via
   `AgentPlayerFactory.destroy`, freeing the display name and player
   id immediately so there's no "ghost bot" state.

See `docs/deployment.md` for public-deployment guidance.
