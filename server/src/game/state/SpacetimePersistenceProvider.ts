import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ControlPlaneClient } from "../../controlplane/ControlPlaneClient";
import { logger } from "../../utils/logger";
import type { PlayerPersistentVars, PlayerState } from "../player";
import type {
    ManagedPersistenceProvider,
    PersistenceIdentityHints,
} from "./PersistenceProvider";
import { mergePersistentVars } from "./PlayerPersistence";
import { nowMicros, resolveSpacetimeStateIds } from "./SpacetimeStateIds";

const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../../data");
const SNAPSHOT_VERSION = 1;

function readDefaultsFile(filePath: string): PlayerPersistentVars | undefined {
    try {
        if (!existsSync(filePath)) return undefined;
        return JSON.parse(readFileSync(filePath, "utf8")) as PlayerPersistentVars;
    } catch (error) {
        logger.warn(`[spacetime] failed to load player defaults from ${filePath}`, error);
        return undefined;
    }
}

export interface SpacetimePersistenceProviderOptions {
    controlPlane: ControlPlaneClient;
    worldId: string;
    worldName?: string;
    gamemodeId: string;
    dataDir?: string;
    defaultsPath?: string;
}

export class SpacetimePersistenceProvider implements ManagedPersistenceProvider {
    private readonly defaults: PlayerPersistentVars | undefined;
    private readonly worldId: string;
    private readonly worldName: string;
    private readonly gamemodeId: string;
    private readonly snapshotsByWorldCharacterId = new Map<string, PlayerPersistentVars>();
    private readonly worldCharacterIdsBySaveKey = new Map<string, string>();
    private writeChain: Promise<void> = Promise.resolve();

    constructor(private readonly options: SpacetimePersistenceProviderOptions) {
        const dataDir = options.dataDir ? path.resolve(options.dataDir) : DEFAULT_DATA_DIR;
        const defaultsPath = options.defaultsPath
            ? path.resolve(options.defaultsPath)
            : path.join(dataDir, "player-defaults.json");
        this.defaults = readDefaultsFile(defaultsPath);
        this.worldId = options.worldId;
        this.worldName = options.worldName?.trim() || options.worldId;
        this.gamemodeId = options.gamemodeId;
    }

    async initialize(): Promise<void> {
        const timestamp = nowMicros();
        await this.options.controlPlane.upsertWorld({
            world_id: this.worldId,
            name: this.worldName,
            gamemode_id: this.gamemodeId,
            status: "active",
            release_id: undefined,
            owner_principal_id: undefined,
            metadata_json: undefined,
            created_at: timestamp,
            updated_at: timestamp,
        });

        const [worldCharacters, snapshots] = await Promise.all([
            this.options.controlPlane.listWorldCharactersForWorld(this.worldId),
            this.options.controlPlane.listPlayerSnapshotsForWorld(this.worldId),
        ]);

        this.worldCharacterIdsBySaveKey.clear();
        this.snapshotsByWorldCharacterId.clear();

        for (const row of worldCharacters) {
            if (row.save_key) {
                this.worldCharacterIdsBySaveKey.set(row.save_key, row.world_character_id);
            }
        }
        for (const row of snapshots) {
            this.cacheSnapshotRow(row.world_character_id, row.persistent_vars_json);
        }

        logger.info(
            `[spacetime] loaded ${worldCharacters.length} world character(s) and ${snapshots.length} snapshot(s) for ${this.worldId}`,
        );
    }

    async dispose(): Promise<void> {
        await this.writeChain;
    }

    async warmKey(key: string, hints?: PersistenceIdentityHints): Promise<void> {
        if (this.hasWarmSnapshotState(key, hints)) {
            return;
        }

        const resolved = resolveSpacetimeStateIds(key, {
            worldId: hints?.worldId ?? this.worldId,
            displayName: hints?.displayName,
            principalId: hints?.principalId,
            worldCharacterId: hints?.worldCharacterId,
        });

        let worldCharacter =
            resolved.worldCharacterId.length > 0
                ? await this.options.controlPlane.getWorldCharacter(resolved.worldCharacterId)
                : undefined;
        if (!worldCharacter) {
            worldCharacter = await this.options.controlPlane.getWorldCharacterBySaveKey(
                resolved.worldId,
                key,
            );
        }
        if (worldCharacter?.save_key) {
            this.worldCharacterIdsBySaveKey.set(worldCharacter.save_key, worldCharacter.world_character_id);
        }

        const snapshot =
            worldCharacter?.world_character_id
                ? await this.options.controlPlane.getPlayerSnapshot(worldCharacter.world_character_id)
                : await this.options.controlPlane.getPlayerSnapshotBySaveKey(resolved.worldId, key);

        if (snapshot) {
            this.worldCharacterIdsBySaveKey.set(key, snapshot.world_character_id);
            this.cacheSnapshotRow(snapshot.world_character_id, snapshot.persistent_vars_json);
        }
    }

