import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { PlayerPersistence } from "../server/src/game/state/PlayerPersistence";
import { createPersistenceProvider } from "../server/src/game/state/createPersistenceProvider";

const tempDirs: string[] = [];

function makeTempDir(label: string): string {
    const dir = join(
        tmpdir(),
        `scape-persistence-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
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
});
