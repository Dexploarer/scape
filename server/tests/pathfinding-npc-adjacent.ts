import assert from "assert";
import path from "path";

import { NpcState } from "../src/game/npc";
import { PlayerManager } from "../src/game/player";
import { PathService } from "../src/pathfinding/PathService";
import { RectAdjacentRouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

/**
 * Test case: Player at (3231, 3214) tries to interact with NPC at (3230, 3214).
 *
 * There is a wall between these two tiles. Even though the player is cardinally
 * adjacent to the NPC, the interaction should fail because the wall blocks it.
 *
 * OSRS parity: The interaction route must not accept a wall-blocked adjacent tile
 * as a valid arrival. The player should remain without a route rather than
 * "successfully" interacting through the wall.
 */
function main() {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);

    const mapService = new MapCollisionService(env, true);
    const pathService = new PathService(mapService, 128);

    const playerX = 3231;
    const playerY = 3214;
    const npcX = 3230;
    const npcY = 3214;
    const npcSize = 1;
    const plane = 0;

    // Log the collision flags at both tiles for debugging
    const playerFlag = pathService.getCollisionFlagAt(playerX, playerY, plane);
    const npcFlag = pathService.getCollisionFlagAt(npcX, npcY, plane);

    // eslint-disable-next-line no-console
    console.log(
        `Player tile (${playerX}, ${playerY}): flag=0x${playerFlag?.toString(16) ?? "undefined"}`,
    );
    // eslint-disable-next-line no-console
    console.log(`NPC tile (${npcX}, ${npcY}): flag=0x${npcFlag?.toString(16) ?? "undefined"}`);

    // Verify that there's a wall between the player and NPC
    const hasWall = pathService.edgeHasWallBetween(playerX, playerY, npcX, npcY, plane);
    // eslint-disable-next-line no-console
    console.log(`Wall between player and NPC: ${hasWall}`);

    // ASSERTION 1: There must be a wall between player and NPC
    assert.strictEqual(
        hasWall,
        true,
        `Expected a wall between player (${playerX}, ${playerY}) and NPC (${npcX}, ${npcY})`,
    );

    const routeStrategy = new RectAdjacentRouteStrategy(npcX, npcY, npcSize, npcSize);
    routeStrategy.setCollisionGetter(
        (x, y, level) => pathService.getCollisionFlagAt(x, y, level),
        plane,
    );

    assert.strictEqual(
        routeStrategy.hasArrived(playerX, playerY, plane),
        false,
        "Wall-blocked adjacency must not count as arrived",
    );

    const pm = new PlayerManager(pathService as any);
    const ws: any = { id: "wall-blocked" };
    const player = pm.add(ws, playerX, playerY, plane);
    const npc = new NpcState(1, 1, 1, -1, -1, 32, { x: npcX, y: npcY, level: plane });

    const routed = (pm as any).routePlayerToNpc(player, npc);
    assert.strictEqual(
        routed,
        false,
        "Expected interaction routing to reject a wall-blocked adjacent NPC tile",
    );
    assert.deepStrictEqual(
        player.getPathQueue(),
        [],
        "Player should not receive a movement path when the interaction edge is wall-blocked",
    );

    // eslint-disable-next-line no-console
    console.log("Test passed: interaction routing rejects wall-blocked NPC adjacency.");
}

main();
