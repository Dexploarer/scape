import { describe, expect, test } from "bun:test";

import type { AgentScriptSpec } from "../server/src/agent";
import { BotSdkScriptController } from "../server/src/network/botsdk/BotSdkScriptController";

function createAgentPlayer() {
    return {
        id: 77,
        name: "Toon Agent",
        agent: {
            connected: true,
            identity: {
                agentId: "agent-77",
                controller: "hybrid",
            },
            actionQueue: {},
            lastHeardFrom: 0,
            lastEmittedAt: 0,
            recentEvents: [],
        },
    } as any;
}

describe("BotSdkScriptController", () => {
    test("runs action, waits for a runtime event, and completes on the next tick", () => {
        const player = createAgentPlayer();
        const events: string[] = [];
        const routerCalls: any[] = [];
        const recorderDispatches: string[] = [];
        const recorderResults: string[] = [];
        let now = 1_000;
        const script: AgentScriptSpec = {
            schemaVersion: 1,
            scriptId: "fish-loop",
            generatedBy: "llm",
            steps: [
                {
                    id: "walk",
                    kind: "action",
                    command: {
                        action: "walkTo",
                        params: { x: 3200, z: 3201, run: true },
                    },
                    nextStepId: "wait_for_xp",
                },
                {
                    id: "wait_for_xp",
                    kind: "wait",
                    events: ["skill:xpGain"],
                    nextStepId: "done",
                },
                {
                    id: "done",
                    kind: "complete",
                    outcome: "success",
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "operator stop",
                },
            },
        };
        const controller = new BotSdkScriptController({
            router: {
                dispatch(playerId, frame) {
                    routerCalls.push({ playerId, frame });
                    return { success: true, message: `dispatched ${frame.action}` };
                },
            } as any,
            recorder: {
                recordActionDispatch(_player, frame) {
                    recorderDispatches.push(frame.action);
                },
                recordActionResult(_player, frame) {
                    recorderResults.push(frame.action);
                },
            } as any,
            emitEvent: (_player, frame) => {
                events.push(frame.name);
            },
            now: () => now++,
        });

        expect(controller.install(player, script)).toEqual({
            ok: true,
            message: "installed script fish-loop",
        });

        controller.onTick(player);
        expect(routerCalls).toHaveLength(1);
        expect(routerCalls[0]).toMatchObject({
            playerId: 77,
            frame: {
                action: "walkTo",
                x: 3200,
                z: 3201,
                run: true,
                correlationId: expect.stringContaining("script-run:77:"),
            },
        });
        expect(player.agent.script?.currentStepId).toBe("wait_for_xp");

        controller.onTick(player);
        expect(player.agent.script?.status).toBe("waiting");
        expect(player.agent.script?.waitingForEvents).toEqual(["skill:xpGain"]);

        controller.onRuntimeEvent(player, {
            kind: "event",
            name: "skill:xpGain",
            timestamp: 2_000,
            payload: { skillId: 10, xpGained: 30 },
        });
        expect(player.agent.script?.status).toBe("running");
        expect(player.agent.script?.currentStepId).toBe("done");

        controller.onTick(player);
        expect(player.agent.script).toBeUndefined();
        expect(recorderDispatches).toEqual(["walkTo"]);
        expect(recorderResults).toEqual(["walkTo"]);
        expect(events).toEqual([
            "script:installed",
            "script:step",
            "script:waiting",
            "script:wake",
            "script:completed",
        ]);
    });

    test("maps operator keywords onto typed script interrupts", () => {
        const player = createAgentPlayer();
        const events: string[] = [];
        const controller = new BotSdkScriptController({
            router: {
                dispatch() {
                    return { success: true, message: "ok" };
                },
            } as any,
            emitEvent: (_player, frame) => {
                events.push(frame.name);
            },
        });

        controller.install(player, {
            schemaVersion: 1,
            scriptId: "long-runner",
            generatedBy: "operator",
            steps: [
                {
                    id: "wait_forever",
                    kind: "wait",
                    events: ["*"],
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "halt requested",
                },
            },
        });

        controller.onOperatorCommand(player, {
            source: "chat",
            text: "stop right now",
        });

        expect(player.agent.script).toBeUndefined();
        expect(events).toEqual([
            "script:installed",
            "script:cleared",
            "script:interrupted",
        ]);
    });
});
