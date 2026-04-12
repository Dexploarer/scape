
<p align="center">
  <strong>'scape — an autonomous-agent playground grafted onto a browser OSRS private server.</strong><br>
  Multiverse experiments, LLM-driven NPCs, and PvP wars like Gielinor has never seen.
</p>

<p align="center">
  <em>Forked from <a href="https://github.com/xrsps/xrsps-typescript">xrsps/xrsps-typescript</a> — all OSRS gameplay, client, and server code credit to upstream.</em>
</p>

---

## What this is

`'scape` takes a faithful TypeScript OSRS private server + React/WebGL client and turns it into a **testbed for autonomous agents**. Agents aren't bolted on the side as bots — they're **first-class entities** living in the same world tick as human players, reading the same perception stream, and driving the same character types. One browser, one character, shared by the human and the agent. Click the ground to take over; release control and the loop picks back up.

The real goal: use this as a substrate for experiments that don't fit in any vanilla RSPS.

- **Autonomous agents.** LLM-driven characters with persistent memory (the "Scape Journal"), goals, perception snapshots, and a full OSRS toolbelt — walk, chat, attack, loot, bank, equip, cast, mine, chop, fish, remember, set goals, complete goals. State flows to the model as [TOON](https://github.com/toon-format/toon) (Token-Oriented Object Notation, ~40–60% fewer tokens than JSON) so the per-step cost stays cheap enough for long sessions.
- **Multiverse experiments.** Multiple worlds, multiple rulesets, multiple populations of agents coexisting. Run a PvE world and a scorched-earth world side by side. Seed them with different persona prompts and watch the economies diverge. Swap gamemodes without touching the base server.
- **PvP wars like Gielinor has never seen.** Because the agents are entities and not scripts, a war between two agent factions is just a normal PvP fight at scale — except the combatants coordinate, remember grudges, and retreat to bank. Human players drop in and pick a side.
- **Agent-operator steering.** The `@elizaos/app-scape` milady plugin exposes a `/prompt` endpoint so you can direct agents mid-session (`"push east and draw them into multi"`) without disconnecting. Directed prompts become high-priority goals in the next LLM step.

## Architecture sketch

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│   React/WebGL client  ←─── human input                      │
│   In-browser autoplay loop  ←─── agent decisions (shared    │
│                                   character, same tab)     │
└────────────────────────┬────────────────────────────────────┘
                         │ binary WebSocket (:43594)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ xRSPS server (TypeScript, Bun)                              │
│   PlayerState (+ optional AgentComponent)                   │
│   MovementService, CombatService, InventoryService, …       │
│   Gamemodes: vanilla, infinite-run, sailing, …              │
└────────────────────────┬────────────────────────────────────┘
                         │ TOON bot-SDK (/botsdk, optional)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ milady runtime                                              │
│   @elizaos/app-scape plugin                                 │
│     ScapeGameService  ← LLM loop every N ms                 │
│     JournalService    ← memories, goals, progress           │
│     actions/          ← walk, chat, attack, remember, …     │
│     providers/        ← bot-state, inventory, nearby, …    │
└─────────────────────────────────────────────────────────────┘
```

## Quick start

Requires **Bun v1.3+** (Bun replaces Node + Yarn here).

```bash
git clone https://github.com/Dexploarer/-scape.git scape
cd scape
bun install
bun run server:build-collision    # one-time: build collision cache
bun run export-map-images         # one-time: export map tiles
bun run dev                       # unified TUI (server + client + agent-dev)
```

`bun run dev` opens three mprocs tabs:

1. **server** — xRSPS on `ws://localhost:43594`
2. **client** — React dev server on `http://localhost:3000`
3. **agent-dev** — launcher that generates a persistent dev-agent identity, waits for the client to come up, then opens your default browser at `?username=…&password=…&autoplay=1`. You land in-game auto-logged-in, and your character starts walking around on its own. Click the ground to take over.

### Running the autonomous milady agent

If you want the full LLM-driven agent (not just the in-browser random-walk loop), clone the [`milady`](https://github.com/milady-ai/milady) runtime and launch the `@elizaos/app-scape` plugin — it connects to the bot-SDK and drives a character with goals, journal, and operator steering. See [`plugins/app-scape/README.md`](https://github.com/milady-ai/milady/tree/develop/plugins/app-scape) for setup.

## Status

This is an active experiment, not a production RSPS. Expect:

- Things to break when gamemodes are swapped mid-session.
- The TOON protocol and `AgentComponent` shape to evolve.
- Agent behavior to be impressive one session and hilariously stuck the next — that's the nature of LLM-driven gameplay.

## Credits

This project stands on [xrsps/xrsps-typescript](https://github.com/xrsps/xrsps-typescript) — the TypeScript OSRS client and server by the xRSPS community, itself inspired by Project Zanaris. Every tick of gameplay, every interface, every cache loader, every combat formula comes from their work. `'scape` is a downstream fork that adds the agent layer on top.

If you're here for a faithful vanilla OSRS private server, go upstream. If you're here to watch LLMs try to do slayer tasks and start wars over a rune scim — stay.

---

<p align="center">
  <sub>Fan project. Not affiliated with, endorsed by, or connected to Jagex Ltd.<br>Old School RuneScape and related assets/trademarks belong to their respective owners.</sub>
</p>
