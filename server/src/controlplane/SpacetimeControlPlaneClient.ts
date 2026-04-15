import { logger } from "../utils/logger";

import {
    type ControlPlaneClient,
    type PutLiveEventPayload,
    type PutPlayerSnapshotPayload,
    type PutTrajectoryStepPayload,
    type TouchLoginAccountPayload,
    type TouchWorldCharacterPayload,
    type UpsertLoginAccountPayload,
    type UpsertPrincipalPayload,
    type UpsertTrajectoryEpisodePayload,
    type UpsertWorldCharacterPayload,
    type UpsertWorldPayload,
} from "./ControlPlaneClient";
import {
    DbConnection,
    type LoginAccountRow,
    type PlayerSnapshotRow,
    type WorldCharacterRow,
} from "./moduleBindings";

export interface SpacetimeControlPlaneClientOptions {
    uri: string;
    databaseName: string;
    token?: string;
    connectTimeoutMs?: number;
}

export class SpacetimeControlPlaneClient implements ControlPlaneClient {
    private connection?: DbConnection;
    private readyPromise?: Promise<void>;

    constructor(private readonly options: SpacetimeControlPlaneClientOptions) {}

    async initialize(): Promise<void> {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                fn();
            };

            const timeout = setTimeout(() => {
                finish(() => {
                    reject(
                        new Error(
                            `Timed out connecting to SpacetimeDB at ${this.options.uri} (${this.options.databaseName})`,
                        ),
                    );
                });
            }, this.options.connectTimeoutMs ?? 10000);

            try {
                this.connection = DbConnection.builder()
                    .withUri(this.options.uri)
                    .withDatabaseName(this.options.databaseName)
                    .withToken(this.options.token)
                    .onConnect((_connection, identity) => {
                        logger.info(
                            `[spacetime] connected to ${this.options.databaseName} as ${identity.toHexString()}`,
                        );
                        finish(resolve);
                    })
                    .onConnectError((_ctx, error) => {
                        finish(() => reject(error));
                    })
                    .onDisconnect((_ctx, error) => {
                        if (error) {
                            logger.warn("[spacetime] disconnected", error);
                        } else {
                            logger.info("[spacetime] disconnected");
                        }
                    })
                    .build();
            } catch (error) {
                finish(() => reject(error instanceof Error ? error : new Error(String(error))));
            }
        });

        return this.readyPromise;
    }

    async disconnect(): Promise<void> {
        await this.readyPromise?.catch(() => undefined);
        this.connection?.disconnect();
        this.connection = undefined;
        this.readyPromise = undefined;
    }

    private async getConnection(): Promise<DbConnection> {
        await this.initialize();
        if (!this.connection) {
            throw new Error("SpacetimeDB connection is not available.");
        }
        return this.connection;
    }

    async listLoginAccounts(): Promise<LoginAccountRow[]> {
        const connection = await this.getConnection();
        return connection.procedures.listLoginAccounts({});
    }

    async getLoginAccount(username: string): Promise<LoginAccountRow | undefined> {
        const connection = await this.getConnection();
        return connection.procedures.getLoginAccount({ username });
    }

    async listWorldCharactersForWorld(worldId: string): Promise<WorldCharacterRow[]> {
        const connection = await this.getConnection();
        return connection.procedures.listWorldCharactersForWorld({ world_id: worldId });
    }

    async getWorldCharacter(worldCharacterId: string): Promise<WorldCharacterRow | undefined> {
        const connection = await this.getConnection();
        return connection.procedures.getWorldCharacter({ world_character_id: worldCharacterId });
    }

    async getWorldCharacterBySaveKey(
        worldId: string,
        saveKey: string,
    ): Promise<WorldCharacterRow | undefined> {
        const connection = await this.getConnection();
        return connection.procedures.getWorldCharacterBySaveKey({
            world_id: worldId,
            save_key: saveKey,
        });
    }

    async listPlayerSnapshotsForWorld(worldId: string): Promise<PlayerSnapshotRow[]> {
        const connection = await this.getConnection();
        return connection.procedures.listPlayerSnapshotsForWorld({ world_id: worldId });
    }

    async getPlayerSnapshot(worldCharacterId: string): Promise<PlayerSnapshotRow | undefined> {
        const connection = await this.getConnection();
        return connection.procedures.getPlayerSnapshot({ world_character_id: worldCharacterId });
    }

    async getPlayerSnapshotBySaveKey(
        worldId: string,
        saveKey: string,
    ): Promise<PlayerSnapshotRow | undefined> {
        const connection = await this.getConnection();
        return connection.procedures.getPlayerSnapshotBySaveKey({
            world_id: worldId,
            save_key: saveKey,
        });
    }

    async upsertWorld(payload: UpsertWorldPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.upsertWorld(payload);
    }

    async upsertPrincipal(payload: UpsertPrincipalPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.upsertPrincipal(payload);
    }

    async upsertLoginAccount(payload: UpsertLoginAccountPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.upsertLoginAccount(payload);
    }

    async touchLoginAccount(payload: TouchLoginAccountPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.touchLoginAccount(payload);
    }

    async upsertWorldCharacter(payload: UpsertWorldCharacterPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.upsertWorldCharacter(payload);
    }

    async touchWorldCharacter(payload: TouchWorldCharacterPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.touchWorldCharacter(payload);
    }

    async putPlayerSnapshot(payload: PutPlayerSnapshotPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.putPlayerSnapshot(payload);
    }

    async upsertTrajectoryEpisode(
        payload: UpsertTrajectoryEpisodePayload,
    ): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.upsertTrajectoryEpisode(payload);
    }

    async putTrajectoryStep(payload: PutTrajectoryStepPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.putTrajectoryStep(payload);
    }

    async putLiveEvent(payload: PutLiveEventPayload): Promise<void> {
        const connection = await this.getConnection();
        await connection.reducers.putLiveEvent(payload);
    }
}
