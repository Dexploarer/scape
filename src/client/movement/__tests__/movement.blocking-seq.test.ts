import { MovementDirection } from "../../../shared/Direction";
import { PlayerEcs } from "../../ecs/PlayerEcs";
import { PlayerMovementSync } from "../../movement/PlayerMovementSync";

function subOf(tile: number): number {
    return (tile << 7) + 64;
}

describe("OSRS parity: blocking sequences pause movement", () => {
    test("action sequence with priority=0 blocks path stepping and increments field1245", () => {
        const ecs = new PlayerEcs(1);
        ecs.setSeqTypeLoader?.({
            load: () => ({ precedenceAnimating: 0, priority: 0 }),
        } as any);

        const serverId = 10;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 10, 10, 0);

        // Action sequence active (not a movement seq) with no delay.
        ecs.setAnimSeqId(idx, 123);
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

        // Queue a single step east.
        sync.receiveUpdate({
            serverId,
            ecsIndex: idx,
            level: 0,
            directions: [MovementDirection.East],
            running: false,
            moved: true,
        });

        // While blocked, the player should not move and the delay counter should accumulate.
        ecs.updateClient(1);
        expect(ecs.getX(idx)).toBe(subOf(10));
        expect(ecs.getY(idx)).toBe(subOf(10));
        expect(ecs.getMovementDelayCounter(idx)).toBe(1);
        expect(ecs.getServerStepT(idx)).toBe(0);

        ecs.updateClient(3);
        expect(ecs.getX(idx)).toBe(subOf(10));
        expect(ecs.getY(idx)).toBe(subOf(10));
        expect(ecs.getMovementDelayCounter(idx)).toBeGreaterThanOrEqual(2);

        // Clearing the action sequence allows movement to proceed.
        ecs.setAnimSeqId(idx, -1);

        let guard = 400;
        while ((ecs.getX(idx) !== subOf(11) || ecs.getY(idx) !== subOf(10)) && guard-- > 0) {
            ecs.updateClient(1);
        }
        expect(ecs.getX(idx)).toBe(subOf(11));
        expect(ecs.getY(idx)).toBe(subOf(10));
    });

    test("OSRS parity: while blocked, turning can switch movementSequence to turn-left/right", () => {
        const ecs = new PlayerEcs(1);
        ecs.setSeqTypeLoader?.({
            load: () => ({ precedenceAnimating: 0, priority: 0 }),
        } as any);

        const serverId = 11;
        const idx = ecs.allocatePlayer(serverId);
        ecs.teleport(idx, 10, 10, 0);
        ecs.setAnimSet(idx, { idle: 100, walk: 101, turnLeft: 102, turnRight: 103 });

        // Make rotation differ from desired orientation so method2449 turns.
        ecs.setRotationImmediate(idx, 0);
        ecs.setTargetRot(idx, 1024);

        // Action sequence active (not a movement seq) with no delay.
        ecs.setAnimSeqId(idx, 123);
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
        expect(ecs.getAnimMovementSeqId(idx)).toBe(103);
        expect(ecs.getRotation(idx)).not.toBe(0);
    });
});
