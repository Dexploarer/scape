import { describe, expect, test } from "bun:test";
import { decode, encode } from "@toon-format/toon";

import type { AgentScriptSpec } from "../server/src/agent";
import { BotSdkServer } from "../server/src/network/botsdk/BotSdkServer";

function createAgentPlayer(overrides?: Partial<any>) {
    return {
        id: 88,
        name: "Ralph",
        tileX: 3200,
        tileY: 3201,
        level: 12,
        agent: {
            connected: true,
            identity: {
                agentId: "agent-88",
                controller: "hybrid",
            },
            actionQueue: {},
            lastHeardFrom: 0,
            lastEmittedAt: 0,
            recentEvents: [],
        },
        ...overrides,
    } as any;
}

function createSocket() {
    const frames: any[] = [];
    return {
        frames,
        ws: {
            readyState: 1,
            send(payload: string) {
                frames.push(decode(payload));
            },
            close() {},
            on() {},
        } as any,
    };
}

describe("BotSdkServer script routing", () => {
    test("records explicit script proposals, snapshots them, and approves installation", async () => {
        const player = createAgentPlayer({
            __principalId: "principal:agent-88",
            __worldCharacterId: "char-88",
        });
        const { ws, frames } = createSocket();
        const liveEvents: Array<{ event_name: string; payload_json: string }> = [];
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
            },
            {
                factory: {} as any,
                router: {
                    dispatch() {
                        return { success: true, message: "ok" };
                    },
                } as any,
                recorder: {
                    recordRuntimeEvent() {},
                    recordOperatorCommand() {},
                    recordActionDispatch() {},
                    recordActionResult() {},
                    recordDisconnect() {},
                    recordSpawn() {},
                    dispose() {},
                } as any,
                controlPlane: {
                    putLiveEvent(payload) {
                        liveEvents.push(payload as any);
                        return Promise.resolve();
                    },
                } as any,
                worldId: "scape",
                playerPersistence: {
                    saveSnapshot() {},
                } as any,
                hookTicker() {},
            },
        );
        const state = {
            authed: true,
            session: {
                ws,
                player,
                authedAt: 0,
                saveKey: "world:test:character:88",
            },
        };
        const script: AgentScriptSpec = {
            schemaVersion: 1,
            scriptId: "self-authored-loop",
            generatedBy: "llm",
            goal: "Wait for the next local XP gain.",
            steps: [
                {
                    id: "wait",
                    kind: "wait",
                    events: ["skill:xpGain"],
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "stop requested",
                },
            },
        };

        (server as any).sessions.set(ws, state.session);
        (server as any).handleMessage(
            ws,
            state,
            encode({
                kind: "proposal",
                proposalId: "proposal-1",
                correlationId: "proposal-ack",
                summary: "Try this loop next.",
                script,
            }),
        );
        await (server as any).journalWriteChain;

        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:proposalQueued",
            }),
            {
                kind: "ack",
                correlationId: "proposal-ack",
                success: true,
                message: "queued proposal self-authored-loop",
            },
        ]);
        expect(server.getJournalSnapshot()).toMatchObject({
            proposals: [
                expect.objectContaining({
                    proposalId: "proposal-1",
                    playerId: 88,
                    script: expect.objectContaining({ scriptId: "self-authored-loop" }),
                }),
            ],
        });

        frames.length = 0;
        expect(server.decideScriptProposal("proposal-1", "approve_install")).toEqual({
            ok: true,
            message: "Approved and installed proposal self-authored-loop.",
            proposal: expect.objectContaining({
                proposalId: "proposal-1",
            }),
        });
        expect(player.agent.script?.spec.scriptId).toBe("self-authored-loop");
        expect(server.getJournalSnapshot().proposals).toEqual([]);
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:installed",
            }),
            {
                kind: "proposalDecision",
                proposalId: "proposal-1",
                decision: "approved",
                installed: true,
                message: "installed script self-authored-loop",
            },
        ]);
        await (server as any).journalWriteChain;
        expect(liveEvents.map((entry) => entry.event_name)).toEqual([
            "journal:scriptProposal",
            "journal:scriptProposalDecision",
        ]);
    });

    test("installs TOON scripts, ticks them, and emits runtime events in order", () => {
        const player = createAgentPlayer();
        const { ws, frames } = createSocket();
        const routerCalls: any[] = [];
        const runtimeEvents: string[] = [];
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
            },
            {
                factory: {} as any,
                router: {
                    dispatch(playerId, frame) {
                        routerCalls.push({ playerId, frame });
                        return { success: true, message: `handled ${frame.action}` };
                    },
                } as any,
                recorder: {
                    recordRuntimeEvent(_player, frame) {
                        runtimeEvents.push(frame.name);
                    },
                    recordOperatorCommand() {},
                    recordActionDispatch() {},
                    recordActionResult() {},
                    recordDisconnect() {},
                    recordSpawn() {},
                    dispose() {},
                } as any,
                playerPersistence: {
                    saveSnapshot() {},
                } as any,
                hookTicker() {},
            },
        );
        const state = {
            authed: true,
            session: {
                ws,
                player,
                authedAt: 0,
                saveKey: "world:test:character:88",
            },
        };
        const script: AgentScriptSpec = {
            schemaVersion: 1,
            scriptId: "say-hi",
            generatedBy: "llm",
            steps: [
                {
                    id: "hello",
                    kind: "action",
                    command: {
                        action: "chatPublic",
                        params: { text: "hi" },
                    },
                    nextStepId: "wait_for_event",
                },
                {
                    id: "wait_for_event",
                    kind: "wait",
                    events: ["skill:levelUp"],
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
                    message: "stop requested",
                },
            },
        };

        (server as any).sessions.set(ws, state.session);
        (server as any).handleMessage(
            ws,
            state,
            encode({
                kind: "script",
                operation: "install",
                correlationId: "script-1",
                script,
            }),
        );

        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:installed",
            }),
            {
                kind: "ack",
                correlationId: "script-1",
                success: true,
                message: "installed script say-hi",
            },
        ]);

        frames.length = 0;
        (server as any).handleTick(1);
        expect(routerCalls).toHaveLength(1);
        expect(routerCalls[0]).toMatchObject({
            playerId: 88,
            frame: {
                kind: "action",
                action: "chatPublic",
                text: "hi",
            },
        });
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:step",
            }),
            expect.objectContaining({
                kind: "event",
                name: "script:waiting",
            }),
        ]);

        frames.length = 0;
        (server as any).handleRuntimeEvent(player, {
            kind: "event",
            name: "skill:levelUp",
            timestamp: 123,
            payload: { skillId: 7, oldLevel: 9, newLevel: 10 },
        });
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "skill:levelUp",
            }),
            expect.objectContaining({
                kind: "event",
                name: "script:wake",
            }),
        ]);

        frames.length = 0;
        (server as any).handleTick(2);
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:completed",
            }),
        ]);
        expect(runtimeEvents).toEqual([
            "script:installed",
            "script:step",
            "script:waiting",
            "skill:levelUp",
            "script:wake",
            "script:completed",
        ]);
    });

    test("broadcast operator commands interrupt active scripts", () => {
        const player = createAgentPlayer();
        const { ws, frames } = createSocket();
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
            },
            {
                factory: {} as any,
                router: {
                    dispatch() {
                        return { success: true, message: "ok" };
                    },
                } as any,
                recorder: {
                    recordRuntimeEvent() {},
                    recordOperatorCommand() {},
                    recordActionDispatch() {},
                    recordActionResult() {},
                    recordDisconnect() {},
                    recordSpawn() {},
                    dispose() {},
                } as any,
                playerPersistence: {
                    saveSnapshot() {},
                } as any,
                hookTicker() {},
            },
        );
        const state = {
            authed: true,
            session: {
                ws,
                player,
                authedAt: 0,
                saveKey: "world:test:character:88",
            },
        };

        (server as any).sessions.set(ws, state.session);
        (server as any).wss = {};
        (server as any).handleMessage(
            ws,
            state,
            encode({
                kind: "script",
                operation: "install",
                script: {
                    schemaVersion: 1,
                    scriptId: "wait-forever",
                    generatedBy: "operator",
                    steps: [
                        {
                            id: "wait",
                            kind: "wait",
                            events: ["combat:levelUp"],
                        },
                    ],
                    interrupts: {
                        INTERRUPT_STOP: {
                            policy: "abort",
                            message: "operator stop",
                        },
                    },
                },
            }),
        );

        frames.length = 0;
        expect(server.broadcastOperatorCommand("chat", "stop now")).toBe(1);
        expect(player.agent.script).toBeUndefined();
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "operatorCommand",
                text: "stop now",
            }),
            expect.objectContaining({
                kind: "event",
                name: "script:cleared",
            }),
            expect.objectContaining({
                kind: "event",
                name: "script:interrupted",
            }),
        ]);
    });

    test("broadcast script controls install, clear, and interrupt scripts across connected agents", () => {
        const player = createAgentPlayer();
        const { ws, frames } = createSocket();
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
            },
            {
                factory: {} as any,
                router: {
                    dispatch() {
                        return { success: true, message: "ok" };
                    },
                } as any,
                recorder: {
                    recordRuntimeEvent() {},
                    recordOperatorCommand() {},
                    recordActionDispatch() {},
                    recordActionResult() {},
                    recordDisconnect() {},
                    recordSpawn() {},
                    dispose() {},
                } as any,
                playerPersistence: {
                    saveSnapshot() {},
                } as any,
                hookTicker() {},
            },
        );

        (server as any).sessions.set(ws, {
            ws,
            player,
            authedAt: 0,
            saveKey: "world:test:character:88",
        });

        const install = server.broadcastInstallScript({
            schemaVersion: 1,
            scriptId: "xp-watch",
            generatedBy: "operator",
            steps: [
                {
                    id: "wait",
                    kind: "wait",
                    events: ["skill:xpGain"],
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "operator stop",
                },
            },
        });
        expect(install).toMatchObject({
            matched: 1,
            delivered: 1,
            failed: 0,
        });
        expect(player.agent.script?.spec.scriptId).toBe("xp-watch");
        expect(frames[0]).toMatchObject({
            kind: "event",
            name: "script:installed",
        });

        frames.length = 0;
        const clear = server.broadcastClearScript("operator_journal_clear");
        expect(clear).toMatchObject({
            matched: 1,
            delivered: 1,
            failed: 0,
        });
        expect(player.agent.script).toBeUndefined();
        expect(frames[0]).toMatchObject({
            kind: "event",
            name: "script:cleared",
        });

        server.broadcastInstallScript({
            schemaVersion: 1,
            scriptId: "xp-watch",
            generatedBy: "operator",
            steps: [
                {
                    id: "wait",
                    kind: "wait",
                    events: ["skill:xpGain"],
                },
            ],
            interrupts: {
                INTERRUPT_STOP: {
                    policy: "abort",
                    message: "operator stop",
                },
            },
        });
        frames.length = 0;
        const interrupt = server.broadcastInterruptScript(
            "INTERRUPT_STOP",
            "operator_journal_interrupt",
        );
        expect(interrupt).toMatchObject({
            matched: 1,
            delivered: 1,
            failed: 0,
        });
        expect(player.agent.script).toBeUndefined();
        expect(frames).toEqual([
            expect.objectContaining({
                kind: "event",
                name: "script:cleared",
            }),
            expect.objectContaining({
                kind: "event",
                name: "script:interrupted",
            }),
        ]);
    });

    test("broadcast script controls can target a specific player id", () => {
        const firstPlayer = createAgentPlayer();
        const secondPlayer = createAgentPlayer({
            id: 99,
            name: "Scout",
            agent: {
                connected: true,
                identity: {
                    agentId: "agent-99",
                    controller: "hybrid",
                },
                actionQueue: {},
                lastHeardFrom: 0,
                lastEmittedAt: 0,
                recentEvents: [],
            },
        });
        const firstSocket = createSocket();
        const secondSocket = createSocket();
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
            },
            {
                factory: {} as any,
                router: {
                    dispatch() {
                        return { success: true, message: "ok" };
                    },
                } as any,
                recorder: {
                    recordRuntimeEvent() {},
                    recordOperatorCommand() {},
                    recordActionDispatch() {},
                    recordActionResult() {},
                    recordDisconnect() {},
                    recordSpawn() {},
                    dispose() {},
                } as any,
                playerPersistence: {
                    saveSnapshot() {},
                } as any,
                hookTicker() {},
            },
        );

        (server as any).sessions.set(firstSocket.ws, {
            ws: firstSocket.ws,
            player: firstPlayer,
            authedAt: 0,
            saveKey: "world:test:character:88",
        });
        (server as any).sessions.set(secondSocket.ws, {
            ws: secondSocket.ws,
            player: secondPlayer,
            authedAt: 0,
            saveKey: "world:test:character:99",
        });

        const install = server.broadcastInstallScript(
            {
                schemaVersion: 1,
                scriptId: "targeted-watch",
                generatedBy: "operator",
                steps: [
                    {
                        id: "wait",
                        kind: "wait",
                        events: ["skill:xpGain"],
                    },
                ],
                interrupts: {
                    INTERRUPT_STOP: {
                        policy: "abort",
                        message: "operator stop",
                    },
                },
            },
            undefined,
            99,
        );

        expect(install).toMatchObject({
            matched: 1,
            delivered: 1,
            failed: 0,
        });
        expect(firstPlayer.agent.script).toBeUndefined();
        expect(secondPlayer.agent.script?.spec.scriptId).toBe("targeted-watch");
        expect(firstSocket.frames).toEqual([]);
        expect(secondSocket.frames[0]).toMatchObject({
            kind: "event",
            name: "script:installed",
        });
    });
});
