import { logger } from "../utils/logger";

import {
    DbConnection,
    type ErrorContext,
} from "./moduleBindings";
import type {
    ControlPlaneClient,
    ControlPlaneLoginAccountRecord,
    ControlPlanePlayerSnapshotRecord,
    ControlPlanePrincipalRecord,
    ControlPlaneWorldCharacterRecord,
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
} from "./ControlPlaneClient";

export interface SpacetimeControlPlaneClientOptions {
    uri: string;
    database: string;
    authToken?: string;
}

function requireText(label: string, value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(`${label} is required`);
    }
    return trimmed;
}

function toU64(value: number): bigint {
    if (!Number.isFinite(value) || value < 0) {
        return 0n;
    }
    return BigInt(Math.floor(value));
}

function fromU64(value: bigint): number {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new Error(`SpacetimeDB returned an unsafe u64 value: ${value.toString()}`);
    }
    return numeric;
}

function isSnakeCasePrincipalPayload(
    value: ControlPlanePrincipalRecord | UpsertPrincipalPayload,
): value is UpsertPrincipalPayload {
    return "principal_id" in value;
}

function isSnakeCaseLoginPayload(
    value: ControlPlaneLoginAccountRecord | UpsertLoginAccountPayload,
): value is UpsertLoginAccountPayload {
    return "principal_id" in value || "auth_mode" in value;
}

function isSnakeCaseWorldCharacterPayload(
    value: ControlPlaneWorldCharacterRecord | UpsertWorldCharacterPayload,
): value is UpsertWorldCharacterPayload {
    return "world_character_id" in value;
}

function isSnakeCaseSnapshotPayload(
    value: ControlPlanePlayerSnapshotRecord | PutPlayerSnapshotPayload,
): value is PutPlayerSnapshotPayload {
    return "world_character_id" in value;
}

function fromLoginAccountRow(row: {
    username: string;
    principal_id: string;
    auth_mode: string;
    password_hash?: string | null;
    password_salt?: string | null;
    password_algorithm?: string | null;
    external_subject?: string | null;
    banned: boolean;
    ban_reason?: string | null;
    created_at: bigint;
    last_login_at?: bigint | null;
}): ControlPlaneLoginAccountRecord {
    return {
        username: row.username,
        principalId: row.principal_id,
        authMode: row.auth_mode,
        passwordHash: row.password_hash ?? undefined,
        passwordSalt: row.password_salt ?? undefined,
        passwordAlgorithm: row.password_algorithm ?? undefined,
        externalSubject: row.external_subject ?? undefined,
        banned: !!row.banned,
        banReason: row.ban_reason ?? undefined,
        createdAt: fromU64(row.created_at),
        lastLoginAt: row.last_login_at != null ? fromU64(row.last_login_at) : undefined,
    };
}

function fromWorldCharacterRow(row: {
    world_character_id: string;
    world_id: string;
    principal_id: string;
    display_name: string;
    save_key?: string | null;
    branch_kind?: string | null;
    created_at: bigint;
    last_seen_at?: bigint | null;
}): ControlPlaneWorldCharacterRecord {
    return {
        worldCharacterId: row.world_character_id,
        worldId: row.world_id,
        principalId: row.principal_id,
        displayName: row.display_name,
        saveKey: row.save_key ?? undefined,
        branchKind: row.branch_kind ?? undefined,
        createdAt: fromU64(row.created_at),
        lastSeenAt: row.last_seen_at != null ? fromU64(row.last_seen_at) : undefined,
    };
}

function fromSnapshotRow(row: {
    world_character_id: string;
    world_id: string;
    principal_id: string;
    snapshot_version: number;
    persistent_vars_json: string;
    updated_at: bigint;
}): ControlPlanePlayerSnapshotRecord {
    return {
        worldCharacterId: row.world_character_id,
        worldId: row.world_id,
        principalId: row.principal_id,
        snapshotVersion: row.snapshot_version,
        persistentVarsJson: row.persistent_vars_json,
        updatedAt: fromU64(row.updated_at),
    };
}

export class SpacetimeControlPlaneClient implements ControlPlaneClient {
    private constructor(private readonly connection: DbConnection) {}

    static async connect(
        options: SpacetimeControlPlaneClientOptions,
    ): Promise<SpacetimeControlPlaneClient> {
        const uri = requireText("SpacetimeDB URI", options.uri);
        const database = requireText("SpacetimeDB database", options.database);

        let resolveReady!: () => void;
        let rejectReady!: (error: Error) => void;
        const ready = new Promise<void>((resolve, reject) => {
            resolveReady = resolve;
            rejectReady = reject;
        });

        const onConnectError = (_ctx: ErrorContext, error: Error) => {
            rejectReady(error);
        };

        const builder = DbConnection.builder()
            .withUri(uri)
            .withDatabaseName(database)
            .withCompression("none")
            .withLightMode(true)
            .onConnect(() => {
                resolveReady();
            })
            .onConnectError(onConnectError)
            .onDisconnect((_ctx, error) => {
                if (error) {
                    logger.warn("[control-plane] disconnected from SpacetimeDB", error);
                } else {
                    logger.info("[control-plane] disconnected from SpacetimeDB");
                }
            });

        if (options.authToken?.trim()) {
            builder.withToken(options.authToken.trim());
        }

        const connection = builder.build();
        await ready;
        return new SpacetimeControlPlaneClient(connection);
    }

