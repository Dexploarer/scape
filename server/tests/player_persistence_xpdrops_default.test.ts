import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

import { VARBIT_XPDROPS_ENABLED } from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import { PlayerPersistence } from "../src/game/state/PlayerPersistence";

function writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

(function testPlayerPersistenceDefaultsXpDropsToEnabled() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xpdrops-default-"));
    try {
        const defaultsPath = path.join(tempDir, "player-defaults.json");
        const storePath = path.join(tempDir, "player-state.json");
        writeJson(defaultsPath, {});
        writeJson(storePath, {});

        const persistence = new PlayerPersistence({ defaultsPath, storePath });
        const player = new PlayerState(1, 3094, 3107, 0);
        persistence.applyToPlayer(player, "fresh_player");

        assert.strictEqual(
            player.getVarbitValue(VARBIT_XPDROPS_ENABLED),
            1,
            "players without saved XP drop state should default to enabled",
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})();

(function testPlayerPersistencePreservesExplicitXpDropsOffState() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xpdrops-override-"));
    try {
        const defaultsPath = path.join(tempDir, "player-defaults.json");
        const storePath = path.join(tempDir, "player-state.json");
        writeJson(defaultsPath, {});
        writeJson(storePath, {
            existing_player: {
                varbits: {
                    [VARBIT_XPDROPS_ENABLED]: 0,
                },
            },
        });

        const persistence = new PlayerPersistence({ defaultsPath, storePath });
        const player = new PlayerState(2, 3094, 3107, 0);
        persistence.applyToPlayer(player, "existing_player");

        assert.strictEqual(
            player.getVarbitValue(VARBIT_XPDROPS_ENABLED),
            0,
            "explicit saved XP drop setting should override the default",
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})();
