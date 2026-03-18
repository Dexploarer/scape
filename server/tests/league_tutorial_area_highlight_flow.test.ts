import assert from "assert";
import { describe, it } from "vitest";

import {
    VARBIT_LEAGUE_AREA_SELECTION_0,
    VARBIT_LEAGUE_TUTORIAL_COMPLETED,
    VARBIT_LEAGUE_TYPE,
} from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { leagueWidgetModule } from "../src/game/scripts/modules/leagueWidgets";
import { type ScriptServices, type WidgetEventPayload } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { createTestScriptServices } from "./scriptServices";

const LEAGUE_AREAS_GROUP_ID = 512;
const SIDE_JOURNAL_GROUP_ID = 629;
const COMP_KARAMJA_SHIELD = 46;
const COMP_AREAS_CLOSE_BUTTON = 5;
const COMP_SELECT_BUTTON = 82;
const COMP_SELECT_BACK = 83;
const COMP_AREAS_CANCEL_BUTTON = 60;
const COMP_AREAS_CONFIRM_BUTTON = 61;

const SCRIPT_UI_HIGHLIGHT = 8478;
const SCRIPT_UI_HIGHLIGHT_CLEAR = 8484;
const UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL = 10;
const UI_HIGHLIGHT_ID_KARAMJA_SHIELD = 2;
const UI_HIGHLIGHT_ID_UNLOCK_BUTTON = 3;
const UI_HIGHLIGHT_ID_RELICS_BUTTON = 4;
const UI_HIGHLIGHT_ID_AREAS_CLOSE_BUTTON = 17;

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

type CapturedWidgetEvent = WidgetEventPayload & { playerId: number };

type Harness = {
    runtime: ScriptRuntime;
    scheduler: ScriptScheduler;
    widgetEvents: CapturedWidgetEvent[];
    player: PlayerState;
    tick: number;
};

function createHarness(): Harness {
    const registry = new ScriptRegistry();
    const scheduler = new ScriptScheduler();
    const widgetEvents: CapturedWidgetEvent[] = [];

    const player = new PlayerState(1, 3200, 3200, 0);
    const varbits: Record<number, number> = {};
    player.setVarbitValue = (id: number, value: number) => {
        varbits[id] = value;
    };
    player.getVarbitValue = (id: number) => varbits[id] ?? 0;

    player.setVarbitValue(VARBIT_LEAGUE_TYPE, 5);
    player.setVarbitValue(VARBIT_LEAGUE_TUTORIAL_COMPLETED, 7);
    player.setVarbitValue(VARBIT_LEAGUE_AREA_SELECTION_0, 1); // Misthalin starter area

    const services: ScriptServices = createTestScriptServices();
    services.logger = silentLogger;
    services.queueWidgetEvent = (playerId: number, event: WidgetEventPayload) => {
        widgetEvents.push({ ...event, playerId });
    };
    services.queueVarp = () => {};
    services.queueVarbit = () => {};

    const runtime = new ScriptRuntime({ registry, scheduler, services });
    runtime.loadModule(leagueWidgetModule);

    return { runtime, scheduler, widgetEvents, player, tick: 1 };
}

function clickAreaWidget(harness: Harness, childId: number, option = "Select", target = ""): void {
    harness.runtime.queueWidgetAction({
        tick: harness.tick,
        player: harness.player,
        widgetId: (LEAGUE_AREAS_GROUP_ID << 16) | childId,
        groupId: LEAGUE_AREAS_GROUP_ID,
        childId,
        option,
        target,
    });
    harness.scheduler.process(harness.tick);
    harness.tick++;
}

