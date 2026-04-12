import { createHash } from "node:crypto";

import type {
    ControlPlaneClient,
    ControlPlanePlayerSnapshotRecord,
    ControlPlanePrincipalRecord,
    ControlPlaneWorldCharacterRecord,
} from "../../controlplane/ControlPlaneClient";
import { logger } from "../../utils/logger";
import type { PlayerPersistentVars, PlayerState } from "../player";

import type { ManagedPersistenceProvider } from "./PersistenceProvider";
import { mergePlayerPersistentStates, readJsonFile } from "./PlayerPersistence";
import { normalizePlayerAccountName } from "./PlayerSessionKeys";

export interface SpacetimePersistenceProviderOptions {
    client: ControlPlaneClient;
    worldId: string;
    defaultsPath?: string;
    snapshotVersion?: number;
    now?: () => number;
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

function snapshotRecordToPersistentVars(
    record: ControlPlanePlayerSnapshotRecord,
): PlayerPersistentVars | undefined {
    try {
        return JSON.parse(record.persistentVarsJson) as PlayerPersistentVars;
    } catch (error) {
        logger.warn(
            `[persistence][spacetime] failed to parse player snapshot for ${record.worldCharacterId}`,
            error,
        );
        return undefined;
    }
}

export class SpacetimePersistenceProvider implements ManagedPersistenceProvider {
    private readonly defaults?: PlayerPersistentVars;
    private readonly snapshotVersion: number;
    private readonly now: () => number;
    private readonly snapshots = new Map<string, PlayerPersistentVars>();
    private readonly charactersBySaveKey = new Map<string, ControlPlaneWorldCharacterRecord>();
    private readonly charactersById = new Map<string, ControlPlaneWorldCharacterRecord>();

    private constructor(private readonly options: SpacetimePersistenceProviderOptions) {
        this.defaults = options.defaultsPath
            ? readJsonFile<PlayerPersistentVars | undefined>(options.defaultsPath, undefined)
            : undefined;
        this.snapshotVersion = Math.max(1, options.snapshotVersion ?? 1);
        this.now = options.now ?? (() => Date.now());
    }

    static async create(
        options: SpacetimePersistenceProviderOptions,
    ): Promise<SpacetimePersistenceProvider> {
        const provider = new SpacetimePersistenceProvider(options);
        await provider.loadAll();
        return provider;
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
        if (!entries || entries.length === 0) {
            return;
        }
        for (const entry of entries) {
            this.saveSnapshot(entry.key, entry.player);
        }
    }

    async dispose(): Promise<void> {
        await this.options.client.dispose?.();
    }

    private async loadAll(): Promise<void> {
        const [worldCharacters, snapshots] = await Promise.all([
            this.options.client.listWorldCharactersForWorld(this.options.worldId),
            this.options.client.listPlayerSnapshotsForWorld(this.options.worldId),
        ]);

        for (const worldCharacter of worldCharacters) {
            this.charactersById.set(worldCharacter.worldCharacterId, worldCharacter);
            const saveKey =
                worldCharacter.saveKey ??
                `world:${this.options.worldId}:character:${worldCharacter.worldCharacterId}`;
            this.charactersBySaveKey.set(saveKey, {
                ...worldCharacter,
                saveKey,
            });
        }

        for (const snapshot of snapshots) {
            const state = snapshotRecordToPersistentVars(snapshot);
            if (!state) {
                continue;
            }
            const worldCharacter = this.charactersById.get(snapshot.worldCharacterId);
            const saveKey =
                worldCharacter?.saveKey ??
                `world:${this.options.worldId}:character:${snapshot.worldCharacterId}`;
            this.snapshots.set(saveKey, state);
        }

        logger.info(
            `[persistence][spacetime] ready for world=${this.options.worldId} characters=${this.charactersById.size} snapshots=${this.snapshots.size}`,
        );
    }

    private ensureWorldCharacter(
        saveKey: string,
        player: PlayerState,
    ): ControlPlaneWorldCharacterRecord {
        const existing = this.charactersBySaveKey.get(saveKey);
        const displayName = player.name?.trim() || existing?.displayName || "player";
        const now = this.now();
        if (existing) {
            const updated: ControlPlaneWorldCharacterRecord = {
                ...existing,
                displayName,
                saveKey,
                lastSeenAt: now,
            };
            this.charactersBySaveKey.set(saveKey, updated);
            this.charactersById.set(updated.worldCharacterId, updated);
            return updated;
        }

        const parsed = parseSaveKey(this.options.worldId, saveKey);
        const normalizedName = parsed.worldCharacterId
            ? undefined
            : normalizePlayerAccountName(displayName) ?? parsed.accountName;
        const principalId = normalizedName
            ? `account:${normalizedName}`
            : parsed.worldCharacterId
              ? `character:${parsed.worldCharacterId}`
              : parsed.transientId
                ? `ephemeral:${this.options.worldId}:${parsed.transientId}`
                : `ephemeral:${this.options.worldId}:${stableWorldCharacterId(this.options.worldId, saveKey)}`;
        const worldCharacterId =
            parsed.worldCharacterId ?? stableWorldCharacterId(this.options.worldId, saveKey);
        const created: ControlPlaneWorldCharacterRecord = {
            worldCharacterId,
            worldId: this.options.worldId,
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
        worldCharacter: ControlPlaneWorldCharacterRecord,
        snapshot: PlayerPersistentVars,
        player: PlayerState,
    ): void {
        const updatedAt = this.now();
        const principal: ControlPlanePrincipalRecord | undefined =
            worldCharacter.principalId.startsWith("account:")
                ? undefined
                : {
                      principalId: worldCharacter.principalId,
                      principalKind: player.agent ? "agent" : "player",
                      canonicalName:
                          normalizePlayerAccountName(worldCharacter.displayName) ??
                          worldCharacter.displayName.toLowerCase(),
                      createdAt: worldCharacter.createdAt,
                      updatedAt,
                  };
        const snapshotRecord: ControlPlanePlayerSnapshotRecord = {
            worldCharacterId: worldCharacter.worldCharacterId,
            worldId: worldCharacter.worldId,
            principalId: worldCharacter.principalId,
            snapshotVersion: this.snapshotVersion,
            persistentVarsJson: JSON.stringify(snapshot),
            updatedAt,
        };
        const updatedWorldCharacter: ControlPlaneWorldCharacterRecord = {
            ...worldCharacter,
            lastSeenAt: updatedAt,
        };
        this.charactersBySaveKey.set(normalizeSaveKey(worldCharacter.saveKey ?? ""), updatedWorldCharacter);
        this.charactersById.set(updatedWorldCharacter.worldCharacterId, updatedWorldCharacter);

        void Promise.resolve()
            .then(async () => {
                if (principal) {
                    await this.options.client.upsertPrincipal(principal);
                }
                await this.options.client.upsertWorldCharacter(updatedWorldCharacter);
                await this.options.client.putPlayerSnapshot(snapshotRecord);
            })
            .catch((error) => {
                logger.warn(
                    `[persistence][spacetime] failed to persist snapshot for ${updatedWorldCharacter.worldCharacterId}`,
                    error,
                );
            });
    }
}
