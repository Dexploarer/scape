import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

/**
 * Position desync regression tests.
 *
 * These tests verify that position tracking works correctly on long paths
 * with direction changes (turns). The bug was that `fromTile` was not being
 * updated after a position correction, causing run compression and path
 * building to use stale values.
 */
describe("Position tracking on long paths with turns", () => {
    test("diagonal then cardinal: position reaches correct destination", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 200;
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

        // Walk diagonally NE then straight East
        // Path: (10,10) -> (11,11) -> (12,11)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.NorthEast, MovementDirection.East],
            running: false,
            moved: true,
        });

        // Run until we reach the destination
        let guard = 600;
        while ((ecs.getX(idx) !== subOf(12) || ecs.getY(idx) !== subOf(11)) && guard-- > 0) {
            ecs.updateClient(1);
        }

        expect(ecs.getX(idx)).toBe(subOf(12));
        expect(ecs.getY(idx)).toBe(subOf(11));
    });

    test("multi-turn path: reaches correct final position", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 201;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 5, 5, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 5, y: 5 },
            level: 0,
            subX: subOf(5),
            subY: subOf(5),
        });

        // L-shaped path: North, North, East, East
        // Path: (5,5) -> (5,6) -> (5,7) -> (6,7) -> (7,7)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [
                MovementDirection.North,
                MovementDirection.North,
                MovementDirection.East,
                MovementDirection.East,
            ],
            running: false,
            moved: true,
        });

        // Run until we reach the destination
        let guard = 800;
        while ((ecs.getX(idx) !== subOf(7) || ecs.getY(idx) !== subOf(7)) && guard-- > 0) {
            ecs.updateClient(1);
        }

        expect(ecs.getX(idx)).toBe(subOf(7));
        expect(ecs.getY(idx)).toBe(subOf(7));
    });

    test("running L-shape: position reaches correct destination", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 202;
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

        // Running L-shape: East, East, South, South
        // With running=true, server sends 2 directions per tick
        // Path: (10,10) -> (11,10) -> (12,10) -> (12,9) -> (12,8)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [
                MovementDirection.East,
                MovementDirection.East,
                MovementDirection.South,
                MovementDirection.South,
            ],
            running: true,
            moved: true,
        });

        // Run until we reach the destination
        let guard = 600;
        while ((ecs.getX(idx) !== subOf(12) || ecs.getY(idx) !== subOf(8)) && guard-- > 0) {
            ecs.updateClient(1);
        }

        expect(ecs.getX(idx)).toBe(subOf(12));
        expect(ecs.getY(idx)).toBe(subOf(8));
    });

    test("zigzag path: reaches correct destination", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 203;
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

        // Zigzag: NE, E, SE, E, NE
        // Path: (10,10) -> (11,11) -> (12,11) -> (13,10) -> (14,10) -> (15,11)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [
                MovementDirection.NorthEast,
                MovementDirection.East,
                MovementDirection.SouthEast,
                MovementDirection.East,
                MovementDirection.NorthEast,
            ],
            running: false,
            moved: true,
        });

        // Run until we reach the destination
        let guard = 1000;
        while ((ecs.getX(idx) !== subOf(15) || ecs.getY(idx) !== subOf(11)) && guard-- > 0) {
            ecs.updateClient(1);
        }

        expect(ecs.getX(idx)).toBe(subOf(15));
        expect(ecs.getY(idx)).toBe(subOf(11));
    });

    test("position correction uses teleport/snap (OSRS resetPath)", () => {
        // OSRS does not “rebase” direction streams client-side when positions disagree.
        // Corrections are delivered as resetPath-style snaps (teleport moveType=3).
        const ecs = new PlayerEcs(1);
        const serverId = 204;
        const idx = ecs.allocatePlayer(serverId);

        // Client thinks player is at (10, 10)
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

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            running: false,
            moved: true,
            snap: true,
            x: subOf(8),
            y: subOf(8),
        });

        // Run until we reach the destination
        let guard = 600;
        while ((ecs.getX(idx) !== subOf(8) || ecs.getY(idx) !== subOf(8)) && guard-- > 0) {
            ecs.updateClient(1);
        }

        expect(ecs.getX(idx)).toBe(subOf(8));
        expect(ecs.getY(idx)).toBe(subOf(8));
    });
});