describe("Leagues tutorial areas highlight flow", () => {
    it("Back re-targets highlight from Confirm to Karamja shield", () => {
        const harness = createHarness();
        const karamjaShieldUid = (LEAGUE_AREAS_GROUP_ID << 16) | COMP_KARAMJA_SHIELD;

        clickAreaWidget(harness, COMP_KARAMJA_SHIELD, "View", "Karamja");
        clickAreaWidget(harness, COMP_SELECT_BUTTON, "Unlock", "Karamja");
        harness.widgetEvents.length = 0;

        clickAreaWidget(harness, COMP_SELECT_BACK, "Back", "");

        const clearUnlock = harness.widgetEvents.find(
            (e: any) =>
                e.action === "run_script" &&
                e.scriptId === SCRIPT_UI_HIGHLIGHT_CLEAR &&
                e.args?.[0] === UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL &&
                e.args?.[1] === UI_HIGHLIGHT_ID_UNLOCK_BUTTON,
        );
        const highlightShield = harness.widgetEvents.find(
            (e: any) =>
                e.action === "run_script" &&
                e.scriptId === SCRIPT_UI_HIGHLIGHT &&
                e.args?.[0] === UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL &&
                e.args?.[1] === UI_HIGHLIGHT_ID_KARAMJA_SHIELD &&
                e.args?.[2] === karamjaShieldUid,
        );

        assert.ok(clearUnlock, "Expected unlock/confirm highlight to be cleared on Back");
        assert.ok(highlightShield, "Expected Karamja shield highlight after Back to map view");
    });

    it("Cancel re-targets highlight from Confirm back to Unlock button", () => {
        const harness = createHarness();
        const selectButtonUid = (LEAGUE_AREAS_GROUP_ID << 16) | COMP_SELECT_BUTTON;

        clickAreaWidget(harness, COMP_KARAMJA_SHIELD, "View", "Karamja");
        clickAreaWidget(harness, COMP_SELECT_BUTTON, "Unlock", "Karamja");
        harness.widgetEvents.length = 0;

        clickAreaWidget(harness, COMP_AREAS_CANCEL_BUTTON, "Cancel", "");

        const highlightUnlock = harness.widgetEvents.find(
            (e: any) =>
                e.action === "run_script" &&
                e.scriptId === SCRIPT_UI_HIGHLIGHT &&
                e.args?.[0] === UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL &&
                e.args?.[1] === UI_HIGHLIGHT_ID_UNLOCK_BUTTON &&
                e.args?.[2] === selectButtonUid,
        );

        assert.ok(highlightUnlock, "Expected Unlock button highlight after confirm Cancel");
    });

    it("Closing Areas after unlocking Karamja re-targets highlight to Relics", () => {
        const harness = createHarness();
        const relicsButtonUid = (656 << 16) | 44;

        harness.player.widgets.open(SIDE_JOURNAL_GROUP_ID, {
            targetUid: 0,
            type: 1,
            modal: false,
        });

        clickAreaWidget(harness, COMP_KARAMJA_SHIELD, "View", "Karamja");
        clickAreaWidget(harness, COMP_SELECT_BUTTON, "Unlock", "Karamja");
        clickAreaWidget(harness, COMP_AREAS_CONFIRM_BUTTON, "Confirm", "");
        harness.widgetEvents.length = 0;

        clickAreaWidget(harness, COMP_AREAS_CLOSE_BUTTON, "Close", "");

        const clearAreasClose = harness.widgetEvents.find(
            (e: any) =>
                e.action === "run_script" &&
                e.scriptId === SCRIPT_UI_HIGHLIGHT_CLEAR &&
                e.args?.[0] === UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL &&
                e.args?.[1] === UI_HIGHLIGHT_ID_AREAS_CLOSE_BUTTON,
        );
        const highlightRelics = harness.widgetEvents.find(
            (e: any) =>
                e.action === "run_script" &&
                e.scriptId === SCRIPT_UI_HIGHLIGHT &&
                e.args?.[0] === UI_HIGHLIGHT_KIND_LEAGUE_TUTORIAL &&
                e.args?.[1] === UI_HIGHLIGHT_ID_RELICS_BUTTON &&
                e.args?.[2] === relicsButtonUid,
        );

        assert.ok(clearAreasClose, "Expected Areas close button highlight to be cleared");
        assert.ok(highlightRelics, "Expected Relics button highlight after closing Areas");
    });
});
