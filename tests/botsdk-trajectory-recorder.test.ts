import { describe, expect, test } from "bun:test";

import type {
    ControlPlaneClient,
    PutLiveEventPayload,
    PutPlayerSnapshotPayload,
    PutTrajectoryStepPayload,
    TouchLoginAccountPayload,
    TouchWorldCharacterPayload,
    UpsertLoginAccountPayload,
    UpsertPrincipalPayload,
    UpsertTrajectoryEpisodePayload,
    UpsertWorldCharacterPayload,
    UpsertWorldPayload,
} from "../server/src/controlplane/ControlPlaneClient";
import { BotSdkTrajectoryRecorder } from "../server/src/network/botsdk/BotSdkTrajectoryRecorder";

function createFakeControlPlane(): ControlPlaneClient & {
    trajectoryEpisodes: UpsertTrajectoryEpisodePayload[];
    trajectorySteps: PutTrajectoryStepPayload[];
    liveEvents: PutLiveEventPayload[];
} {
    return {
        trajectoryEpisodes: [],
        trajectorySteps: [],
        liveEvents: [],
        async initialize() {},
        async disconnect() {},
        async listLoginAccounts() {
            return [];
        },
        async getLoginAccount() {
            return undefined;
        },
        async listWorldCharactersForWorld() {
            return [];
        },
        async getWorldCharacter() {
            return undefined;
        },
        async getWorldCharacterBySaveKey() {
            return undefined;
        },
        async listPlayerSnapshotsForWorld() {
            return [];
        },
        async getPlayerSnapshot() {
            return undefined;
        },
        async getPlayerSnapshotBySaveKey() {
            return undefined;
        },
        async upsertWorld(_payload: UpsertWorldPayload) {},
        async upsertPrincipal(_payload: UpsertPrincipalPayload) {},
        async upsertLoginAccount(_payload: UpsertLoginAccountPayload) {},
        async touchLoginAccount(_payload: TouchLoginAccountPayload) {},
        async upsertWorldCharacter(_payload: UpsertWorldCharacterPayload) {},
        async touchWorldCharacter(_payload: TouchWorldCharacterPayload) {},
        async putPlayerSnapshot(_payload: PutPlayerSnapshotPayload) {},
        async upsertTrajectoryEpisode(payload: UpsertTrajectoryEpisodePayload) {
            this.trajectoryEpisodes.push(payload);
        },
        async putTrajectoryStep(payload: PutTrajectoryStepPayload) {
            this.trajectorySteps.push(payload);
        },
        async putLiveEvent(payload: PutLiveEventPayload) {
            this.liveEvents.push(payload);
        },
    };
}

describe("BotSdkTrajectoryRecorder", () => {
    test("records a bot session as episode plus ordered trajectory steps", async () => {
        const controlPlane = createFakeControlPlane();
        const recorder = new BotSdkTrajectoryRecorder({
            controlPlane,
            worldId: "toonscape",
        });
        const player = {
            id: 77,
            name: "Toon Agent",
            tileX: 3200,
            tileY: 3201,
            level: 0,
            __principalId: "principal:agent-77",
            __worldCharacterId: "toon-77",
            agent: {
                identity: {
                    agentId: "agent-77",
                    controller: "hybrid",
                    persona: "helpful fisher",
                },
            },
        } as any;
        const action = {
            kind: "action",
            action: "walkTo",
            x: 3205,
            z: 3206,
            correlationId: "corr-1",
        } as const;

        recorder.recordSpawn(player, "world:toonscape:character:toon-77");
        recorder.recordActionDispatch(player, action);
        recorder.recordActionResult(player, action, {
            success: true,
            message: "walking toward (3205, 3206)",
        });
        recorder.recordPerception(player, {
            tick: 12,
            self: {
                id: 77,
                name: "Toon Agent",
                combatLevel: 3,
                hp: 10,
                maxHp: 10,
                x: 3200,
                z: 3201,
                level: 0,
                runEnergy: 100,
                inCombat: false,
            },
            skills: [],
            inventory: [],
            equipment: [],
            nearbyNpcs: [],
            nearbyPlayers: [],
            nearbyGroundItems: [],
            nearbyObjects: [],
            recentEvents: [],
        });
        recorder.recordRuntimeEvent(player, {
            kind: "event",
            name: "skill:levelUp",
            timestamp: 456,
            payload: {
                playerId: 77,
                skillId: 10,
                oldLevel: 1,
                newLevel: 2,
            },
        });
        recorder.recordOperatorCommand(player, {
            source: "chat",
            text: "go fish",
            timestamp: 123,
            fromPlayerId: 1,
            fromPlayerName: "alice",
        });
        recorder.recordDisconnect(player, "client_disconnect");
        await recorder.dispose();

        expect(controlPlane.trajectoryEpisodes).toHaveLength(2);
        expect(controlPlane.trajectoryEpisodes[0]).toMatchObject({
            world_id: "toonscape",
            principal_id: "principal:agent-77",
            world_character_id: "toon-77",
            agent_id: "agent-77",
            player_id: 77,
            session_source: "botsdk",
            ended_at: undefined,
        });
        expect(controlPlane.trajectoryEpisodes.at(-1)?.ended_at).toBeDefined();
        expect(controlPlane.trajectorySteps.map((step) => step.event_kind)).toEqual([
            "spawn",
            "action_dispatch",
            "action_result",
            "perception",
            "runtime_event",
            "operator_command",
            "disconnect",
        ]);
        expect(controlPlane.trajectorySteps.map((step) => step.sequence)).toEqual([
            1, 2, 3, 4, 5, 6, 7,
        ]);
        expect(controlPlane.trajectorySteps[1]).toMatchObject({
            action_name: "walkTo",
            correlation_id: "corr-1",
        });
        expect(controlPlane.trajectorySteps[2]?.outcome_json).toContain(
            "walking toward",
        );
        expect(controlPlane.trajectorySteps[4]?.payload_json).toContain(
            "\"name\":\"skill:levelUp\"",
        );
    });
});