    async listLoginAccounts(): Promise<ControlPlaneLoginAccountRecord[]> {
        const rows = await this.connection.procedures.listLoginAccounts({});
        return rows.map((row) => fromLoginAccountRow(row));
    }

    async getLoginAccount(username: string): Promise<ControlPlaneLoginAccountRecord | undefined> {
        const row = await this.connection.procedures.getLoginAccount({ username });
        return row ? fromLoginAccountRow(row) : undefined;
    }

    async listWorldCharactersForWorld(
        worldId: string,
    ): Promise<ControlPlaneWorldCharacterRecord[]> {
        const rows = await this.connection.procedures.listWorldCharactersForWorld({
            world_id: worldId,
        });
        return rows.map((row) => fromWorldCharacterRow(row));
    }

    async getWorldCharacter(
        worldCharacterId: string,
    ): Promise<ControlPlaneWorldCharacterRecord | undefined> {
        const row = await this.connection.procedures.getWorldCharacter({
            world_character_id: worldCharacterId,
        });
        return row ? fromWorldCharacterRow(row) : undefined;
    }

    async getWorldCharacterBySaveKey(
        worldId: string,
        saveKey: string,
    ): Promise<ControlPlaneWorldCharacterRecord | undefined> {
        const row = await this.connection.procedures.getWorldCharacterBySaveKey({
            world_id: worldId,
            save_key: saveKey,
        });
        return row ? fromWorldCharacterRow(row) : undefined;
    }

    async listPlayerSnapshotsForWorld(
        worldId: string,
    ): Promise<ControlPlanePlayerSnapshotRecord[]> {
        const rows = await this.connection.procedures.listPlayerSnapshotsForWorld({
            world_id: worldId,
        });
        return rows.map((row) => fromSnapshotRow(row));
    }

    async getPlayerSnapshot(
        worldCharacterId: string,
    ): Promise<ControlPlanePlayerSnapshotRecord | undefined> {
        const row = await this.connection.procedures.getPlayerSnapshot({
            world_character_id: worldCharacterId,
        });
        return row ? fromSnapshotRow(row) : undefined;
    }

    async getPlayerSnapshotBySaveKey(
        worldId: string,
        saveKey: string,
    ): Promise<ControlPlanePlayerSnapshotRecord | undefined> {
        const row = await this.connection.procedures.getPlayerSnapshotBySaveKey({
            world_id: worldId,
            save_key: saveKey,
        });
        return row ? fromSnapshotRow(row) : undefined;
    }

    async upsertWorld(payload: UpsertWorldPayload): Promise<void> {
        await this.connection.reducers.upsertWorld({
            world_id: payload.world_id,
            name: payload.name,
            gamemode_id: payload.gamemode_id,
            status: payload.status,
            release_id: payload.release_id,
            owner_principal_id: payload.owner_principal_id,
            metadata_json: payload.metadata_json,
            created_at: payload.created_at,
            updated_at: payload.updated_at,
        });
    }

    async upsertPrincipal(
        record: ControlPlanePrincipalRecord | UpsertPrincipalPayload,
    ): Promise<void> {
        const payload = isSnakeCasePrincipalPayload(record)
            ? record
            : {
                  principal_id: record.principalId,
                  principal_kind: record.principalKind,
                  canonical_name: record.canonicalName,
                  created_at: toU64(record.createdAt),
                  updated_at: toU64(record.updatedAt),
              };
        await this.connection.reducers.upsertPrincipal(payload);
    }

    async upsertLoginAccount(
        record: ControlPlaneLoginAccountRecord | UpsertLoginAccountPayload,
    ): Promise<void> {
        const payload = isSnakeCaseLoginPayload(record)
            ? {
                  username: record.username,
                  principal_id: record.principal_id,
                  auth_mode: record.auth_mode,
                  password_hash: record.password_hash,
                  password_salt: record.password_salt,
                  password_algorithm: record.password_algorithm,
                  external_subject: record.external_subject,
                  banned: record.banned,
                  ban_reason: record.ban_reason,
                  created_at: record.created_at,
                  last_login_at: record.last_login_at,
              }
            : {
                  username: record.username,
                  principal_id: record.principalId,
                  auth_mode: record.authMode,
                  password_hash: record.passwordHash,
                  password_salt: record.passwordSalt,
                  password_algorithm: record.passwordAlgorithm,
                  external_subject: record.externalSubject,
                  banned: record.banned,
                  ban_reason: record.banReason,
                  created_at: toU64(record.createdAt),
                  last_login_at:
                      record.lastLoginAt != null ? toU64(record.lastLoginAt) : undefined,
              };
        await this.connection.reducers.upsertLoginAccount(payload);
    }

