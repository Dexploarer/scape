import assert from "assert";
import path from "path";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { PathService } from "../src/pathfinding/PathService";
import { RectAdjacentRouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";
import { initCacheEnv } from "../src/world/CacheEnv";
import { DoorDefinitionLoader } from "../src/world/DoorDefinitionLoader";
import { DoorStateManager } from "../src/world/DoorStateManager";
import { MapCollisionService } from "../src/world/MapCollisionService";

function main(): void {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);
    const factory = getCacheLoaderFactory(env.info, env.cacheSystem as any);
    const locTypeLoader: any = factory.getLocTypeLoader();

    const mapService = new MapCollisionService(env, true);
    const pathService = new PathService(mapService, 128);
    const doorManager = new DoorStateManager(locTypeLoader, new DoorDefinitionLoader());

    const start = { x: 3224, y: 3220, plane: 0 };
    const doorTile = { x: 3227, y: 3223 };
    const doorLocId = 1536; // Closed Varrock castle door (opens to 1535)

    const loc = locTypeLoader.load(doorLocId);
    assert(loc, `Failed to load loc type ${doorLocId}`);

    const sizeX = Math.max(1, loc.sizeX || 1);
    const sizeY = Math.max(1, loc.sizeY || 1);

    const strategy = new RectAdjacentRouteStrategy(doorTile.x, doorTile.y, sizeX, sizeY);

    const result = pathService.findPath(
        {
            from: start,
            to: doorTile,
            size: 1,
        },
        strategy,
    );

    assert.ok(result.ok, "Expected pathfinding to succeed");
    assert.ok(result.waypoints, "Expected pathfinding to return waypoints");
    assert.ok(result.waypoints!.length > 0, "Expected non-empty path");

    const lastStep = result.waypoints![result.waypoints!.length - 1];
    const expected = { x: 3226, y: 3223 };

    console.log("[Door Path Test]");
    console.log(`Start: (${start.x}, ${start.y}, ${start.plane})`);
    console.log(`Door tile: (${doorTile.x}, ${doorTile.y})`);
    console.log(`Path length: ${result.waypoints!.length}`);
    console.log(`Last step: (${lastStep.x}, ${lastStep.y})`);

    assert.strictEqual(lastStep.x, expected.x, "Final step should stop west of the door");
    assert.strictEqual(lastStep.y, expected.y, "Final step should stop directly adjacent to door");

    console.log("✓ Door adjacency path test passed (stops at 3226,3223).");

    // Simulate opening the door (1536 -> 1535) and ensure we remain on the same tile
    const closeResult = doorManager.toggleDoor({
        x: doorTile.x,
        y: doorTile.y,
        level: 0,
        currentId: doorLocId,
        action: "Close", // closed door responds to "Close"
    });
    assert.strictEqual(closeResult?.success, true, "Door toggle should succeed");
    assert.strictEqual(
        closeResult?.newLocId,
        1535,
        "Door should toggle from 1536 to 1535 when closing",
    );

    const reopenResult = doorManager.toggleDoor({
        x: doorTile.x,
        y: doorTile.y,
        level: 0,
        currentId: closeResult!.newLocId!,
        action: "Open",
    });
    assert.strictEqual(reopenResult?.success, true, "Door reopen should succeed");
    assert.strictEqual(
        reopenResult?.newLocId,
        doorLocId,
        "Door should toggle back to 1536 when opening",
    );

    assert.deepStrictEqual(
        lastStep,
        expected,
        "Door interaction should keep player at adjacency tile",
    );
    console.log("✓ Door toggle test passed (remains at 3226,3223 after close/reopen).");
}

main();
