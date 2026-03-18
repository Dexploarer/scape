import assert from "assert";

import { NpcState } from "../src/game/npc";
import { PlayerManager } from "../src/game/player";
import { RectAdjacentRouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";

type QueueReadableActor = {
    getPathQueue?: () => Array<{ x: number; y: number }>;
    queue?: Array<{ x: number; y: number }>;
};

class StubPathService {
    responses: Array<{
        ok: boolean;
        steps?: { x: number; y: number }[];
        end?: { x: number; y: number };
    }> = [];
    calls: Array<{
        req: {
            from: { x: number; y: number; plane: number };
            to: { x: number; y: number };
            size?: number;
        };
        strategy: any;
    }> = [];

    enqueue(resp: {
        ok: boolean;
        steps?: { x: number; y: number }[];
        end?: { x: number; y: number };
    }) {
        this.responses.push(resp);
    }

    findPathSteps(
        req: {
            from: { x: number; y: number; plane: number };
            to: { x: number; y: number };
            size?: number;
        },
        strategy?: any,
    ) {
        this.calls.push({ req, strategy });
        if (this.responses.length > 0) {
            return this.responses.shift()!;
        }
        const dx = Math.sign(req.to.x - req.from.x);
        const dy = Math.sign(req.to.y - req.from.y);
        const steps: { x: number; y: number }[] = [];
        if (dx !== 0 || dy !== 0) {
            steps.push({ x: req.from.x + dx, y: req.from.y + dy });
        }
        return { ok: true, steps, end: steps[steps.length - 1] };
    }

    findPath(
        req: {
            from: { x: number; y: number; plane: number };
            to: { x: number; y: number };
            size?: number;
        },
        strategy?: any,
    ) {
        return this.findPathSteps(req, strategy);
    }
}

function assertRectStrategyCalls(calls: StubPathService["calls"]): void {
    for (const call of calls) {
        assert.ok(
            call.strategy instanceof RectAdjacentRouteStrategy,
            "Expected RectAdjacentRouteStrategy for chase path",
        );
    }
}

function cloneQueue(actor: QueueReadableActor | null | undefined): { x: number; y: number }[] {
    if (actor?.getPathQueue) {
        return actor.getPathQueue();
    }
    const queue: { x: number; y: number }[] | undefined = actor?.queue;
    if (!Array.isArray(queue)) return [];
    return queue.map((s) => ({ x: s.x, y: s.y }));
}

function runAdjacentSidestepParityTest() {
    const path = new StubPathService();
    const pm = new PlayerManager(path as any);
    const ws: any = { id: "adjacent" };
    const player = pm.add(ws, 100, 100, 0);
    player.setVarbitValue(10037, 12);
    const npc = new NpcState(1, 1, 1, -1, -1, 32, { x: 101, y: 100, level: 0 });

    const playerRouted = (pm as any).routePlayerToNpc(player, npc);
    const playerQueue = cloneQueue(player as any);
    assert.strictEqual(playerRouted, true, "Player should already satisfy adjacent melee reach");
    assert.deepStrictEqual(playerQueue, [], "Player should not move when already adjacent");

    const npcRouted = (pm as any).routeNpcToPlayer(npc, player);
    const npcQueue = cloneQueue(npc as any);
    assert.strictEqual(npcRouted, true, "NPC should also treat adjacent melee reach as satisfied");
    assert.deepStrictEqual(npcQueue, [], "NPC should not move when already adjacent");

    assert.strictEqual(
        path.calls.length,
        0,
        "No pathfinding call should be needed for adjacent melee reach",
    );
}

function runDoorEntryParityTest() {
    const path = new StubPathService();
    const pm = new PlayerManager(path as any);
    const ws: any = { id: "door" };
    const player = pm.add(ws, 200, 200, 0);
    player.setVarbitValue(10037, 12);
    const npc = new NpcState(2, 1, 1, -1, -1, 32, { x: 200, y: 203, level: 0 });

    const multiStep = [
        { x: 200, y: 201 },
        { x: 200, y: 202 },
        { x: 200, y: 203 },
    ];
    path.enqueue({ ok: true, steps: multiStep });
    path.enqueue({ ok: true, steps: multiStep.slice().reverse() });

    (pm as any).routePlayerToNpc(player, npc);
    const playerQueue = cloneQueue(player as any);
    assert.deepStrictEqual(playerQueue, multiStep, "Player door path should follow queued steps");

    (pm as any).routeNpcToPlayer(npc, player);
    const npcQueue = cloneQueue(npc as any);
    assert.deepStrictEqual(
        npcQueue,
        multiStep.slice().reverse(),
        "NPC door path should mirror player path back through doorway",
    );

    assertRectStrategyCalls(path.calls);
}

function main() {
    runAdjacentSidestepParityTest();
    runDoorEntryParityTest();
    // eslint-disable-next-line no-console
    console.log("Interaction movement parity tests passed.");
}

main();
