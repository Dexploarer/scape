import assert from "assert";

import { WSServer } from "../src/network/wsServer";

async function testScriptsRunBeforeCombat(): Promise<void> {
    const server: any = Object.create(WSServer.prototype);

    const stageOrder: string[] = [];
    const scriptCalls: Array<{ phase: string; tick: number }> = [];
    server.options = { tickMs: 600 };
    server.createTickFrame = (data: { tick: number; time: number }) => ({
        tick: data.tick,
        time: data.time,
    });
    server.broadcastTick = () => {};
    server.runPreMovementPhase = () => {};
    server.runMovementPhase = () => {};
    server.runPostEffectsPhase = () => {};
    server.runBroadcastPhase = () => {};
    server.maybeRunAutosave = () => {};
    server.yieldToEventLoop = async () => {};
    server.scriptRuntime = {
        queueTick: (tick: number) => {
            scriptCalls.push({ phase: "runtime", tick });
        },
    };
    server.scriptScheduler = {
        process: (tick: number) => {
            scriptCalls.push({ phase: "scheduler", tick });
        },
    };
    server.runTickStage = async function (
        name: string,
        fn: () => void | Promise<void>,
        frame: any,
    ) {
        stageOrder.push(name);
        await fn();
        return true;
    };
    server.runCombatPhase = (frame: { tick: number }) => {
        assert.deepStrictEqual(
            scriptCalls,
            [
                { phase: "runtime", tick: frame.tick },
                { phase: "scheduler", tick: frame.tick },
            ],
            "script runtime and scheduler should run before combat phase",
        );
    };

    await (server as any).handleTick({ tick: 128, time: Date.now() });

    assert.deepStrictEqual(stageOrder, [
        "broadcast",
        "pre_movement",
        "movement",
        "scripts",
        "combat",
        "post_effects",
        "broadcast_phase",
    ]);
}

async function main(): Promise<void> {
    await testScriptsRunBeforeCombat();
    console.log("\n✓ Script stage runs before combat and shares the same tick");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
