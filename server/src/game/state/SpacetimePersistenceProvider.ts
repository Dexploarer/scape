import { createHash } from "node:crypto";
import { join } from "node:path";

import type {
    ControlPlaneClient,
    ControlPlanePlayerSnapshotRecord,
    ControlPlaneWorldCharacterRecord,
    PutPlayerSnapshotPayload,
    UpsertPrincipalPayload,
    UpsertWorldCharacterPayload,
    UpsertWorldPayload,
} from "../../controlplane/ControlPlaneClient";
import { logger } from "../../utils/logger";
import type { PlayerPersistentVars, PlayerState } from "../player";

import type { ManagedPersistenceProvider } from "./PersistenceProvider";
import { mergePlayerPersistentStates, readJsonFile } from "./PlayerPersistence";
import {
    normalizePlayerAccountName,
    normalizeWorldScopeId,
} from "./PlayerSessionKeys";

export interface SpacetimePersistenceProviderOptions {
    client?: ControlPlaneClient;
    controlPlane?: ControlPlaneClient;
    worldId: string;
    worldName?: string;
    gamemodeId?: string;
    dataDir?: string;
    defaultsPath?: string;
    snapshotVersion?: number;
    now?: () => number;
}

type WorldCharacterRecordLike =
    | ControlPlaneWorldCharacterRecord
    | {
          world_character_id?: string;
          world_id?: string;
          principal_id?: string;
          display_name?: string;
          save_key?: string;
          branch_kind?: string;
          created_at?: bigint;
          last_seen_at?: bigint;
      };

type PlayerSnapshotRecordLike =
    | ControlPlanePlayerSnapshotRecord
    | {
          world_character_id?: string;
          world_id?: string;
          principal_id?: string;
          snapshot_version?: number;
          persistent_vars_json?: string;
          updated_at?: bigint;
      };

interface NormalizedWorldCharacter {
    worldCharacterId: string;
    worldId: string;
    principalId: string;
    displayName: string;
    saveKey: string;
    branchKind?: string;
    createdAt: number;
    lastSeenAt?: number;
}

interface EpisodeWorldConfig {
    worldId: string;
    worldName: string;
    gamemodeId: string;
}

function normalizeSaveKey(saveKey: string): string {
    return saveKey.trim();
}

function stableWorldCharacterId(worldId: string, saveKey: string): string {
    const digest = createHash("sha256")
        .update(`${worldId}:${saveKey}`)
        .digest("hex")
        .slice(0, 24);
    return `wc_${digest}`;
}

function nowMicros(now: () => number): bigint {
    return BigInt(Math.trunc(now())) * 1000n;
}

