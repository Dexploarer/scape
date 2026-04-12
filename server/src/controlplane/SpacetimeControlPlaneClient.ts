import { logger } from "../utils/logger";

import {
    DbConnection,
    type ErrorContext,
} from "./module_bindings";
import type {
    ControlPlaneClient,
    ControlPlaneLoginAccountRecord,
    ControlPlanePlayerSnapshotRecord,
    ControlPlanePrincipalRecord,
    ControlPlaneWorldCharacterRecord,
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
        return rows.map((row) => ({
            username: row.username,
            principalId: row.principalId,
            authMode: row.authMode,
            passwordHash: row.passwordHash ?? undefined,
            passwordSalt: row.passwordSalt ?? undefined,
            passwordAlgorithm: row.passwordAlgorithm ?? undefined,
            externalSubject: row.externalSubject ?? undefined,
            banned: !!row.banned,
            banReason: row.banReason ?? undefined,
            createdAt: fromU64(row.createdAt),
            lastLoginAt: row.lastLoginAt != null ? fromU64(row.lastLoginAt) : undefined,
        }));
    }

    async listWorldCharactersForWorld(
        worldId: string,
    ): Promise<ControlPlaneWorldCharacterRecord[]> {
        const rows = await this.connection.procedures.listWorldCharactersForWorld({
            worldId,
        });
        return rows.map((row) => ({
            worldCharacterId: row.worldCharacterId,
            worldId: row.worldId,
            principalId: row.principalId,
            displayName: row.displayName,
            saveKey: row.saveKey ?? undefined,
            branchKind: row.branchKind ?? undefined,
            createdAt: fromU64(row.createdAt),
            lastSeenAt: row.lastSeenAt != null ? fromU64(row.lastSeenAt) : undefined,
        }));
    }

    async listPlayerSnapshotsForWorld(
        worldId: string,
    ): Promise<ControlPlanePlayerSnapshotRecord[]> {
        const rows = await this.connection.procedures.listPlayerSnapshotsForWorld({
            worldId,
        });
        return rows.map((row) => ({
            worldCharacterId: row.worldCharacterId,
            worldId: row.worldId,
            principalId: row.principalId,
            snapshotVersion: row.snapshotVersion,
            persistentVarsJson: row.persistentVarsJson,
            updatedAt: fromU64(row.updatedAt),
        }));
    }

    async upsertPrincipal(record: ControlPlanePrincipalRecord): Promise<void> {
        await this.connection.reducers.upsertPrincipal({
            principalId: record.principalId,
            principalKind: record.principalKind,
            canonicalName: record.canonicalName,
            createdAt: toU64(record.createdAt),
            updatedAt: toU64(record.updatedAt),
        });
    }

    async upsertLoginAccount(record: ControlPlaneLoginAccountRecord): Promise<void> {
        await this.connection.reducers.upsertLoginAccount({
            username: record.username,
            principalId: record.principalId,
            authMode: record.authMode,
            passwordHash: record.passwordHash,
            passwordSalt: record.passwordSalt,
            passwordAlgorithm: record.passwordAlgorithm,
            externalSubject: record.externalSubject,
            banned: !!record.banned,
            banReason: record.banReason,
            createdAt: toU64(record.createdAt),
            lastLoginAt: record.lastLoginAt != null ? toU64(record.lastLoginAt) : undefined,
        });
    }

    async upsertWorldCharacter(record: ControlPlaneWorldCharacterRecord): Promise<void> {
        await this.connection.reducers.upsertWorldCharacter({
            worldCharacterId: record.worldCharacterId,
            worldId: record.worldId,
            principalId: record.principalId,
            displayName: record.displayName,
            saveKey: record.saveKey,
            branchKind: record.branchKind,
            createdAt: toU64(record.createdAt),
            lastSeenAt: record.lastSeenAt != null ? toU64(record.lastSeenAt) : undefined,
        });
    }

    async putPlayerSnapshot(record: ControlPlanePlayerSnapshotRecord): Promise<void> {
        await this.connection.reducers.putPlayerSnapshot({
            worldCharacterId: record.worldCharacterId,
            worldId: record.worldId,
            principalId: record.principalId,
            snapshotVersion: record.snapshotVersion,
            persistentVarsJson: record.persistentVarsJson,
            updatedAt: toU64(record.updatedAt),
        });
    }

    async touchLoginAccount(username: string, lastLoginAt?: number): Promise<void> {
        await this.connection.reducers.touchLoginAccount({
            username,
            lastLoginAt: lastLoginAt != null ? toU64(lastLoginAt) : undefined,
        });
    }

    async touchWorldCharacter(
        worldCharacterId: string,
        lastSeenAt?: number,
    ): Promise<void> {
        await this.connection.reducers.touchWorldCharacter({
            worldCharacterId,
            lastSeenAt: lastSeenAt != null ? toU64(lastSeenAt) : undefined,
        });
    }

    dispose(): void {
        this.connection.disconnect();
    }
}