    applyToPlayer(player: PlayerState, key: string): void {
        const resolved = this.resolveStateIdsForPlayer(player, key);
        const snapshot = mergePersistentVars(
            this.defaults,
            this.snapshotsByWorldCharacterId.get(resolved.worldCharacterId),
        );
        player.applyPersistentVars(snapshot);
    }

    hasKey(key: string): boolean {
        const worldCharacterId = this.worldCharacterIdsBySaveKey.get(key);
        return worldCharacterId !== undefined && this.snapshotsByWorldCharacterId.has(worldCharacterId);
    }

    saveSnapshot(key: string, player: PlayerState): void {
        const snapshot = player.exportPersistentVars();
        this.captureSnapshot(key, player, snapshot);
        this.enqueueWrite(async () => {
            await this.writeSnapshot(key, player, snapshot);
        });
    }

    savePlayers(entries: Array<{ key: string; player: PlayerState }>): void {
        if (entries.length === 0) return;
        const pending = entries.map(({ key, player }) => {
            const snapshot = player.exportPersistentVars();
            this.captureSnapshot(key, player, snapshot);
            return { key, player, snapshot };
        });
        this.enqueueWrite(async () => {
            for (const entry of pending) {
                await this.writeSnapshot(entry.key, entry.player, entry.snapshot);
            }
        });
    }

    private hasWarmSnapshotState(key: string, hints?: PersistenceIdentityHints): boolean {
        const worldCharacterId =
            hints?.worldCharacterId ??
            this.worldCharacterIdsBySaveKey.get(key);
        if (!worldCharacterId) return false;
        return this.snapshotsByWorldCharacterId.has(worldCharacterId);
    }

    private resolveStateIdsForPlayer(player: PlayerState, key: string) {
        const resolved = resolveSpacetimeStateIds(key, {
            worldId: this.worldId,
            displayName: player.name,
            principalId: player.__principalId,
            worldCharacterId: player.__worldCharacterId,
        });
        player.__principalId = resolved.principalId;
        player.__worldCharacterId = resolved.worldCharacterId;
        this.worldCharacterIdsBySaveKey.set(key, resolved.worldCharacterId);
        return resolved;
    }

    private captureSnapshot(key: string, player: PlayerState, snapshot: PlayerPersistentVars): void {
        const resolved = this.resolveStateIdsForPlayer(player, key);
        this.snapshotsByWorldCharacterId.set(resolved.worldCharacterId, snapshot);
    }

    private async writeSnapshot(
        key: string,
        player: PlayerState,
        snapshot: PlayerPersistentVars,
    ): Promise<void> {
        const resolved = this.resolveStateIdsForPlayer(player, key);
        const timestamp = nowMicros();

        await this.options.controlPlane.upsertWorld({
            world_id: resolved.worldId,
            name: this.worldName,
            gamemode_id: this.gamemodeId,
            status: "active",
            release_id: undefined,
            owner_principal_id: undefined,
            metadata_json: undefined,
            created_at: timestamp,
            updated_at: timestamp,
        });
        await this.options.controlPlane.upsertPrincipal({
            principal_id: resolved.principalId,
            principal_kind: player.agent ? "agent" : "human",
            canonical_name: resolved.canonicalName,
            created_at: timestamp,
            updated_at: timestamp,
        });
        await this.options.controlPlane.upsertWorldCharacter({
            world_character_id: resolved.worldCharacterId,
            world_id: resolved.worldId,
            principal_id: resolved.principalId,
            display_name: resolved.displayName,
            save_key: key,
            branch_kind: resolved.branchKind,
            created_at: timestamp,
            last_seen_at: timestamp,
        });
        await this.options.controlPlane.putPlayerSnapshot({
            world_character_id: resolved.worldCharacterId,
            world_id: resolved.worldId,
            principal_id: resolved.principalId,
            snapshot_version: SNAPSHOT_VERSION,
            persistent_vars_json: JSON.stringify(snapshot),
            updated_at: timestamp,
        });
    }

    private cacheSnapshotRow(worldCharacterId: string, persistentVarsJson: string): void {
        try {
            this.snapshotsByWorldCharacterId.set(
                worldCharacterId,
                JSON.parse(persistentVarsJson) as PlayerPersistentVars,
            );
        } catch (error) {
            logger.warn(
                `[spacetime] failed to parse snapshot for ${worldCharacterId}`,
                error,
            );
        }
    }

    private enqueueWrite(task: () => Promise<void>): void {
        this.writeChain = this.writeChain
            .then(task)
            .catch((error) => {
                logger.error("[spacetime] player snapshot write failed", error);
            });
    }
}
