import assert from "assert";
import path from "path";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { NpcManager } from "../src/game/npcManager";
import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

function requireNpcByName(list: ReadonlyArray<any>, substring: string, ctx: string): void {
    assert(
        list.some((npc) => {
            const name = npc?.name as string | undefined;
            return name?.constructor === String
                ? name.toLowerCase().includes(substring.toLowerCase())
                : false;
        }),
        `Expected NPC list for ${ctx} to contain name with substring "${substring}".`,
    );
}

function main(): void {
    const env = initCacheEnv("caches");
    const mapService = new MapCollisionService(env, false, {
        precomputedRoot: "server/cache/collision",
        usePrecomputed: true,
    });
    const pathService = new PathService(mapService);
    const cacheFactory = getCacheLoaderFactory(env.info, env.cacheSystem as any);

    const npcTypeLoader = cacheFactory.getNpcTypeLoader();
    const basTypeLoader = cacheFactory.getBasTypeLoader();

    const npcManager = new NpcManager(mapService, pathService, npcTypeLoader, basTypeLoader);
    npcManager.loadFromFile(path.resolve("server/data/npc-spawns.json"));

    const radius = 15;

    // Step 1: player at the Grand Exchange spawn tile
    const geTile = { x: 3166, y: 3475, level: 0 } as const;
    const geNearby = npcManager.getNearby(geTile.x, geTile.y, geTile.level, radius);
    assert(geNearby.length > 0, "Expected at least one GE NPC in streaming radius.");
    requireNpcByName(geNearby, "Bob Barter", "Grand Exchange");

    const geVisible = new Set<number>(geNearby.map((npc) => npc.id));

    // Step 2: simulate unloading GE chunk and loading Falador guard chunk
    const guardTile = { x: 2540, y: 3090, level: 0 } as const;
    const guardNearby = npcManager.getNearby(guardTile.x, guardTile.y, guardTile.level, radius);
    assert(guardNearby.length > 0, "Expected guard NPCs to stream in after moving cities.");
    requireNpcByName(guardNearby, "guard", "Falador guards");

    const guardVisible = new Set<number>(guardNearby.map((npc) => npc.id));

    const geOnly = geNearby.filter((npc) => !guardVisible.has(npc.id));
    const guardOnly = guardNearby.filter((npc) => !geVisible.has(npc.id));

    assert(
        geOnly.length > 0,
        "Expected some GE NPCs to despawn when moving far away, but all remained visible.",
    );
    assert(
        guardOnly.length > 0,
        "Expected new guard NPCs to appear after moving, but no new NPC ids were streamed.",
    );

    // eslint-disable-next-line no-console
    console.log(
        `OK: streamed ${geNearby.length} GE NPCs, then ${guardNearby.length} guard NPCs with ${geOnly.length} despawns and ${guardOnly.length} new spawns.`,
    );
}

main();