function readEpoch(value: bigint | number | undefined, fallback: number): number {
    if (typeof value === "bigint") {
        return Number(value / 1000n);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return fallback;
}

interface ParsedSaveKey {
    worldCharacterId?: string;
    accountName?: string;
    transientId?: string;
}

function parseSaveKey(worldId: string, saveKey: string): ParsedSaveKey {
    const trimmed = normalizeSaveKey(saveKey);
    const worldPrefix = `world:${worldId}:`;
    const scoped = trimmed.startsWith(worldPrefix)
        ? trimmed.slice(worldPrefix.length)
        : trimmed;

    if (scoped.startsWith("character:")) {
        return {
            worldCharacterId: scoped.slice("character:".length),
        };
    }
    if (scoped.startsWith("name:")) {
        return {
            accountName: scoped.slice("name:".length),
        };
    }
    if (scoped.startsWith("id:")) {
        return {
            transientId: scoped.slice("id:".length),
        };
    }
    return {};
}

function normalizeWorldCharacter(
    record: WorldCharacterRecordLike,
    fallbackWorldId: string,
): NormalizedWorldCharacter | undefined {
    const legacy = record as {
        created_at?: bigint;
        last_seen_at?: bigint;
        save_key?: string;
        branch_kind?: string;
    };
    const worldCharacterId =
        "worldCharacterId" in record
            ? record.worldCharacterId
            : record.world_character_id;
    const worldId =
        "worldId" in record
            ? record.worldId
            : record.world_id;
    const principalId =
        "principalId" in record
            ? record.principalId
            : record.principal_id;
    const displayName =
        "displayName" in record
            ? record.displayName
            : record.display_name;
    if (!worldCharacterId || !worldId || !principalId || !displayName) {
        return undefined;
    }

    const createdAt = readEpoch(
        "createdAt" in record ? record.createdAt : legacy.created_at,
        Date.now(),
    );
    const lastSeenAtRaw =
        "lastSeenAt" in record ? record.lastSeenAt : legacy.last_seen_at;
    const saveKey =
        ("saveKey" in record ? record.saveKey : legacy.save_key) ??
        `world:${fallbackWorldId}:character:${worldCharacterId}`;

    return {
        worldCharacterId,
        worldId,
        principalId,
        displayName,
        saveKey,
        branchKind: "branchKind" in record ? record.branchKind : legacy.branch_kind,
        createdAt,
        lastSeenAt:
            lastSeenAtRaw === undefined ? undefined : readEpoch(lastSeenAtRaw, createdAt),
    };
}

function normalizeSnapshotRecord(
    record: PlayerSnapshotRecordLike,
): {
    worldCharacterId: string;
    persistentVarsJson: string;
  } | undefined {
    const worldCharacterId =
        "worldCharacterId" in record
            ? record.worldCharacterId
            : record.world_character_id;
    const persistentVarsJson =
        "persistentVarsJson" in record
            ? record.persistentVarsJson
            : record.persistent_vars_json;
    if (!worldCharacterId || !persistentVarsJson) {
        return undefined;
    }
    return {
        worldCharacterId,
        persistentVarsJson,
    };
}

function snapshotRecordToPersistentVars(
    record: PlayerSnapshotRecordLike,
): PlayerPersistentVars | undefined {
    const normalized = normalizeSnapshotRecord(record);
    if (!normalized) {
        return undefined;
    }
    try {
        return JSON.parse(normalized.persistentVarsJson) as PlayerPersistentVars;
    } catch (error) {
        logger.warn(
            `[persistence][spacetime] failed to parse player snapshot for ${normalized.worldCharacterId}`,
            error,
        );
        return undefined;
    }
}

export class SpacetimePersistenceProvider implements ManagedPersistenceProvider {
    private readonly client: ControlPlaneClient;
    private readonly world: EpisodeWorldConfig;
    private readonly defaults?: PlayerPersistentVars;
    private readonly snapshotVersion: number;
    private readonly now: () => number;
    private readonly snapshots = new Map<string, PlayerPersistentVars>();
    private readonly charactersBySaveKey = new Map<string, NormalizedWorldCharacter>();
    private readonly charactersById = new Map<string, NormalizedWorldCharacter>();
    private readonly persistJobs = new Set<Promise<void>>();

    constructor(private readonly options: SpacetimePersistenceProviderOptions) {
        this.client = options.client ?? options.controlPlane!;
        if (!this.client) {
            throw new Error("SpacetimePersistenceProvider requires a control-plane client.");
        }
        const worldId = normalizeWorldScopeId(options.worldId) ?? "default";
        this.world = {
            worldId,
            worldName: options.worldName?.trim() || worldId,
            gamemodeId: options.gamemodeId?.trim() || worldId,
        };
        const defaultsPath =
            options.defaultsPath ??
            (options.dataDir ? join(options.dataDir, "player-defaults.json") : undefined);
        this.defaults = defaultsPath
            ? readJsonFile<PlayerPersistentVars | undefined>(defaultsPath, undefined)
            : undefined;
        this.snapshotVersion = Math.max(1, options.snapshotVersion ?? 1);
        this.now = options.now ?? (() => Date.now());
    }

    static async create(
        options: SpacetimePersistenceProviderOptions,
    ): Promise<SpacetimePersistenceProvider> {
        const provider = new SpacetimePersistenceProvider(options);
        await provider.initialize();
        return provider;
    }

    async initialize(): Promise<void> {
        await this.loadAll();
    }

    applyToPlayer(player: PlayerState, key: string): void {
        const snapshot = mergePlayerPersistentStates(
            this.defaults,
            this.snapshots.get(normalizeSaveKey(key)),
        );
        player.applyPersistentVars(snapshot);
    }

    hasKey(key: string): boolean {
        return this.snapshots.has(normalizeSaveKey(key));
    }

    saveSnapshot(key: string, player: PlayerState): void {
        const saveKey = normalizeSaveKey(key);
        const snapshot = player.exportPersistentVars();
        this.snapshots.set(saveKey, snapshot);
        const worldCharacter = this.ensureWorldCharacter(saveKey, player);
        this.backgroundPersist(worldCharacter, snapshot, player);
    }

    savePlayers(entries: Array<{ key: string; player: PlayerState }>): void {
        for (const entry of entries) {
            this.saveSnapshot(entry.key, entry.player);
        }
    }

    async dispose(): Promise<void> {
        await Promise.allSettled([...this.persistJobs]);
        await this.client.dispose?.();
        await (this.client as { disconnect?: () => Promise<void> }).disconnect?.();
    }

    private async loadAll(): Promise<void> {
        this.charactersById.clear();
        this.charactersBySaveKey.clear();
        this.snapshots.clear();

        const [worldCharacters, snapshots] = await Promise.all([
            this.client.listWorldCharactersForWorld(this.world.worldId),
            this.client.listPlayerSnapshotsForWorld(this.world.worldId),
        ]);

        for (const raw of worldCharacters as WorldCharacterRecordLike[]) {
            const normalized = normalizeWorldCharacter(raw, this.world.worldId);
            if (!normalized) continue;
            this.charactersById.set(normalized.worldCharacterId, normalized);
            this.charactersBySaveKey.set(normalized.saveKey, normalized);
        }

        for (const raw of snapshots as PlayerSnapshotRecordLike[]) {
            const normalizedSnapshot = normalizeSnapshotRecord(raw);
            const state = snapshotRecordToPersistentVars(raw);
            if (!normalizedSnapshot || !state) continue;
            const worldCharacter = this.charactersById.get(normalizedSnapshot.worldCharacterId);
            const saveKey =
                worldCharacter?.saveKey ??
                `world:${this.world.worldId}:character:${normalizedSnapshot.worldCharacterId}`;
            this.snapshots.set(saveKey, state);
        }
    }

    private ensureWorldCharacter(
        saveKey: string,
        player: PlayerState,
    ): NormalizedWorldCharacter {
        const existing = this.charactersBySaveKey.get(saveKey);
        const displayName = player.name?.trim() || existing?.displayName || "player";
        const now = this.now();
        if (existing) {
            const updated: NormalizedWorldCharacter = {
                ...existing,
                displayName,
                saveKey,
                lastSeenAt: now,
            };
            this.charactersBySaveKey.set(saveKey, updated);
            this.charactersById.set(updated.worldCharacterId, updated);
            return updated;
        }

        const parsed = parseSaveKey(this.world.worldId, saveKey);
        const normalizedName = parsed.worldCharacterId
            ? undefined
            : normalizePlayerAccountName(displayName) ?? parsed.accountName;
        const principalId = normalizedName
            ? `principal:login:${normalizedName}`
            : parsed.worldCharacterId
                ? `principal:character:${parsed.worldCharacterId}`
                : parsed.transientId
                    ? `principal:ephemeral:${this.world.worldId}:${parsed.transientId}`
                    : `principal:ephemeral:${this.world.worldId}:${stableWorldCharacterId(this.world.worldId, saveKey)}`;
        const worldCharacterId =
            parsed.worldCharacterId ?? stableWorldCharacterId(this.world.worldId, saveKey);
        const created: NormalizedWorldCharacter = {
            worldCharacterId,
            worldId: this.world.worldId,
            principalId,
            displayName,
            saveKey,
            branchKind: parsed.worldCharacterId ? "hosted" : "save_key",
            createdAt: now,
            lastSeenAt: now,
        };
        this.charactersBySaveKey.set(saveKey, created);
        this.charactersById.set(worldCharacterId, created);
        return created;
    }

    private backgroundPersist(
        worldCharacter: NormalizedWorldCharacter,
        snapshot: PlayerPersistentVars,
        player: PlayerState,
    ): void {
        const updatedAt = this.now();
        const updatedAtMicros = nowMicros(() => updatedAt);

        const worldPayload: UpsertWorldPayload = {
            world_id: this.world.worldId,
            name: this.world.worldName,
            gamemode_id: this.world.gamemodeId,
            status: "active",
            created_at: updatedAtMicros,
            updated_at: updatedAtMicros,
        };
        const principalPayload: UpsertPrincipalPayload = {
            principal_id: worldCharacter.principalId,
            principal_kind: player.agent ? "agent" : "player",
            canonical_name:
                normalizePlayerAccountName(worldCharacter.displayName) ??
                worldCharacter.displayName.toLowerCase(),
            created_at: nowMicros(() => worldCharacter.createdAt),
            updated_at: updatedAtMicros,
        };
        const worldCharacterPayload: UpsertWorldCharacterPayload = {
            world_character_id: worldCharacter.worldCharacterId,
            world_id: worldCharacter.worldId,
            principal_id: worldCharacter.principalId,
            display_name: worldCharacter.displayName,
            save_key: worldCharacter.saveKey,
            branch_kind: worldCharacter.branchKind,
            created_at: nowMicros(() => worldCharacter.createdAt),
            last_seen_at: updatedAtMicros,
        };
        const snapshotPayload: PutPlayerSnapshotPayload = {
            world_character_id: worldCharacter.worldCharacterId,
            world_id: worldCharacter.worldId,
            principal_id: worldCharacter.principalId,
            snapshot_version: this.snapshotVersion,
            persistent_vars_json: JSON.stringify(snapshot),
            updated_at: updatedAtMicros,
        };

        const updatedWorldCharacter: NormalizedWorldCharacter = {
            ...worldCharacter,
            lastSeenAt: updatedAt,
        };
        this.charactersBySaveKey.set(worldCharacter.saveKey, updatedWorldCharacter);
        this.charactersById.set(updatedWorldCharacter.worldCharacterId, updatedWorldCharacter);

        const job = Promise.resolve()
            .then(async () => {
                await this.client.upsertWorld?.(worldPayload);
                await this.client.upsertPrincipal(principalPayload);
                await this.client.upsertWorldCharacter(worldCharacterPayload);
                await this.client.putPlayerSnapshot(snapshotPayload);
            })
            .catch((error) => {
                logger.warn(
                    `[persistence][spacetime] failed to persist snapshot for ${updatedWorldCharacter.worldCharacterId}`,
                    error,
                );
            })
            .finally(() => {
                this.persistJobs.delete(job);
            });

        this.persistJobs.add(job);
    }
}
