import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

/**
 * Verify that facing (targetRot) only switches at segment boundaries.
 * Repro path: two-step run – first South, then East.
 * Expected: targetRot stays South (1024) through the first segment and
 * switches to East (1536) only when the second segment starts.
 */
describe("Facing updates only at segment boundaries", () => {
    test("two-step run: S then E", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 100;
        const idx = ecs.allocatePlayer(serverId);
        // Start at (0,0)
        ecs.teleport(idx, 0, 0, 0);

        const sync = new PlayerMovementSync(ecs);
        // Register entity with subtile (tile*128+64) world coordinates
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 0, y: 0 },
            level: 0,
            subX: subOf(0),
            subY: subOf(0),
        });

        // Receive two directions in one update: South then East; flagged as running (factor=2)
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.South, MovementDirection.East],
            running: true,
            moved: true,
        });

        // Segment promotion happens on the next client tick.
        ecs.updateClient(1);
        expect(ecs.getTargetRotation(idx)).toBe(1024);

        // Advance until rotation switches to East (segment 2 start)
        let guard = 200;
        while (ecs.getTargetRotation(idx) !== 1536 && guard-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getTargetRotation(idx)).toBe(1536);
    });
});
