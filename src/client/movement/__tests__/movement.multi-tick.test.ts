import { MovementDirection, directionToDelta } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

function tileOf(sub: number): number {
    return sub >> 7;
}

/**
 * Tests simulating multiple server ticks on a longer path.
 * This mimics what happens when a player clicks a distant destination.
 */
describe("Multi-tick path simulation", () => {
    test("long L-shaped walk path (5 ticks)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 400;
        const idx = ecs.allocatePlayer(serverId);

        // Start at (10, 10)
        ecs.teleport(idx, 10, 10, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        console.log("=== MULTI-TICK L-SHAPED WALK ===");
        console.log("Path: (10,10) → (10,13) → (13,13)");
        console.log("Directions per tick: N, N, N, E, E, E");

        // Simulate 6 server ticks, each with 1 walk direction
        const tickDirections = [
            [MovementDirection.North], // Tick 1: (10,10) → (10,11)
            [MovementDirection.North], // Tick 2: (10,11) → (10,12)
            [MovementDirection.North], // Tick 3: (10,12) → (10,13)
            [MovementDirection.East], // Tick 4: (10,13) → (11,13)
            [MovementDirection.East], // Tick 5: (11,13) → (12,13)
            [MovementDirection.East], // Tick 6: (12,13) → (13,13)
        ];

        let expectedX = 10;
        let expectedY = 10;

        for (let tick = 0; tick < tickDirections.length; tick++) {
            const dirs = tickDirections[tick];

            // Calculate expected position after this tick
            for (const dir of dirs) {
                const delta = directionToDelta(dir);
                expectedX += delta.dx;
                expectedY += delta.dy;
            }

            console.log(`\n--- Server Tick ${tick + 1} ---`);
            console.log(`Sending: ${dirs.map((d) => MovementDirection[d]).join(", ")}`);
            console.log(`Expected tile after tick: (${expectedX}, ${expectedY})`);

            sync.receiveUpdate({
                serverId,
                ecsIndex: idx,
                level: 0,
                directions: dirs,
                running: false,
                moved: true,
            });

            // Run client ticks until this step is processed (simulate ~30 client ticks per server tick)
            for (let ct = 0; ct < 35; ct++) {
                ecs.updateClient(1);
            }

            const actualX = tileOf(ecs.getX(idx));
            const actualY = tileOf(ecs.getY(idx));
            console.log(`Actual tile: (${actualX}, ${actualY})`);

            if (actualX !== expectedX || actualY !== expectedY) {
                console.log(
                    `!!! DESYNC at tick ${
                        tick + 1
                    }: expected (${expectedX}, ${expectedY}), got (${actualX}, ${actualY})`,
                );
            }
        }

        // Final check
        const finalX = tileOf(ecs.getX(idx));
        const finalY = tileOf(ecs.getY(idx));
        console.log(`\n=== FINAL ===`);
        console.log(`Final tile: (${finalX}, ${finalY})`);
        console.log(`Expected: (13, 13)`);

        expect(finalX).toBe(13);
        expect(finalY).toBe(13);
    });

    test("long L-shaped run path (3 ticks)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 401;
        const idx = ecs.allocatePlayer(serverId);

        ecs.teleport(idx, 10, 10, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        console.log("\n\n=== MULTI-TICK L-SHAPED RUN ===");
        console.log("Path: (10,10) → (10,14) → (14,14)");
        console.log("Run directions per tick (2 tiles each):");

        // Simulate 4 server ticks, each with 2 run directions
        const tickDirections = [
            [MovementDirection.North, MovementDirection.North], // Tick 1: (10,10) → (10,12)
            [MovementDirection.North, MovementDirection.North], // Tick 2: (10,12) → (10,14)
            [MovementDirection.East, MovementDirection.East], // Tick 3: (10,14) → (12,14)
            [MovementDirection.East, MovementDirection.East], // Tick 4: (12,14) → (14,14)
        ];

        let expectedX = 10;
        let expectedY = 10;

        for (let tick = 0; tick < tickDirections.length; tick++) {
            const dirs = tickDirections[tick];

            for (const dir of dirs) {
                const delta = directionToDelta(dir);
                expectedX += delta.dx;
                expectedY += delta.dy;
            }

            console.log(`\n--- Server Tick ${tick + 1} ---`);
            console.log(`Sending: ${dirs.map((d) => MovementDirection[d]).join(", ")}`);
            console.log(`Expected tile after tick: (${expectedX}, ${expectedY})`);

            sync.receiveUpdate({
                serverId,
                ecsIndex: idx,
                level: 0,
                directions: dirs,
                running: true,
                moved: true,
            });

            for (let ct = 0; ct < 40; ct++) {
                ecs.updateClient(1);
            }

            const actualX = tileOf(ecs.getX(idx));
            const actualY = tileOf(ecs.getY(idx));
            console.log(`Actual tile: (${actualX}, ${actualY})`);

            if (actualX !== expectedX || actualY !== expectedY) {
                console.log(
                    `!!! DESYNC at tick ${
                        tick + 1
                    }: expected (${expectedX}, ${expectedY}), got (${actualX}, ${actualY})`,
                );
            }
        }

        const finalX = tileOf(ecs.getX(idx));
        const finalY = tileOf(ecs.getY(idx));
        console.log(`\n=== FINAL ===`);
        console.log(`Final tile: (${finalX}, ${finalY})`);
        console.log(`Expected: (14, 14)`);

        expect(finalX).toBe(14);
        expect(finalY).toBe(14);
    });

    test("run path with turn mid-stream (NE then E)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 402;
        const idx = ecs.allocatePlayer(serverId);

        ecs.teleport(idx, 10, 10, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        console.log("\n\n=== RUN PATH WITH TURN ===");
        console.log("Tick 1: NE + NE (diagonal run)");
        console.log("Tick 2: E + E (cardinal run after turn)");

        // Tick 1: NE + NE = (10,10) → (11,11) → (12,12)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.NorthEast, MovementDirection.NorthEast],
            running: true,
            moved: true,
        });

        for (let ct = 0; ct < 40; ct++) {
            ecs.updateClient(1);
        }

        let actualX = tileOf(ecs.getX(idx));
        let actualY = tileOf(ecs.getY(idx));
        console.log(`After tick 1: (${actualX}, ${actualY}), expected: (12, 12)`);
        expect(actualX).toBe(12);
        expect(actualY).toBe(12);

        // Tick 2: E + E = (12,12) → (13,12) → (14,12)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East, MovementDirection.East],
            running: true,
            moved: true,
        });

        for (let ct = 0; ct < 40; ct++) {
            ecs.updateClient(1);
        }

        actualX = tileOf(ecs.getX(idx));
        actualY = tileOf(ecs.getY(idx));
        console.log(`After tick 2: (${actualX}, ${actualY}), expected: (14, 12)`);

        expect(actualX).toBe(14);
        expect(actualY).toBe(12);
    });

    test("diagonal into cardinal turn on same tick (NW then N)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 403;
        const idx = ecs.allocatePlayer(serverId);

        // Mimics the user's exact case: (2620, 3384) to (2619, 3386)
        ecs.teleport(idx, 2620, 3384, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 2620, y: 3384 },
            level: 0,
            subX: subOf(2620),
            subY: subOf(3384),
        });

        console.log("\n\n=== USER'S EXACT CASE ===");
        console.log("Start: (2620, 3384)");
        console.log("End: (2619, 3386)");
        console.log("This is a 2-tile run: NW + N");

        // NW + N = (-1,+1) + (0,+1) = (-1, +2)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.NorthWest, MovementDirection.North],
            running: true,
            moved: true,
        });

        for (let ct = 0; ct < 60; ct++) {
            ecs.updateClient(1);
        }

        const actualX = tileOf(ecs.getX(idx));
        const actualY = tileOf(ecs.getY(idx));
        console.log(`Final: (${actualX}, ${actualY}), expected: (2619, 3386)`);

        expect(actualX).toBe(2619);
        expect(actualY).toBe(3386);
    });
});
