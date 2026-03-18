import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

/**
 * U-shaped walking regression
 * Steps: West -> South -> West (all walk). This matches a tight U-turn on a 3-tile path.
 *
 * We assert two things:
 * 1) targetRot only changes when the new segment starts (no mid-segment flicker).
 * 2) At each segment boundary, the sub-tile coordinates land on the tile center (tile*128+64),
 *    never on tile edges (tile*128) — guarding against the 64px center-offset regression.
 */
describe("U-shaped walking path parity", () => {
    test("west → south → west: rotations and centers", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 777;
        const idx = ecs.allocatePlayer(serverId);

        // Start at tile (10, 10), centered
        ecs.teleport(idx, 10, 10, 0);

        const sync = new PlayerMovementSync(ecs);
        // Register in subtile (tile*128+64) world coordinates
        sync.registerEntity({
            serverId,
            ecsIndex: idx,
            tile: { x: 10, y: 10 },
            level: 0,
            subX: subOf(10),
            subY: subOf(10),
        });

        // Enqueue three walk steps: W, S, W
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.West, MovementDirection.South, MovementDirection.West],
            running: false,
            moved: true,
        });

        // Segment promotion happens on the next client tick.
        ecs.updateClient(1);
        expect(ecs.getTargetRotation(idx)).toBe(512);

        // Wait until segment 2 starts (facing South)
        let guard1 = 600;
        while (ecs.getTargetRotation(idx) !== 1024 && guard1-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getTargetRotation(idx)).toBe(1024);
        // Drive until centered at (9,10)
        let guardCenter1 = 600;
        while ((ecs.getX(idx) !== subOf(9) || ecs.getY(idx) !== subOf(10)) && guardCenter1-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(9));
        expect(ecs.getY(idx)).toBe(subOf(10));

        // Wait until segment 3 starts (facing West)
        let guard2 = 600;
        while (ecs.getTargetRotation(idx) !== 512 && guard2-- > 0) {
            ecs.updateClient(1);
        }
        // Drive until centered at (9,11)
        let guardCenter2 = 600;
        while ((ecs.getX(idx) !== subOf(9) || ecs.getY(idx) !== subOf(11)) && guardCenter2-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(9));
        expect(ecs.getY(idx)).toBe(subOf(11));

        // Finish segment 3: drive until final center (8,11)
        let guardCenter3 = 600;
        while ((ecs.getX(idx) !== subOf(8) || ecs.getY(idx) !== subOf(11)) && guardCenter3-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(8));
        expect(ecs.getY(idx)).toBe(subOf(11));
    });
});
