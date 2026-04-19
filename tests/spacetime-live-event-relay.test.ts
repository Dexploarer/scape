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
import { SpacetimeLiveEventRelay } from "../server/src/controlplane/SpacetimeLiveEventRelay";
import { GameEventBus } from "../server/src/game/events/GameEventBus";

function createFakeControlPlane(): ControlPlaneClient & {
    liveEvents: PutLiveEventPayload[];
} {
    return {
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
        async upsertTrajectoryEpisode(_payload: UpsertTrajectoryEpisodePayload) {},
        async putTrajectoryStep(_payload: PutTrajectoryStepPayload) {},
        async putLiveEvent(payload: PutLiveEventPayload) {
            this.liveEvents.push(payload);
        },
    };
}

describe("SpacetimeLiveEventRelay", () => {
    test("serializes typed game events into live_event writes", async () => {
        const controlPlane = createFakeControlPlane();
        const eventBus = new GameEventBus();
        const relay = new SpacetimeLiveEventRelay({
            controlPlane,
            eventBus,
            worldId: "toonscape",
        });
        const player = {
            id: 12,
            name: "Alice",
            tileX: 3200,
            tileY: 3201,
            level: 0,
            __principalId: "principal:login:alice",
            __worldCharacterId: "world-character:toonscape:name:alice",
            agent: undefined,
        } as any;

        eventBus.emit("skill:xpGain", {
            player,
            skillId: 10,
            xpGained: 50,
            totalXp: 150,
            source: "skill",
        });
        eventBus.emit("player:logout", {
            playerId: 12,
            username: "Alice",
        });
        await relay.dispose();

        expect(controlPlane.liveEvents).toHaveLength(2);
        expect(controlPlane.liveEvents[0]).toMatchObject({
            world_id: "toonscape",
            principal_id: "principal:login:alice",
            world_character_id: "world-character:toonscape:name:alice",
            player_id: 12,
            source: "game_event_bus",
            event_name: "skill:xpGain",
        });
        expect(JSON.parse(controlPlane.liveEvents[0]!.payload_json)).toMatchObject({
            skillId: 10,
            xpGained: 50,
            totalXp: 150,
            source: "skill",
        });
        expect(controlPlane.liveEvents[1]).toMatchObject({
            event_name: "player:logout",
            principal_id: "principal:login:alice",
            player_id: 12,
        });
    });
});
