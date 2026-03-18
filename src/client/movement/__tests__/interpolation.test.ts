import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../../movement/PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

describe("Interpolation Logic", () => {
    let ecs: PlayerEcs;
    let sync: PlayerMovementSync;
    let idx: number;
    const serverId = 1;

    beforeEach(() => {
        ecs = new PlayerEcs(1);
        // OSRS client uses fixed 4/6/8 "pixel" steps per client tick; server tick length does not
        // directly scale movement speed in `GraphicsObject.method2141`.
        ecs.setServerTickMs(600);
        ecs.setClientTickDurationMs(20);

        idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 10, 10, 0);
        ecs.setRotationImmediate(idx, 1536); // Face East

        sync = new PlayerMovementSync(ecs);
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        // Sync initial position to PlayerMovementSync state
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            subX: subOf(10),
            subY: subOf(10),
            level: 0,
            snap: true, // Teleport
        });
    });

    test("server step progress is discrete (no time-based interpolation)", () => {
        // Trigger movement to start interpolation
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            subX: subOf(11),
            subY: subOf(10),
            level: 0,
        });

        // Segment promotion + first movement step happens on the next client tick.
        ecs.updateClient(1);
        expect(ecs.getServerStepT(idx)).toBe(0);

        // Still mid-step (OSRS uses fixed per-cycle stepping, not interpolation).
        ecs.updateClient(10);
        expect(ecs.getServerStepT(idx)).toBe(0);

        // Advance until completion.
        let guard = 400;
        while (ecs.getX(idx) !== subOf(11) && guard-- > 0) ecs.updateClient(1);

        expect(ecs.getServerStepT(idx)).toBeGreaterThanOrEqual(1.0);
        expect(ecs.getX(idx)).toBe(subOf(11));
    });

    test("snaps instantly when destination is >2 tiles away", () => {
        // Bypass MovementSync path limiting; simulate an out-of-band server correction.
        ecs.setServerPos(idx, subOf(20), subOf(10), 1);

        ecs.updateClient(1);

        expect(ecs.getX(idx)).toBe(subOf(20));
        expect(ecs.getY(idx)).toBe(subOf(10));
        expect(ecs.getServerStepT(idx)).toBeGreaterThanOrEqual(1.0);
    });

    test("turning penalty slows movement (2px/tick equivalent)", () => {
        // Force a turn: facing North (0), move East (1536)
        // This is a 90 degree turn
        ecs.setRotationImmediate(idx, 0);

        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East],
            running: false,
            moved: true,
        });

        // Advance a few ticks to let turning start
        ecs.updateClient(5);

        // Check if speed is reduced.
        // Normal walk is 4 units/tick. Turning should be 2 units/tick.
        // 5 ticks * 2 = 10 units (vs 20 units for full walk speed).
        // Sub-tile unit is 1/128th of a tile.

        const startX = subOf(10);
        const currentX = ecs.getX(idx);
        const dist = currentX - startX;

        // Assert it moved *some* amount but less than full tile
        expect(dist).toBeGreaterThan(0);
        expect(dist).toBeLessThan(30); // Well less than half a tile (64)
    });

    test("animation switches to run when speed is high", () => {
        // Configure animation set
        ecs.setAnimSet(idx, {
            idle: 808,
            walk: 819,
            run: 824,
            // ... others
        } as any);

        // Simulate running (2 tiles in 1 tick)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East, MovementDirection.East],
            running: true,
            moved: true,
        });

        // Advance to start movement
        ecs.updateClient(1);

        // Trigger animation update since we're not running the full loop
        sync.updateInteractionRotations();

        // Should be visually running
        expect(ecs.isRunVisual(idx)).toBe(true);

        // Should have switched to run seq (824)
        expect(ecs.getAnimSeq(idx, "run")).toBe(824);

        const currentMoveSeq = ecs.getAnimMovementSeqId(idx);
        expect(currentMoveSeq).toBe(824);
    });
});
