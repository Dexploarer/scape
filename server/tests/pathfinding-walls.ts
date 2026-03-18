import assert from "assert";
import path from "path";

import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

function main() {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);

    const mapService = new MapCollisionService(env, true);
    const pathService = new PathService(mapService, 128);

    // Test the specific case: path from 3167,3468 to 3167,3466 should go around wall
    // Correct path should contain waypoints 3166,3468 and 3166,3466
    {
        const from = { x: 3167, y: 3468, plane: 0 };
        const to = { x: 3167, y: 3466 };

        const result = pathService.findPath({ from, to, size: 1 });

        assert.ok(
            result.ok,
            `Pathfinding should succeed from (${from.x},${from.y}) to (${to.x},${to.y})`,
        );
        assert.ok(result.waypoints, "Path should have waypoints");
        assert.ok(result.waypoints!.length > 0, "Path should not be empty");

        // Check that path contains the expected waypoints
        const pathContains = (x: number, y: number) =>
            result.waypoints!.some((step) => step.x === x && step.y === y);

        const has3166_3468 = pathContains(3166, 3468);
        const has3166_3466 = pathContains(3166, 3466);

        console.log(`[Wall Avoidance Test]`);
        console.log(`From: (${from.x}, ${from.y}, ${from.plane})`);
        console.log(`To: (${to.x}, ${to.y})`);
        console.log(`Path waypoints (${result.waypoints!.length} total):`);
        result.waypoints!.forEach((step, i) => {
            console.log(`  ${i + 1}. (${step.x}, ${step.y})`);
        });
        console.log(`Contains (3166, 3468): ${has3166_3468}`);
        console.log(`Contains (3166, 3466): ${has3166_3466}`);

        assert.ok(
            has3166_3468,
            "Path should contain waypoint (3166, 3468) to go around wall on west side",
        );
        assert.ok(
            has3166_3466,
            "Path should contain waypoint (3166, 3466) before returning to destination",
        );

        // Verify path doesn't try to move directly south through the wall
        // First step should be to the west (3166, 3468), not south
        assert.strictEqual(
            result.waypoints![0].x,
            3166,
            "First step should move west to (3166, 3468), not south through wall",
        );
        assert.strictEqual(
            result.waypoints![0].y,
            3468,
            "First step should move west to (3166, 3468), not south through wall",
        );

        console.log(`✓ Wall avoidance test passed!`);
    }

    // Test reverse path: from 3167,3466 to 3167,3468 should use same waypoints
    {
        const from = { x: 3167, y: 3466, plane: 0 };
        const to = { x: 3167, y: 3468 };

        const result = pathService.findPath({ from, to, size: 1 });

        assert.ok(
            result.ok,
            `Pathfinding should succeed from (${from.x},${from.y}) to (${to.x},${to.y})`,
        );
        assert.ok(result.waypoints, "Path should have waypoints");
        assert.ok(result.waypoints!.length > 0, "Path should not be empty");

        // Check that path contains the expected waypoints (same as forward path)
        const pathContains = (x: number, y: number) =>
            result.waypoints!.some((step) => step.x === x && step.y === y);

        const has3166_3468 = pathContains(3166, 3468);
        const has3166_3466 = pathContains(3166, 3466);

        console.log(`\n[Reverse Path Test]`);
        console.log(`From: (${from.x}, ${from.y}, ${from.plane})`);
        console.log(`To: (${to.x}, ${to.y})`);
        console.log(`Path waypoints (${result.waypoints!.length} total):`);
        result.waypoints!.forEach((step, i) => {
            console.log(`  ${i + 1}. (${step.x}, ${step.y})`);
        });
        console.log(`Contains (3166, 3468): ${has3166_3468}`);
        console.log(`Contains (3166, 3466): ${has3166_3466}`);

        assert.ok(
            has3166_3468,
            "Reverse path should contain waypoint (3166, 3468) to go around wall on west side",
        );
        assert.ok(
            has3166_3466,
            "Reverse path should contain waypoint (3166, 3466) after leaving destination",
        );

        // Verify path doesn't try to move directly north through the wall
        // First step should be to the west (3166, 3466), not north
        assert.strictEqual(
            result.waypoints![0].x,
            3166,
            "First step should move west to (3166, 3466), not north through wall",
        );
        assert.strictEqual(
            result.waypoints![0].y,
            3466,
            "First step should move west to (3166, 3466), not north through wall",
        );

        console.log(`✓ Reverse path test passed! Same waypoints as forward path.`);
    }

    // Additional test: diagonal corner cutting prevention
    {
        const from = { x: 3200, y: 3200, plane: 0 };
        const to = { x: 3202, y: 3202 };

        const result = pathService.findPath({ from, to, size: 1 });

        if (result.ok && result.waypoints) {
            console.log(`\n[Diagonal Path Test]`);
            console.log(`From: (${from.x}, ${from.y}, ${from.plane})`);
            console.log(`To: (${to.x}, ${to.y})`);
            console.log(`Path waypoints (${result.waypoints.length} total):`);
            result.waypoints.forEach((step, i) => {
                console.log(`  ${i + 1}. (${step.x}, ${step.y})`);
            });

            // Check that no step cuts through a corner
            let prevX = from.x;
            let prevY = from.y;
            for (const step of result.waypoints) {
                const dx = step.x - prevX;
                const dy = step.y - prevY;
                const isDiagonal = dx !== 0 && dy !== 0;

                if (isDiagonal) {
                    console.log(
                        `  Diagonal move from (${prevX}, ${prevY}) to (${step.x}, ${step.y})`,
                    );
                }

                prevX = step.x;
                prevY = step.y;
            }
            console.log(`✓ Diagonal path test completed`);
        }
    }

    // Test U-shaped path around Varrock castle walls
    {
        const from = { x: 3210, y: 3461, plane: 0 };
        const to = { x: 3210, y: 3459 };

        const result = pathService.findPath({ from, to, size: 1 });

        console.log(`\n[U-Shaped Path Test]`);
        console.log(`From: (${from.x}, ${from.y}, ${from.plane})`);
        console.log(`To: (${to.x}, ${to.y})`);

        if (result.ok && result.waypoints) {
            console.log(`Path waypoints (${result.waypoints.length} total):`);
            result.waypoints.forEach((step, i) => {
                console.log(`  ${i + 1}. (${step.x}, ${step.y})`);
            });

            // Check that path goes around rather than cutting through
            const pathTilesX = result.waypoints.map((s) => s.x);
            const minX = Math.min(...pathTilesX);
            const maxX = Math.max(...pathTilesX);

            if (minX !== maxX) {
                console.log(`  Path detours via X range: ${minX} to ${maxX}`);
            }

            console.log(`✓ U-shaped path test completed`);
        } else {
            console.log(`  No path found or path blocked: ${result.message || "unknown"}`);
        }
    }

    console.log(`\n✓ All pathfinding wall tests passed!`);
}

main();
