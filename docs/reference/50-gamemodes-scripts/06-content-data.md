# 50.6 — Content data files

Gamemodes and extrascripts lean on a mix of TypeScript source files and JSON data files for content. This page lists the shared JSON files under `server/data/` and explains the patterns for adding new content.

## Top-level `server/data/` files

These are shared across all gamemodes — every gamemode reads the same base content, then applies its own transforms.

### `items.json`

The full item type table (OSRS `obj` definitions), usually extracted from the cache via `scripts/cache/export-items.ts`. Each entry carries the item's name, inventory ops, examine text, model references, and stackability. Consumed by `server/src/cache/ObjTypeLoader.ts` and surfaced to gamemodes via `GamemodeInitContext.objTypeLoader`.

### `npc-spawns.json`

The static NPC spawn list. Each entry:

```json
{
    "id": 3106,
    "x": 3222,
    "y": 3218,
    "level": 0,
    "walkRadius": 3,
    "respawn": 50
}
```

- `id` — NPC type id.
- `x, y, level` — spawn tile.
- `walkRadius` — how far the NPC wanders from the spawn tile.
- `respawn` — ticks before the NPC respawns after death.

Loaded at boot by `NpcManager`. See [20.5 — NPCs](../20-server/05-npcs.md).

### `npc-combat-defs.json` and `npc-combat-stats.json`

Combat definitions per NPC type. Stats carry attack/strength/defence/hp/magic/ranged levels plus attack bonuses. Defs carry style preferences (melee / ranged / magic), aggression range, attack range, retreat distance, respawn time overrides.

### `npc-sounds.generated.json`, `npc-sounds.overrides.json`, `npc-sounds.unresolved.json`

NPC sound effect mappings. `generated` is machine-produced from cache lookups; `overrides` is hand-curated; `unresolved` lists entries that couldn't be automatically matched. The server reads the first two, with overrides winning.

### `projectile-params.json`

Projectile launch parameters — arc height, start delay, arrival delay, start height, end height, gfx id — keyed by projectile type. Consumed by both the server (for damage timing) and the client (for visuals). See `src/shared/projectiles/projectileDelivery.ts`.

### `doors.json`

Catalog of door locs for dynamic open/close. Each entry lists the closed-state loc id, the open-state loc id, the door tile, and rotation. Loaded by the door subsystem described in [20.8 — World](../20-server/08-world.md).

### `stair-floors.json`

Catalog of stair locs and the plane transition they perform. Lets `LocInteractionService` send a "climb" interaction to a vertical teleport without hand-coding each stair.

### `intermap-links.json`

Teleport pairs between disjoint map regions (cave entrances, trapdoors, instance entrances). Used by the client-side map to hint that two disjoint tiles are linked.

### `diaryVarbits.ts`

TypeScript constants for the Achievement Diary varbit layout. Not JSON — it's shared code between scripts.

### `accounts.json`

The default `JsonAccountStore` file. Holds auth records: usernames, password hashes, ban flags, and login timestamps. Gameplay state lives separately under `gamemodes/<id>/player-state.json`. See [20.10 — Persistence](../20-server/10-persistence.md).

### `gamemodes/<id>/`

Per-gamemode data directories. Currently:

- **`server/data/gamemodes/vanilla/player-state.json`** — vanilla starter state.
- **`server/data/gamemodes/leagues-v/player-defaults.json`** — Leagues V starter state.

## Server source data (`server/src/data/`)

These are TypeScript modules (not JSON) that provide typed content:

- **`items.ts`** — typed helpers on top of `items.json` plus hand-coded item behaviors.
- **`npcCombatStats.ts`** — typed view over `npc-combat-stats.json`.
- **`locEffects.ts`** — loc interaction effects (e.g. "clicking this loc restores prayer").
- **`teleportDestinations.ts`** — named teleport destinations for spell books and admin commands.
- **`spellWidgetLoader.ts`** — spell book layout data for widget generation.

The split between `server/data/` (JSON, shared, often cache-exported) and `server/src/data/` (TypeScript, hand-authored) is load-bearing: the former is easy to regenerate; the latter is handwritten content.

## Adding content — patterns

### Adding an item

1. If you want a cache-backed item (real OSRS item), just use its id — it's already in `items.json`.
2. If you want a new custom item, create it via `CustomItemBuilder` in your extrascript:

```ts
CustomItemRegistry.register(
    CustomItemBuilder.create(60000)
        .basedOn(1205)
        .name("My Dagger")
        .inventoryActions("Wield", null, null, null, "Drop")
        .build(),
    "extrascript.my-feature",
);
```

3. Register an interaction handler if it should do something custom.

### Adding an NPC

Two parts: definition and spawn.

1. **Definition**: if it's a cache NPC, its stats come from `npc-combat-stats.json`. If you're making a new NPC type, you need to either add a cache override or build the NPC type programmatically (not covered here — see the custom-items pattern as a template).
2. **Spawn**: append to `npc-spawns.json` or dynamically spawn at runtime via `services.npcs.spawn(typeId, x, y, level)`.
3. **Behavior**: register a script handler for interactions (`registry.registerNpcInteraction(id, handler, option)`).

### Adding a shop

Shops live in the vanilla gamemode under `server/gamemodes/vanilla/shops/`. Each shop is a TypeScript module returning a `ShopDefinition { id, title, slots, buyMultiplier, sellMultiplier, restockRate }`. The vanilla gamemode calls `services.shops.register(shopDef)` during `initialize`.

An extrascript that adds a shop follows the same pattern — just call `services.shops.register(...)` from inside the extrascript's `register` function.

### Adding a teleport

Add an entry to `server/src/data/teleportDestinations.ts` and use it from a script handler:

```ts
services.movement.teleport(player, TeleportDestinations.VARROCK_SQUARE);
```

Or teleport to raw coordinates with `services.movement.teleport(player, { x, y, level })`.

### Adding a drop table

For vanilla-only: add a file under `server/gamemodes/vanilla/scripts/drops/` and register it during `initialize`.

For gamemode overrides: implement `getDropTable?(npcTypeId)` or `getSupplementalDrops?(npcTypeId, player)` on your `GamemodeDefinition`.

## Reload constraints

- **JSON files under `server/data/`** — read once at boot. Editing them requires a server restart.
- **TypeScript files under `server/src/data/`** — same; they're transpiled into the server bundle at startup.
- **Extrascripts** — hot reloadable in dev.
- **Gamemodes** — boot-time only.

## Canonical facts

- **Shared data root**: `server/data/`.
- **Server source data root**: `server/src/data/`.
- **Accounts file**: `server/data/accounts.json`.
- **NPC spawn list**: `server/data/npc-spawns.json`.
- **NPC combat stats**: `server/data/npc-combat-stats.json`.
- **Item table**: `server/data/items.json`.
- **Projectile params**: `server/data/projectile-params.json`.
- **Doors**: `server/data/doors.json`.
- **Stair floors**: `server/data/stair-floors.json`.
- **Inter-map links**: `server/data/intermap-links.json`.
- **Gamemode data root**: `server/data/gamemodes/<id>/`.
- **Rule**: JSON data is boot-time only; extrascripts are the only hot-reloadable content.
