import { join, resolve } from "node:path";

import { getGamemodeDataDir } from "../gamemodes/GamemodeRegistry";

import { PlayerPersistence } from "./PlayerPersistence";
import type { ManagedPersistenceProvider } from "./PersistenceProvider";
import { normalizeWorldScopeId } from "./PlayerSessionKeys";

export interface CreatePersistenceProviderOptions {
    gamemodeId: string;
    worldId: string;
    provider?: ManagedPersistenceProvider;
    dataDir?: string;
    storePath?: string;
    defaultsPath?: string;
}

function createScopedJsonPersistence(options: CreatePersistenceProviderOptions): ManagedPersistenceProvider {
    const gamemodeDir = options.dataDir
        ? resolve(options.dataDir)
        : getGamemodeDataDir(options.gamemodeId);
    const normalizedWorldId = normalizeWorldScopeId(options.worldId) ?? options.gamemodeId;
    const legacyWorldId = normalizeWorldScopeId(options.gamemodeId) ?? options.gamemodeId;

    if (options.storePath || options.defaultsPath) {
        return new PlayerPersistence({
            dataDir: gamemodeDir,
            storePath: options.storePath,
            defaultsPath: options.defaultsPath,
        });
    }

    if (normalizedWorldId === legacyWorldId) {
        return new PlayerPersistence({
            dataDir: gamemodeDir,
        });
    }

    const worldDir = join(gamemodeDir, "worlds", normalizedWorldId);
    return new PlayerPersistence({
        dataDir: worldDir,
        storePath: join(worldDir, "player-state.json"),
        defaultsPath: join(gamemodeDir, "player-defaults.json"),
    });
}

export function createPersistenceProvider(
    options: CreatePersistenceProviderOptions,
): ManagedPersistenceProvider {
    if (options.provider) {
        return options.provider;
    }
    return createScopedJsonPersistence(options);
}
