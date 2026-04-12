import { join, resolve } from "node:path";

import { getGamemodeDataDir } from "../gamemodes/GamemodeRegistry";

import { PlayerPersistence } from "./PlayerPersistence";
import type { ManagedPersistenceProvider } from "./PersistenceProvider";
import { normalizeWorldScopeId } from "./PlayerSessionKeys";
import { SpacetimeControlPlaneClient } from "../../controlplane/SpacetimeControlPlaneClient";
import { SpacetimePersistenceProvider } from "./SpacetimePersistenceProvider";

export interface CreatePersistenceProviderOptions {
    gamemodeId: string;
    worldId: string;
    provider?: ManagedPersistenceProvider;
    dataDir?: string;
    storePath?: string;
    defaultsPath?: string;
    spacetimeUri?: string;
    spacetimeDatabase?: string;
    spacetimeAuthToken?: string;
}

function resolveScopedPersistencePaths(options: CreatePersistenceProviderOptions): {
    dataDir: string;
    storePath?: string;
    defaultsPath?: string;
} {
    const gamemodeDir = options.dataDir
        ? resolve(options.dataDir)
        : getGamemodeDataDir(options.gamemodeId);
    const normalizedWorldId = normalizeWorldScopeId(options.worldId) ?? options.gamemodeId;
    const legacyWorldId = normalizeWorldScopeId(options.gamemodeId) ?? options.gamemodeId;

    if (options.storePath || options.defaultsPath) {
        return {
            dataDir: gamemodeDir,
            storePath: options.storePath,
            defaultsPath: options.defaultsPath,
        };
    }

    if (normalizedWorldId === legacyWorldId) {
        return {
            dataDir: gamemodeDir,
        };
    }

    const worldDir = join(gamemodeDir, "worlds", normalizedWorldId);
    return {
        dataDir: worldDir,
        storePath: join(worldDir, "player-state.json"),
        defaultsPath: join(gamemodeDir, "player-defaults.json"),
    };
}

function createScopedJsonPersistence(options: CreatePersistenceProviderOptions): ManagedPersistenceProvider {
    const paths = resolveScopedPersistencePaths(options);
    return new PlayerPersistence(paths);
}

export function createPersistenceProvider(
    options: CreatePersistenceProviderOptions,
): ManagedPersistenceProvider {
    if (options.provider) {
        return options.provider;
    }
    return createScopedJsonPersistence(options);
}

export async function loadPersistenceProvider(
    options: CreatePersistenceProviderOptions,
): Promise<ManagedPersistenceProvider> {
    if (options.provider) {
        return options.provider;
    }

    const spacetimeUri = options.spacetimeUri?.trim();
    const spacetimeDatabase = options.spacetimeDatabase?.trim();
    if (spacetimeUri && spacetimeDatabase) {
        const paths = resolveScopedPersistencePaths(options);
        const client = await SpacetimeControlPlaneClient.connect({
            uri: spacetimeUri,
            database: spacetimeDatabase,
            authToken: options.spacetimeAuthToken,
        });
        return await SpacetimePersistenceProvider.create({
            client,
            worldId: normalizeWorldScopeId(options.worldId) ?? options.gamemodeId,
            defaultsPath: paths.defaultsPath,
        });
    }

    return createScopedJsonPersistence(options);
}
