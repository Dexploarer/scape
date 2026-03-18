import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../../movement/PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

describe("OSRS parity: movementSequence vs sequence layering", () => {
    test("movementSequence updates while an action sequence is active (when allowed)", () => {
        const ecs = new PlayerEcs(1);
        ecs.setSeqTypeLoader?.({
            load: () => ({ precedenceAnimating: 1, priority: 1 }),
        } as any);

        const serverId = 42;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 10, 10, 0);
        ecs.setRotationImmediate(idx, 1536); // face east

        ecs.setAnimSet(idx, { idle: 100, walk: 101 } as any);

        // Action `sequence` (upper body) is active and does not block movement.
        ecs.setAnimSeqId(idx, 200);
        ecs.setAnimSeqDelay(idx, 0);

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

        ecs.updateClient(1);

        // Action sequence remains set...
        expect(ecs.getAnimSeqId(idx)).toBe(200);
        // ...but movementSequence switches to walk for the step.
        expect(ecs.getAnimMovementSeqId(idx)).toBe(101);

        // Movement proceeds.
        expect(ecs.getX(idx)).toBeGreaterThan(subOf(10));
        expect(ecs.getX(idx)).toBeLessThanOrEqual(subOf(11));
    });
});
