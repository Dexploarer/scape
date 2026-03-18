import assert from "assert";
import { describe, it } from "vitest";

import {
    VARBIT_LEAGUE_TUTORIAL_COMPLETED,
    VARBIT_LEAGUE_TYPE,
    VARP_LEAGUE_GENERAL,
} from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { leagueWidgetModule } from "../src/game/scripts/modules/leagueWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { createTestScriptServices } from "./scriptServices";

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

describe("Leagues tutorial - Tasks step varp packing", () => {
    it("clicking Tasks at step 5 advances to 7 and updates VARP_LEAGUE_GENERAL (2606)", () => {
        const registry = new ScriptRegistry();
        const scheduler = new ScriptScheduler();

        const player = new PlayerState(1, 3200, 3200, 0);
        const varbits: Record<number, number> = {};
        player.setVarbitValue = (id: number, value: number) => {
            varbits[id] = value;
        };
        player.getVarbitValue = (id: number) => varbits[id] ?? 0;

        // Leagues V defaults for this test.
        player.setVarbitValue(VARBIT_LEAGUE_TYPE, 5);
        player.setVarbitValue(VARBIT_LEAGUE_TUTORIAL_COMPLETED, 5);
        player.setVarpValue(VARP_LEAGUE_GENERAL, 0);

        const services: ScriptServices = createTestScriptServices();
        services.logger = silentLogger;
        services.queueVarbit = () => {};
        services.queueWidgetEvent = () => {};

        const runtime = new ScriptRuntime({ registry, scheduler, services });
        runtime.loadModule(leagueWidgetModule);

        // Click "Tasks" in Leagues side panel (group 656, child 36).
        runtime.queueWidgetAction({
            tick: 1,
            player,
            widgetId: (656 << 16) | 36,
            groupId: 656,
            childId: 36,
            option: "View",
            target: "Tasks",
        });
        scheduler.process(1);

        assert.strictEqual(
            player.getVarbitValue(VARBIT_LEAGUE_TUTORIAL_COMPLETED),
            7,
            "Expected tutorial step to advance 5 -> 7",
        );

        const packed = player.getVarpValue(VARP_LEAGUE_GENERAL);
        assert.strictEqual(packed & 1, 1, "Expected league_general bit0 (enabled) to be set");
        assert.strictEqual((packed >>> 1) & 0xf, 5, "Expected league_type bits to equal 5");
        assert.strictEqual((packed >>> 13) & 0x1f, 7, "Expected tutorial bits to equal 7");
    });
});
