import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type {
    ControlPlaneClient,
    PutPlayerSnapshotPayload,
    UpsertPrincipalPayload,
    UpsertWorldCharacterPayload,
    UpsertWorldPayload,
} from "../server/src/controlplane/ControlPlaneClient";
import { SpacetimePersistenceProvider } from "../server/src/game/state/SpacetimePersistenceProvider";

function createFakeControlPlane(): ControlPlaneClient & {
    worldCharacters: Array<{
        world_character_id: string;
        world_id: string;
        principal_id: string;
        display_name: string;
        save_key?: string;
        branch_kind?: string;
        created_at: bigint;
        last_seen_at?: bigint;
    }>;
    snapshots: Array<{
        world_character_id: string;
        world_id: string;
        principal_id: string;
        snapshot_version: number;
        persistent_vars_json: string;
        updated_at: bigint;
    }>;
    upsertedWorlds: UpsertWorldPayload[];
    upsertedPrincipals: UpsertPrincipalPayload[];
    upsertedWorldCharacters: UpsertWorldCharacterPayload[];
    writtenSnapshots: PutPlayerSnapshotPayload[];
} {
    return {
        worldCharacters: [],
        snapshots: [],
        upsertedWorlds: [],
        upsertedPrincipals: [],
        upsertedWorldCharacters: [],
        writtenSnapshots: [],
        async initialize() {},
        async disconnect() {},
        async listLoginAccounts() {
            return [];
        },
        async getLoginAccount() {
            return undefined;
        },
        async listWorldCharactersForWorld(worldId) {
            return this.worldCharacters.filter((row) => row.world_id === worldId);
        },
        async getWorldCharacter(worldCharacterId) {
            return this.worldCharacters.find(
                (row) => row.world_character_id === worldCharacterId,
            );
        },
        async getWorldCharacterBySaveKey(worldId, saveKey) {
            return this.worldCharacters.find(
                (row) => row.world_id === worldId && row.save_key === saveKey,
            );
        },
        async listPlayerSnapshotsForWorld(worldId) {
            return this.snapshots.filter((row) => row.world_id === worldId);
        },
        async getPlayerSnapshot(worldCharacterId) {
            return this.snapshots.find((row) => row.world_character_id === worldCharacterId);
        },
        async getPlayerSnapshotBySaveKey(worldId, saveKey) {
            const worldCharacter = await this.getWorldCharacterBySaveKey(worldId, saveKey);
            if (!worldCharacter) return undefined;
            return this.getPlayerSnapshot(worldCharacter.world_character_id);
        },
        async upsertWorld(payload) {
            this.upsertedWorlds.push(payload);
        },
        async upsertPrincipal(payload) {
            this.upsertedPrincipals.push(payload);
        },
        async upsertLoginAccount() {},
        async touchLoginAccount() {},
        async upsertWorldCharacter(payload) {
            this.upsertedWorldCharacters.push(payload);
            this.worldCharacters = this.worldCharacters.filter(
                (row) => row.world_character_id !== payload.world_character_id,
            );
            this.worldCharacters.push(payload);
        },
        async touchWorldCharacter() {},
        async putPlayerSnapshot(payload) {
            this.writtenSnapshots.push(payload);
            this.snapshots = this.snapshots.filter(
                (row) => row.world_character_id !== payload.world_character_id,
            );
            this.snapshots.push(payload);
        },
        async upsertTrajectoryEpisode() {},
        async putTrajectoryStep() {},
        async putLiveEvent() {},
    };
}

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) rmSync(dir, { recursive: true, force: true });
    }
});

describe("SpacetimePersistenceProvider", () => {
    test("preloads world snapshots and merges them with defaults", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "scape-spacetime-"));
        tempDirs.push(tempDir);
        writeFileSync(
            join(tempDir, "player-defaults.json"),
            JSON.stringify({ accountStage: 1, runToggle: false }),
        );

        const controlPlane = createFakeControlPlane();
        controlPlane.worldCharacters.push({
            world_character_id: "world-character:toonscape:name:alice",
            world_id: "toonscape",
            principal_id: "principal:login:alice",
            display_name: "alice",
            save_key: "world:toonscape:name:alice",
            branch_kind: "local",
            created_at: 1n,
        });
        controlPlane.snapshots.push({
            world_character_id: "world-character:toonscape:name:alice",
            world_id: "toonscape",
            principal_id: "principal:login:alice",
            snapshot_version: 1,
            persistent_vars_json: JSON.stringify({ runToggle: true }),
            updated_at: 2n,
        });

        const provider = new SpacetimePersistenceProvider({
            controlPlane,
            worldId: "toonscape",
            worldName: "Toonscape",
            gamemodeId: "vanilla",
            dataDir: tempDir,
        });

        await provider.initialize();

        let appliedSnapshot: unknown;
        provider.applyToPlayer(
            {
                name: "alice",
                applyPersistentVars(snapshot: unknown) {
                    appliedSnapshot = snapshot;
                },
            } as any,
            "world:toonscape:name:alice",
        );

        expect(appliedSnapshot).toEqual({
            accountStage: 1,
            runToggle: true,
        });
    });

    test("writes world characters and snapshots back through the control plane", async () => {
        const tempDir = mkdtempSync(join(tmpdir(), "scape-spacetime-"));
        tempDirs.push(tempDir);

        const controlPlane = createFakeControlPlane();
        const provider = new SpacetimePersistenceProvider({
            controlPlane,
            worldId: "toonscape",
            worldName: "Toonscape",
            gamemodeId: "vanilla",
            dataDir: tempDir,
        });

        await provider.initialize();

        const player = {
            name: "Alice",
            agent: undefined,
            exportPersistentVars() {
                return { accountStage: 7 };
            },
        } as any;

        provider.saveSnapshot("world:toonscape:name:alice", player);
        await provider.dispose();

        expect(provider.hasKey("world:toonscape:name:alice")).toBe(true);
        expect(controlPlane.upsertedWorlds.length).toBeGreaterThan(0);
        expect(controlPlane.upsertedPrincipals.at(-1)?.principal_id).toBe(
            "principal:login:alice",
        );
        expect(controlPlane.upsertedWorldCharacters.at(-1)?.save_key).toBe(
            "world:toonscape:name:alice",
        );
        expect(controlPlane.writtenSnapshots.at(-1)?.persistent_vars_json).toBe(
            JSON.stringify({ accountStage: 7 }),
        );
    });
});
