import { PlayerEcs } from "./PlayerEcs";

describe("PlayerEcs.isMoving OSRS-authentic behavior (no artificial delay)", () => {
    test("idle immediately after final arrival with no queued steps", () => {
        const ecs = new PlayerEcs(1);
        const idx = ecs.allocatePlayer(0);
        // Simulate end of segment this tick
        (ecs as any).srvT[idx] = 1.0;
        // Small snap settle still pending
        (ecs as any).srvSnapTicks[idx] = 2;
        // No queued steps (OSRS behavior: idle immediately)
        (ecs as any).srvQueueLen[idx] = 0;
        // Position changed this tick (arrival frame)
        (ecs as any).prevX[idx] = 1000;
        (ecs as any).prevY[idx] = 1000;
        (ecs as any).x[idx] = 1010;
        (ecs as any).y[idx] = 1010;
        expect(ecs.isMoving(idx)).toBe(false);
    });

    test("moving when mid-segment (t < 1)", () => {
        const ecs = new PlayerEcs(1);
        const idx = ecs.allocatePlayer(1);
        (ecs as any).srvT[idx] = 0.5;
        (ecs as any).srvQueueLen[idx] = 0;
        expect(ecs.isMoving(idx)).toBe(true);
    });

    test("moving when queued steps exist (OSRS: no delay, immediate start)", () => {
        const ecs = new PlayerEcs(1);
        const idx = ecs.allocatePlayer(2);
        (ecs as any).srvT[idx] = 1.0;
        (ecs as any).srvQueueLen[idx] = 2;
        expect(ecs.isMoving(idx)).toBe(true);
    });

    test("moving during snap settle when chaining (queued > 0)", () => {
        const ecs = new PlayerEcs(1);
        const idx = ecs.allocatePlayer(3);
        (ecs as any).srvT[idx] = 1.0;
        (ecs as any).srvSnapTicks[idx] = 2;
        (ecs as any).srvQueueLen[idx] = 1;
        expect(ecs.isMoving(idx)).toBe(true);
    });
});
