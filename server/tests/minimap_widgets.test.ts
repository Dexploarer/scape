import assert from "assert";

import { VARBIT_XPDROPS_ENABLED } from "../../src/shared/vars";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { minimapWidgetModule } from "../src/game/scripts/modules/minimapWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { DisplayMode, getMainmodalUid } from "../src/widgets/viewport";
import { createTestScriptServices } from "./scriptServices";

const GROUP_ID = 160;
const XP_DROPS_CHILD_ID = 6;
const WIDGET_ID = (GROUP_ID << 16) | XP_DROPS_CHILD_ID;
const XP_DROPS_SETUP_GROUP_ID = 137;

type MinimapHarness = {
    services: ScriptServices;
    widgetEvents: Array<{ playerId: number; event: Record<string, unknown> }>;
    openSubs: Array<{ playerId: number; targetUid: number; groupId: number; type: number }>;
    toggleHandler: NonNullable<ReturnType<ScriptRegistry["findWidgetAction"]>>;
    setupHandler: NonNullable<ReturnType<ScriptRegistry["findWidgetAction"]>>;
};

function createHarness(): MinimapHarness {
    const registry = new ScriptRegistry();
    const widgetEvents: Array<{ playerId: number; event: Record<string, unknown> }> = [];
    const openSubs: Array<{ playerId: number; targetUid: number; groupId: number; type: number }> =
        [];
    const services: ScriptServices = createTestScriptServices();
    services.queueWidgetEvent = (playerId, event) => {
        widgetEvents.push({ playerId: playerId, event: { ...event } });
    };
    services.openSubInterface = (player, targetUid, groupId, type = 0) => {
        openSubs.push({
            playerId: player.id,
            targetUid: targetUid,
            groupId: groupId,
            type: type,
        });
    };
    minimapWidgetModule.register(registry, services);

    const toggleHandler = registry.findWidgetAction(WIDGET_ID, 1, undefined);
    assert.ok(toggleHandler, "minimap XP drops toggle handler should be registered");
    const setupHandler = registry.findWidgetAction(WIDGET_ID, 2, undefined);
    assert.ok(setupHandler, "minimap XP drops setup handler should be registered");

    return {
        services,
        widgetEvents,
        openSubs,
        toggleHandler: toggleHandler!,
        setupHandler: setupHandler!,
    };
}

function clickXpDropsOrb(harness: MinimapHarness, player: PlayerState, tick: number): void {
    harness.toggleHandler({
        tick,
        player,
        widgetId: WIDGET_ID,
        groupId: GROUP_ID,
        childId: XP_DROPS_CHILD_ID,
        opId: 1,
        services: harness.services,
    } as any);
}

(function testXpDropsOrbToggle() {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);

    // Default enabled (1) -> disabled (0)
    clickXpDropsOrb(harness, player, 1);
    assert.strictEqual(player.getVarbitValue(VARBIT_XPDROPS_ENABLED), 0);
    assert.deepStrictEqual(harness.widgetEvents[0], {
        playerId: player.id,
        event: { action: "set_hidden", uid: (161 << 16) | 7, hidden: true },
    });

    // Disabled (0) -> enabled (1)
    clickXpDropsOrb(harness, player, 2);
    assert.strictEqual(player.getVarbitValue(VARBIT_XPDROPS_ENABLED), 1);
    assert.deepStrictEqual(harness.widgetEvents[1], {
        playerId: player.id,
        event: { action: "set_hidden", uid: (161 << 16) | 7, hidden: false },
    });
})();

(function testXpDropsOrbIgnoresDuplicateDispatchInSameTick() {
    const harness = createHarness();
    const player = new PlayerState(2, 3222, 3222, 0);

    // Simulate duplicate packet dispatch for one click in the same tick.
    harness.toggleHandler({
        tick: 10,
        player,
        widgetId: WIDGET_ID,
        groupId: GROUP_ID,
        childId: XP_DROPS_CHILD_ID,
        opId: 1,
        services: harness.services,
    } as any);
    harness.toggleHandler({
        tick: 10,
        player,
        widgetId: WIDGET_ID,
        groupId: GROUP_ID,
        childId: XP_DROPS_CHILD_ID,
        opId: 1,
        services: harness.services,
    } as any);

    assert.strictEqual(player.getVarbitValue(VARBIT_XPDROPS_ENABLED), 0);
    assert.strictEqual(harness.widgetEvents.length, 1);
    assert.deepStrictEqual(harness.widgetEvents[0], {
        playerId: player.id,
        event: { action: "set_hidden", uid: (161 << 16) | 7, hidden: true },
    });
})();

(function testXpDropsSetupOpOpensSetupModal() {
    const harness = createHarness();
    const player = new PlayerState(3, 3222, 3222, 0);

    harness.setupHandler({
        tick: 20,
        player,
        widgetId: WIDGET_ID,
        groupId: GROUP_ID,
        childId: XP_DROPS_CHILD_ID,
        opId: 2,
        services: harness.services,
    } as any);

    assert.strictEqual(harness.openSubs.length, 1);
    assert.deepStrictEqual(harness.openSubs[0], {
        playerId: player.id,
        targetUid: getMainmodalUid(player.displayMode as DisplayMode),
        groupId: XP_DROPS_SETUP_GROUP_ID,
        type: 0,
    });
})();
