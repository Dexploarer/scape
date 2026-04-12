import { describe, expect, test } from "bun:test";

import type { PlayerState } from "../server/src/game/player";
import {
    BotSdkTrajectoryRecorder,
    MemoryBotSdkTrajectorySink,
} from "../server/src/network/botsdk/BotSdkTrajectoryRecorder";

function createAgentPlayer(): PlayerState {
    return {
        id: 42,
        name: "trajectory-agent",
        agent: {
            identity: {
                agentId: "agent-42",
            },
        },
    } as unknown as PlayerState;
}

describe("BotSdkTrajectoryRecorder", () => {
    test("records wake events plus action dispatch/ack envelopes with world scope", () => {
        let now = 10_000;
        const sink = new MemoryBotSdkTrajectorySink();
        const recorder = new BotSdkTrajectoryRecorder({
            worldId: "toonscape",
            sink,
            now: () => ++now,
        });
        const player = createAgentPlayer();

        recorder.recordWakeEvent(player, {
            event: "skill.xpGain",
            timestamp: ++now,
            playerId: player.id,
            payload: {
                skillId: 0,
                xpGained: 25,
            },
        });
        recorder.recordActionDispatch(player, {
            kind: "action",
            action: "walkTo",
            x: 3200,
            z: 3201,
            correlationId: "c1",
        });
        recorder.recordActionAck(
            player,
            {
                kind: "action",
                action: "walkTo",
                x: 3200,
                z: 3201,
                correlationId: "c1",
            },
            {
                success: true,
                message: "walking",
            },
        );

        expect(sink.entries).toEqual([
            {
                phase: "wake",
                timestamp: 10001,
                worldId: "toonscape",
                playerId: 42,
                playerName: "trajectory-agent",
                agentId: "agent-42",
                event: "skill.xpGain",
                payload: {
                    skillId: 0,
                    xpGained: 25,
                },
            },
            {
                phase: "action",
                timestamp: 10002,
                worldId: "toonscape",
                playerId: 42,
                playerName: "trajectory-agent",
                agentId: "agent-42",
                action: "walkTo",
                correlationId: "c1",
                payload: {
                    x: 3200,
                    z: 3201,
                    run: false,
                },
            },
            {
                phase: "ack",
                timestamp: 10003,
                worldId: "toonscape",
                playerId: 42,
                playerName: "trajectory-agent",
                agentId: "agent-42",
                action: "walkTo",
                correlationId: "c1",
                success: true,
                payload: {
                    message: "walking",
                },
            },
        ]);
    });
});
