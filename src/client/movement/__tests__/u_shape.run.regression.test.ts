import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

/**
 * Run-mode U-turn parity (matches provided dump):
 * Steps: West -> South -> West with running=true.
 *
 * Expectations:
 * - Run visual state engages (segment factor >= 2).
 * - Facing changes only at segment boundaries: 512 (W) → 1024 (S) → 512 (W).
 * - We land exactly on tile centers at each boundary.
 */
describe("U-shaped running path parity", () => {
    test("west → south → west: run visual + centers", () => {
        const ecs = new PlayerEcs(1);
        const serverId = 778;
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

        // Queue running steps W, S, W
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.West, MovementDirection.South, MovementDirection.West],
            running: true,
            moved: true,
        });

        // Segment promotion happens on the next client tick.
        ecs.updateClient(1);
        expect(ecs.isRunVisual(idx)).toBe(true);
        expect(ecs.getTargetRotation(idx)).toBe(512);

        // Wait until segment 2 starts (South) and centered at (9,10)
        let guard1 = 400;
        while (ecs.getTargetRotation(idx) !== 1024 && guard1-- > 0) {
            ecs.updateClient(1);
        }
        let guardCenter1 = 400;
        while ((ecs.getX(idx) !== subOf(9) || ecs.getY(idx) !== subOf(10)) && guardCenter1-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getTargetRotation(idx)).toBe(1024);
        expect(ecs.getX(idx)).toBe(subOf(9));
        expect(ecs.getY(idx)).toBe(subOf(10));

        // Wait until segment 3 starts (West) and centered at (9,11)
        let guard2 = 400;
        while (ecs.getTargetRotation(idx) !== 512 && guard2-- > 0) {
            ecs.updateClient(1);
        }
        let guardCenter2 = 400;
        while ((ecs.getX(idx) !== subOf(9) || ecs.getY(idx) !== subOf(11)) && guardCenter2-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(9));
        expect(ecs.getY(idx)).toBe(subOf(11));
        expect(ecs.getTargetRotation(idx)).toBe(512);

        // Finish segment 3: wait until centered on (8,11)
        let guardCenter3 = 400;
        while ((ecs.getX(idx) !== subOf(8) || ecs.getY(idx) !== subOf(11)) && guardCenter3-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(8));
        expect(ecs.getY(idx)).toBe(subOf(11));
    });
});
