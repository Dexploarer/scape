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
 * Debug test for specific path: (2620, 3384, 0) to (2619, 3386, 0)
 *
 * Delta: dx = -1 (West), dy = +2 (North)
 * Possible directions: NW then N, or N then NW, or W then N then N, etc.
 */
describe("Debug path (2620,3384) to (2619,3386)", () => {
    test("walk path NW then N", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 300;
        const idx = ecs.allocatePlayer(serverId);

        const startX = 2620;
        const startY = 3384;
        const endX = 2619;
        const endY = 3386;

        ecs.teleport(idx, startX, startY, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: startX, y: startY },
            level: 0,
            subX: subOf(startX),
            subY: subOf(startY),
        });

        console.log("=== START STATE ===");
        console.log(`Start tile: (${startX}, ${startY})`);
        console.log(`Target tile: (${endX}, ${endY})`);
        console.log(`ECS position: (${tileOf(ecs.getX(idx))}, ${tileOf(ecs.getY(idx))})`);
        console.log(`ECS sub-position: (${ecs.getX(idx)}, ${ecs.getY(idx)})`);

        // Path: NW (dx=-1, dy=+1) then N (dx=0, dy=+1)
        // (2620,3384) -> (2619,3385) -> (2619,3386)
        const directions = [MovementDirection.NorthWest, MovementDirection.North];

        console.log("\n=== DIRECTIONS ===");
        let currX = startX;
        let currY = startY;
        for (let i = 0; i < directions.length; i++) {
            const dir = directions[i];
            const delta = directionToDelta(dir);
            currX += delta.dx;
            currY += delta.dy;
            console.log(
                `Step ${i + 1}: Direction ${MovementDirection[dir]} (${dir}), delta (${delta.dx}, ${
                    delta.dy
                }) -> (${currX}, ${currY})`,
            );
        }
        console.log(`Expected final tile: (${currX}, ${currY})`);

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions,
            running: false,
            moved: true,
        });

        console.log("\n=== AFTER RECEIVE UPDATE ===");
        console.log(`ECS position: (${tileOf(ecs.getX(idx))}, ${tileOf(ecs.getY(idx))})`);
        console.log(`ECS sub-position: (${ecs.getX(idx)}, ${ecs.getY(idx)})`);

        // Run client ticks and log each step
        console.log("\n=== CLIENT TICKS ===");
        let prevTileX = tileOf(ecs.getX(idx));
        let prevTileY = tileOf(ecs.getY(idx));

        for (let tick = 1; tick <= 300; tick++) {
            ecs.updateClient(1);

            const currTileX = tileOf(ecs.getX(idx));
            const currTileY = tileOf(ecs.getY(idx));

            // Log when position changes
            if (currTileX !== prevTileX || currTileY !== prevTileY) {
                console.log(
                    `Tick ${tick}: Tile changed (${prevTileX}, ${prevTileY}) -> (${currTileX}, ${currTileY})`,
                );
                prevTileX = currTileX;
                prevTileY = currTileY;
            }

            // Stop if we reached destination
            if (currTileX === endX && currTileY === endY) {
                console.log(`\n=== REACHED DESTINATION at tick ${tick} ===`);
                break;
            }
        }

        console.log("\n=== FINAL STATE ===");
        const finalTileX = tileOf(ecs.getX(idx));
        const finalTileY = tileOf(ecs.getY(idx));
        console.log(`Final tile: (${finalTileX}, ${finalTileY})`);
        console.log(`Expected tile: (${endX}, ${endY})`);
        console.log(`Match: ${finalTileX === endX && finalTileY === endY}`);

        expect(finalTileX).toBe(endX);
        expect(finalTileY).toBe(endY);
    });

    test("run path NW then N (running=true)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 301;
        const idx = ecs.allocatePlayer(serverId);

        const startX = 2620;
        const startY = 3384;
        const endX = 2619;
        const endY = 3386;

        ecs.teleport(idx, startX, startY, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: startX, y: startY },
            level: 0,
            subX: subOf(startX),
            subY: subOf(startY),
        });

        console.log("\n\n=== RUNNING TEST ===");
        console.log("=== START STATE ===");
        console.log(`Start tile: (${startX}, ${startY})`);
        console.log(`Target tile: (${endX}, ${endY})`);

        // Path: NW then N with running
        const directions = [MovementDirection.NorthWest, MovementDirection.North];

        console.log("\n=== DIRECTIONS (running=true) ===");
        let currX = startX;
        let currY = startY;
        for (let i = 0; i < directions.length; i++) {
            const dir = directions[i];
            const delta = directionToDelta(dir);
            currX += delta.dx;
            currY += delta.dy;
            console.log(
                `Step ${i + 1}: Direction ${MovementDirection[dir]} (${dir}), delta (${delta.dx}, ${
                    delta.dy
                }) -> (${currX}, ${currY})`,
            );
        }

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions,
            running: true,
            moved: true,
        });

        console.log("\n=== AFTER RECEIVE UPDATE ===");
        console.log(`ECS position: (${tileOf(ecs.getX(idx))}, ${tileOf(ecs.getY(idx))})`);

        // Run client ticks
        console.log("\n=== CLIENT TICKS ===");
        let prevTileX = tileOf(ecs.getX(idx));
        let prevTileY = tileOf(ecs.getY(idx));

        for (let tick = 1; tick <= 300; tick++) {
            ecs.updateClient(1);

            const currTileX = tileOf(ecs.getX(idx));
            const currTileY = tileOf(ecs.getY(idx));

            if (currTileX !== prevTileX || currTileY !== prevTileY) {
                console.log(
                    `Tick ${tick}: Tile changed (${prevTileX}, ${prevTileY}) -> (${currTileX}, ${currTileY})`,
                );
                prevTileX = currTileX;
                prevTileY = currTileY;
            }

            if (currTileX === endX && currTileY === endY) {
                console.log(`\n=== REACHED DESTINATION at tick ${tick} ===`);
                break;
            }
        }

        console.log("\n=== FINAL STATE ===");
        const finalTileX = tileOf(ecs.getX(idx));
        const finalTileY = tileOf(ecs.getY(idx));
        console.log(`Final tile: (${finalTileX}, ${finalTileY})`);
        console.log(`Expected tile: (${endX}, ${endY})`);
        console.log(`Match: ${finalTileX === endX && finalTileY === endY}`);

        expect(finalTileX).toBe(endX);
        expect(finalTileY).toBe(endY);
    });

    test("alternative path: W then N then N", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 302;
        const idx = ecs.allocatePlayer(serverId);

        const startX = 2620;
        const startY = 3384;
        const endX = 2619;
        const endY = 3386;

        ecs.teleport(idx, startX, startY, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: startX, y: startY },
            level: 0,
            subX: subOf(startX),
            subY: subOf(startY),
        });

        console.log("\n\n=== ALTERNATIVE PATH: W, N, N ===");

        // Path: W then N then N
        // (2620,3384) -> (2619,3384) -> (2619,3385) -> (2619,3386)
        const directions = [
            MovementDirection.West,
            MovementDirection.North,
            MovementDirection.North,
        ];

        console.log("=== DIRECTIONS ===");
        let currX = startX;
        let currY = startY;
        for (let i = 0; i < directions.length; i++) {
            const dir = directions[i];
            const delta = directionToDelta(dir);
            currX += delta.dx;
            currY += delta.dy;
            console.log(
                `Step ${i + 1}: Direction ${MovementDirection[dir]} (${dir}), delta (${delta.dx}, ${
                    delta.dy
                }) -> (${currX}, ${currY})`,
            );
        }

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions,
            running: false,
            moved: true,
        });

        // Run client ticks
        let prevTileX = tileOf(ecs.getX(idx));
        let prevTileY = tileOf(ecs.getY(idx));

        for (let tick = 1; tick <= 400; tick++) {
            ecs.updateClient(1);

            const currTileX = tileOf(ecs.getX(idx));
            const currTileY = tileOf(ecs.getY(idx));

            if (currTileX !== prevTileX || currTileY !== prevTileY) {
                console.log(
                    `Tick ${tick}: (${prevTileX}, ${prevTileY}) -> (${currTileX}, ${currTileY})`,
                );
                prevTileX = currTileX;
                prevTileY = currTileY;
            }

            if (currTileX === endX && currTileY === endY) {
                console.log(`REACHED DESTINATION at tick ${tick}`);
                break;
            }
        }

        const finalTileX = tileOf(ecs.getX(idx));
        const finalTileY = tileOf(ecs.getY(idx));
        console.log(`Final: (${finalTileX}, ${finalTileY}), Expected: (${endX}, ${endY})`);

        expect(finalTileX).toBe(endX);
        expect(finalTileY).toBe(endY);
    });
});
