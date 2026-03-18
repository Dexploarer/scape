import assert from "assert";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import {
    PlayerInteractionSystem,
    PlayerRepository,
} from "../src/game/interactions/PlayerInteractionSystem";
import { PlayerState } from "../src/game/player";
import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

async function main(): Promise<void> {
    const cacheEnv = initCacheEnv("caches");
    const mapService = new MapCollisionService(cacheEnv, false, {
        precomputedRoot: "server/cache/collision",
        usePrecomputed: true,
    });
    const pathService = new PathService(mapService);
    const cacheFactory = getCacheLoaderFactory(cacheEnv.info, cacheEnv.cacheSystem as any);
    const locTypeLoader = cacheFactory.getLocTypeLoader();

    const ws: any = { id: "loc-routing-tree" };
    const player = new PlayerState(1, 3167, 3471, 0);
    player.setVarbitValue(10037, 12);
    const players = new Map<any, PlayerState>([[ws, player]]);

    const repo: PlayerRepository = {
        get: (socket: any) => players.get(socket),
        getById: (id: number) => (player.id === id ? player : undefined),
        getSocketByPlayerId: (id: number) => (player.id === id ? ws : undefined),
        forEach: (cb) => players.forEach((p, socket) => cb(socket, p)),
        forEachBot: () => {},
    };

    const system = new PlayerInteractionSystem(repo, pathService, locTypeLoader);

    system.startLocInteract(ws, {
        id: 1276,
        tile: { x: 3172, y: 3470 },
        level: 0,
        action: "Chop down",
    });

    const queue = player.getPathQueue();
    assert(queue.length > 0, "expected a path for tree interaction");
    const lastStep = queue[queue.length - 1]!;
    const acceptable = [
        { x: 3171, y: 3470 },
        { x: 3171, y: 3471 },
    ];
    assert(
        acceptable.some((tile) => tile.x === lastStep.x && tile.y === lastStep.y),
        `player should route to a tile adjacent to the tree, got (${lastStep.x},${lastStep.y})`,
    );

    // Simulate the client's walk command overwriting the server-enforced path.
    player.setPath(
        [
            {
                x: 3172,
                y: 3470,
            },
        ],
        false,
    );
    system.handleManualMovement(ws, { x: 3172, y: 3470 });
    const restoredQueue = player.getPathQueue();
    assert(restoredQueue.length > 0, "server should restore the loc interaction path after walk");
    const restoredLast = restoredQueue[restoredQueue.length - 1]!;
    assert(
        acceptable.some((tile) => tile.x === restoredLast.x && tile.y === restoredLast.y),
        "manual walk preservation should keep routing to an adjacent tile, not the loc tile",
    );

    player.clearPath();
    player.teleport(3171, 3469, 0);
    system.startLocInteract(ws, {
        id: 1276,
        tile: { x: 3172, y: 3470 },
        level: 0,
        action: "Chop down",
    });
    assert.strictEqual(
        player.getPathQueue().length,
        0,
        "diagonal adjacency to tree trunk should not enqueue a new path",
    );

    player.clearPath();
    player.teleport(3172, 3471, 0);
    system.startLocInteract(ws, {
        id: 1276,
        tile: { x: 3173, y: 3468 },
        level: 0,
        action: "Chop down",
    });
    const longQueue = player.getPathQueue();
    const expectedPath = [
        { x: 3173, y: 3472 },
        { x: 3174, y: 3473 },
        { x: 3175, y: 3474 },
        { x: 3176, y: 3474 },
        { x: 3177, y: 3474 },
        { x: 3178, y: 3474 },
        { x: 3179, y: 3474 },
        { x: 3180, y: 3474 },
        { x: 3181, y: 3473 },
        { x: 3181, y: 3472 },
        { x: 3181, y: 3471 },
        { x: 3180, y: 3471 },
        { x: 3179, y: 3471 },
        { x: 3178, y: 3471 },
        { x: 3177, y: 3471 },
        { x: 3176, y: 3471 },
        { x: 3175, y: 3470 },
    ];
    assert.deepStrictEqual(
        longQueue,
        expectedPath,
        "long loc routes should preserve every step without truncation",
    );

    console.log("\n✓ Tree loc routing reaches a nearby adjacent tile without excessive detours");
    console.log("✓ Tree can be chopped from the NW diagonal tile without extra pathing");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
