import { encodeInteractionIndex } from "../../../rs/interaction/InteractionIndex";
import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { buildMovementPath } from "../../movement/MovementPath";
import { PlayerMovementSync } from "../../movement/PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

describe("MovementPath", () => {
    test("builds diagonal steps and marks run when chebyshev >= 2", () => {
        const path = buildMovementPath(
            { x: 10, y: 10 },
            { x: 12, y: 11 },
            {
                running: true,
                maxStepDistance: 2,
            },
        );
        expect(path.stepCount).toBe(2);
        expect(path.steps[0].tile).toEqual({ x: 11, y: 11 });
        expect(path.steps[1].tile).toEqual({ x: 12, y: 11 });
        expect(path.run).toBe(true);
        expect(path.isTeleport).toBe(false);
    });
});

describe("PlayerMovementSync ↔ PlayerEcs integration", () => {
    test("single-tile step (walk) advances to next tile", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 1;
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

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East],
            running: false,
            moved: true,
        });

        // Advance until we reach the next tile center robustly
        let guard = 400;
        while ((ecs.getX(idx) !== subOf(11) || ecs.getY(idx) !== subOf(10)) && guard-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(11));
        expect(ecs.getY(idx)).toBe(subOf(10));
        expect(ecs.getServerStepT(idx)).toBeGreaterThan(0.99);
    });

    test("snap=true teleports immediately to target and clears interpolation", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 2;
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

        const dest = { x: 8, y: 3 };
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            subX: subOf(dest.x),
            subY: subOf(dest.y),
            snap: true,
            moved: true,
        });

        // No need to tick; teleport is instant
        expect(ecs.getX(idx)).toBe(subOf(dest.x));
        expect(ecs.getY(idx)).toBe(subOf(dest.y));
        expect(ecs.getServerStepT(idx)).toBe(1);
    });

    test("two-step batch marks run visually via segment factor", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 3;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 0, 0, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 0, y: 0 },
            level: 0,
            subX: subOf(0),
            subY: subOf(0),
        });

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East, MovementDirection.East],
            running: false,
            traversals: [2, 2],
            moved: true,
        });

        // Segment promotion happens on the next client tick.
        ecs.updateClient(1);
        expect(ecs.isRunVisual(idx)).toBe(true);
    });

    test("server steps start immediately (no pre-turn delay)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 4;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 0, 0, 0);
        ecs.setRotationImmediate(idx, 0);

        ecs.setServerPos(idx, subOf(1), subOf(1), 1);
        // Promotion + movement occurs in the same client tick.
        ecs.updateClient(1);
        expect(ecs.getServerStepT(idx)).toBeLessThan(1);

        ecs.setInteractionIndex(idx, encodeInteractionIndex("npc", 1));
        ecs.setServerPos(idx, subOf(2), subOf(2), 1);
        ecs.updateClient(1);
        expect(ecs.getServerStepT(idx)).toBeLessThan(1);
    });

    test("OSRS parity: far step snaps and keeps movementSequence idle", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 5;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 0, 0, 0);
        ecs.setAnimSet(idx, { idle: 100, walk: 101, run: 102 });

        ecs.setServerPos(idx, subOf(20), subOf(0), 1);
        ecs.updateClient(1);

        expect(ecs.getX(idx)).toBe(subOf(20));
        expect(ecs.getY(idx)).toBe(subOf(0));
        expect(ecs.getAnimMovementSeqId(idx)).toBe(100);
    });

    test("OSRS parity: pathLength uses queued steps immediately (no hysteresis)", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 6;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 0, 0, 0);
        ecs.setAnimSet(idx, { idle: 200, walk: 201, run: 202 });

        // Start with a single step so pathLength == 1 -> walk speed.
        ecs.setServerPos(idx, subOf(1), subOf(0), 1);
        ecs.updateClient(1);
        expect(ecs.getAnimMovementSeqId(idx)).toBe(201);

        // While still mid-step, enqueue more steps; OSRS bumps speed based on total pathLength.
        ecs.setServerPos(idx, subOf(2), subOf(0), 1);
        ecs.setServerPos(idx, subOf(3), subOf(0), 1);
        ecs.setServerPos(idx, subOf(4), subOf(0), 1);
        ecs.setServerPos(idx, subOf(5), subOf(0), 1);

        ecs.updateClient(1);
        expect(ecs.getAnimMovementSeqId(idx)).toBe(202);
    });

    test("OSRS parity: faceDir is deferred until idle, then applied once", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 7;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 10, 10, 0);
        ecs.setAnimSet(idx, { idle: 300, walk: 301 });
        ecs.setRotationImmediate(idx, 0);

        const sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        // Start moving east.
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East],
            running: false,
            moved: true,
        });
        ecs.updateClient(1);

        // Face north; should not override movement-facing while moving.
        ecs.setFaceDir(idx, 1024);
        ecs.updateClient(1);
        expect(ecs.getTargetRotation(idx)).toBe(1536);

        // Let movement complete; once idle, PendingSpawn.method2449 applies faceDir and clears it.
        let guard = 400;
        while ((ecs.getX(idx) !== subOf(11) || ecs.getY(idx) !== subOf(10)) && guard-- > 0) {
            ecs.updateClient(1);
        }
        ecs.updateClient(1);
        expect(ecs.getTargetRotation(idx)).toBe(1024);
    });
});