    async upsertWorldCharacter(
        record: ControlPlaneWorldCharacterRecord | UpsertWorldCharacterPayload,
    ): Promise<void> {
        const payload = isSnakeCaseWorldCharacterPayload(record)
            ? {
                  world_character_id: record.world_character_id,
                  world_id: record.world_id,
                  principal_id: record.principal_id,
                  display_name: record.display_name,
                  save_key: record.save_key,
                  branch_kind: record.branch_kind,
                  created_at: record.created_at,
                  last_seen_at: record.last_seen_at,
              }
            : {
                  world_character_id: record.worldCharacterId,
                  world_id: record.worldId,
                  principal_id: record.principalId,
                  display_name: record.displayName,
                  save_key: record.saveKey,
                  branch_kind: record.branchKind,
                  created_at: toU64(record.createdAt),
                  last_seen_at:
                      record.lastSeenAt != null ? toU64(record.lastSeenAt) : undefined,
              };
        await this.connection.reducers.upsertWorldCharacter(payload);
    }

    async putPlayerSnapshot(
        record: ControlPlanePlayerSnapshotRecord | PutPlayerSnapshotPayload,
    ): Promise<void> {
        const payload = isSnakeCaseSnapshotPayload(record)
            ? record
            : {
                  world_character_id: record.worldCharacterId,
                  world_id: record.worldId,
                  principal_id: record.principalId,
                  snapshot_version: record.snapshotVersion,
                  persistent_vars_json: record.persistentVarsJson,
                  updated_at: toU64(record.updatedAt),
              };
        await this.connection.reducers.putPlayerSnapshot(payload);
    }

    async upsertTrajectoryEpisode(
        payload: UpsertTrajectoryEpisodePayload,
    ): Promise<void> {
        await this.connection.reducers.upsertTrajectoryEpisode({
            episode_id: payload.episode_id,
            world_id: payload.world_id,
            principal_id: payload.principal_id,
            world_character_id: payload.world_character_id,
            agent_id: payload.agent_id,
            player_id: payload.player_id,
            session_source: payload.session_source,
            metadata_json: payload.metadata_json,
            started_at: payload.started_at,
            ended_at: payload.ended_at,
        });
    }

    async putTrajectoryStep(payload: PutTrajectoryStepPayload): Promise<void> {
        await this.connection.reducers.putTrajectoryStep({
            step_id: payload.step_id,
            episode_id: payload.episode_id,
            world_id: payload.world_id,
            principal_id: payload.principal_id,
            world_character_id: payload.world_character_id,
            player_id: payload.player_id,
            sequence: payload.sequence,
            event_kind: payload.event_kind,
            action_name: payload.action_name,
            correlation_id: payload.correlation_id,
            observation_json: payload.observation_json,
            payload_json: payload.payload_json,
            outcome_json: payload.outcome_json,
            recorded_at: payload.recorded_at,
        });
    }

    async putLiveEvent(payload: PutLiveEventPayload): Promise<void> {
        await this.connection.reducers.putLiveEvent({
            event_id: payload.event_id,
            world_id: payload.world_id,
            principal_id: payload.principal_id,
            world_character_id: payload.world_character_id,
            player_id: payload.player_id,
            source: payload.source,
            event_name: payload.event_name,
            payload_json: payload.payload_json,
            recorded_at: payload.recorded_at,
        });
    }

    async touchLoginAccount(
        username: string | TouchLoginAccountPayload,
        lastLoginAt?: number,
    ): Promise<void> {
        const payload =
            typeof username === "string"
                ? {
                      username,
                      last_login_at:
                          lastLoginAt != null ? toU64(lastLoginAt) : undefined,
                  }
                : {
                      username: username.username,
                      last_login_at: username.last_login_at,
                  };
        await this.connection.reducers.touchLoginAccount(payload);
    }

    async touchWorldCharacter(
        worldCharacterId: string | TouchWorldCharacterPayload,
        lastSeenAt?: number,
    ): Promise<void> {
        const payload =
            typeof worldCharacterId === "string"
                ? {
                      world_character_id: worldCharacterId,
                      last_seen_at:
                          lastSeenAt != null ? toU64(lastSeenAt) : undefined,
                  }
                : {
                      world_character_id: worldCharacterId.world_character_id,
                      last_seen_at: worldCharacterId.last_seen_at,
                  };
        await this.connection.reducers.touchWorldCharacter(payload);
    }

    dispose(): void {
        this.connection.disconnect();
    }
}
