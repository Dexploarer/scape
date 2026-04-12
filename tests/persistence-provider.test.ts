import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type {
    ControlPlaneClient,
    ControlPlanePlayerSnapshotRecord,
    ControlPlanePrincipalRecord,
    ControlPlaneWorldCharacterRecord,
} from "../server/src/controlplane/ControlPlaneClient";
import { SpacetimeControlPlaneClient } from "../server/src/controlplane/SpacetimeControlPlaneClient";
import { PlayerPersistence } from "../server/src/game/state/PlayerPersistence";
import {
    createPersistenceProvider,
    loadPersistenceProvider,
} from "../server/src/game/state/createPersistenceProvider";
import { SpacetimePersistenceProvider } from "../server/src/game/state/SpacetimePersistenceProvider";

const tempDirs: string[] = [];

function makeTempDir(label: string): string {
    const dir = join(
        tmpdir(),
        `scape-persistence-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch {}
    }
});

async function flushMicrotasks(turns = 6): Promise<void> {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

describe("createPersistenceProvider", () => {
    test("preserves the legacy gamemode-local path when worldId matches the gamemode", () => {
        const dataDir = makeTempDir("legacy");
        const provider = createPersistenceProvider({
            gamemodeId: "vanilla",
            worldId: "vanilla",
            dataDir,
        });

        expect(provider).toBeInstanceOf(PlayerPersistence);
        expect((provider as any).storePath).toBe(join(dataDir, "player-state.json"));
        expect((provider as any).defaultsPath).toBe(join(dataDir, "player-defaults.json"));
    });

    test("scopes JSON persistence under worlds/<worldId> for alternate realities", () => {
        const dataDir = makeTempDir("scoped");
        const provider = createPersistenceProvider({
            gamemodeId: "vanilla",
            worldId: "toonscape",
            dataDir,
        });

        expect(provider).toBeInstanceOf(PlayerPersistence);
        expect((provider as any).storePath).toBe(
            join(dataDir, "worlds", "toonscape", "player-state.json"),
        );
        expect((provider as any).defaultsPath).toBe(
            join(dataDir, "player-defaults.json"),
        );
        expect(existsSync(join(dataDir, "worlds", "toonscape"))).toBe(false);
    });

    test("loadPersistenceProvider prefers SpacetimeDB when control-plane env is configured", async () => {
        const fakeProvider = {
            applyToPlayer() {},
            hasKey() {
                return false;
            },
            saveSnapshot() {},
            savePlayers() {},
        };
        const originalConnect = SpacetimeControlPlaneClient.connect;
        const originalCreate = SpacetimePersistenceProvider.create;
        const spacetimeControlPlaneClient = SpacetimeControlPlaneClient as unknown as {
            connect: typeof SpacetimeControlPlaneClient.connect;
        };
        const spacetimePersistenceProvider = SpacetimePersistenceProvider as unknown as {
            create: typeof SpacetimePersistenceProvider.create;
        };
        spacetimeControlPlaneClient.connect = (async () => ({}) as never) as typeof SpacetimeControlPlaneClient.connect;
        spacetimePersistenceProvider.create = (async () => fakeProvider as never) as typeof SpacetimePersistenceProvider.create;

        try {
            const provider = await loadPersistenceProvider({
                gamemodeId: "vanilla",
                worldId: "toonscape",
                spacetimeUri: "https://control-plane.example.com",
                spacetimeDatabase: "hosted-scape",
                spacetimeAuthToken: "signed-token",
            });

            expect(provider).toBe(fakeProvider);
        } finally {
            spacetimeControlPlaneClient.connect = originalConnect;
            spacetimePersistenceProvider.create = originalCreate;
        }
    });
});

class FakePersistenceControlPlaneClient implements ControlPlaneClient {
    constructor(
        private readonly seededWorldCharacters: ControlPlaneWorldCharacterRecord[] = [],
        private readonly seededSnapshots: ControlPlanePlayerSnapshotRecord[] = [],
    ) {}

    readonly principals: ControlPlanePrincipalRecord[] = [];
    readonly loginAccounts = [] as never[];
    readonly worldCharacters: ControlPlaneWorldCharacterRecord[] = [];
    readonly snapshots: ControlPlanePlayerSnapshotRecord[] = [];

    async listLoginAccounts() {
        return [];
    }

    async listWorldCharactersForWorld(worldId: string) {
        return this.seededWorldCharacters.filter((row) => row.worldId === worldId);
    }

    async listPlayerSnapshotsForWorld(worldId: string) {
        return this.seededSnapshots.filter((row) => row.worldId === worldId);
    }

    async upsertPrincipal(record: ControlPlanePrincipalRecord) {
        this.principals.push(record);
    }

    async upsertLoginAccount() {}

    async upsertWorldCharacter(record: ControlPlaneWorldCharacterRecord) {
        this.worldCharacters.push(record);
    }

    async putPlayerSnapshot(record: ControlPlanePlayerSnapshotRecord) {
        this.snapshots.push(record);
    }

    async touchLoginAccount() {}

    async touchWorldCharacter() {}
}

describe("SpacetimePersistenceProvider", () => {
    test("preloads world-scoped snapshots and applies them synchronously", async () => {
        const dataDir = makeTempDir("spacetime-defaults");
        const defaultsPath = join(dataDir, "player-defaults.json");
        writeFileSync(
            defaultsPath,
            JSON.stringify({
                varps: {
                    1: 10,
                },
                accountStage: 1,
            }),
        );
        const client = new FakePersistenceControlPlaneClient(
            [
                {
                    worldCharacterId: "wc_alice",
                    worldId: "toonscape",
                    principalId: "account:alice",
                    displayName: "alice",
                    saveKey: "world:toonscape:name:alice",
                    createdAt: 1,
                },
            ],
            [
                {
                    worldCharacterId: "wc_alice",
                    worldId: "toonscape",
                    principalId: "account:alice",
                    snapshotVersion: 1,
                    persistentVarsJson: JSON.stringify({
                        varps: {
                            2: 20,
                        },
                        accountStage: 3,
                    }),
                    updatedAt: 2,
                },
            ],
        );

        const provider = await SpacetimePersistenceProvider.create({
            client,
            worldId: "toonscape",
            defaultsPath,
        });

        let appliedState: unknown;
        provider.applyToPlayer(
            {
                applyPersistentVars(state: unknown) {
                    appliedState = state;
                },
            } as never,
            "world:toonscape:name:alice",
        );

        expect(provider.hasKey("world:toonscape:name:alice")).toBe(true);
        expect(appliedState).toMatchObject({
            accountStage: 3,
            varps: {
                1: 10,
                2: 20,
            },
        });
    });

    test("saveSnapshot writes world characters and snapshots through the control plane", async () => {
        const client = new FakePersistenceControlPlaneClient();
        const provider = await SpacetimePersistenceProvider.create({
            client,
            worldId: "toonscape",
            now: () => 12345,
        });

        provider.saveSnapshot(
            "world:toonscape:character:wc_hosted",
            {
                name: "Toon Agent",
                agent: {
                    identity: {
                        agentId: "agent-1",
                    },
                },
                exportPersistentVars() {
                    return {
                        accountStage: 2,
                    };
                },
            } as never,
        );
        await flushMicrotasks();

        expect(client.principals).toHaveLength(1);
        expect(client.principals[0]).toMatchObject({
            principalId: "character:wc_hosted",
            principalKind: "agent",
        });
        expect(client.worldCharacters).toHaveLength(1);
        expect(client.worldCharacters[0]).toMatchObject({
            worldCharacterId: "wc_hosted",
            worldId: "toonscape",
            saveKey: "world:toonscape:character:wc_hosted",
            displayName: "Toon Agent",
        });
        expect(client.snapshots).toHaveLength(1);
        expect(client.snapshots[0]).toMatchObject({
            worldCharacterId: "wc_hosted",
            worldId: "toonscape",
            snapshotVersion: 1,
        });
        expect(JSON.parse(client.snapshots[0]!.persistentVarsJson)).toEqual({
            accountStage: 2,
        });
    });
});
