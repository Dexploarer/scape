import assert from "assert";

import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { prayerWidgetModule } from "../src/game/scripts/modules/prayerWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { GameframeTab } from "../src/widgets/InterfaceService";
import { DisplayMode, getPrayerTabUid } from "../src/widgets/viewport";
import { createTestScriptServices } from "./scriptServices";

const MINIMAP_GROUP_ID = 160;
const MINIMAP_PRAYER_ORB_COMPONENT = 20;
const QUICK_PRAYER_GROUP_ID = 77;
const QUICK_PRAYER_BUTTONS_COMPONENT = 4;
const QUICK_PRAYER_DONE_COMPONENT = 5;
const QUICK_PRAYER_BUTTON_FLAGS = 1 << 1;
const QUICK_PRAYER_BUTTONS_UID = (QUICK_PRAYER_GROUP_ID << 16) | QUICK_PRAYER_BUTTONS_COMPONENT;

function createHarness() {
    const registry = new ScriptRegistry();
    const openSubs: Array<{ playerId: number; targetUid: number; groupId: number; type: number }> =
        [];
    const focusedTabs: Array<{ playerId: number; tab: number }> = [];
    const queuedWidgetEvents: Array<{ playerId: number; event: any }> = [];
    let combatSnapshots = 0;

    const enumLoader = {
        load: (id: number) => {
            // Minimal enum shape for quick-prayer setup mapping:
            // one entry -> obj 1, outputCount 1 => base quick-prayer button child slot 0.
            if (id === 4956) {
                return {
                    outputCount: 1,
                    keys: [0],
                    intValues: [1],
                } as any;
            }
            return undefined;
        },
    };

    const objTypeById = new Map<number, any>([
        [
            1,
            {
                params: new Map<number, number>([
                    [1751, 1], // component uid (required to be visible)
                    [1753, 1], // quicksort key
                    [630, 26], // quick-prayer bit -> piety
                ]),
            },
        ],
    ]);

    const services: ScriptServices = createTestScriptServices();
    services.getEnumTypeLoader = () => enumLoader as any;
    services.getObjType = (id) => objTypeById.get(id);
    services.getInterfaceService = () =>
        ({
            focusTab: (player: PlayerState, tab: number) => {
                focusedTabs.push({ playerId: player.id, tab: tab });
            },
        }) as any;
    services.openSubInterface = (player, targetUid, groupId, type = 0) => {
        openSubs.push({
            playerId: player.id,
            targetUid: targetUid,
            groupId: groupId,
            type: type,
        });
    };
    services.queueCombatState = () => {
        combatSnapshots++;
    };
    services.queueWidgetEvent = (playerId: number, event: any) => {
        queuedWidgetEvents.push({ playerId: playerId, event });
    };
    services.applyPrayers = (player, prayers) => {
        player.setActivePrayers((prayers ?? []) as any);
        return { changed: true, activePrayers: prayers ?? [], errors: [] } as any;
    };

    prayerWidgetModule.register(registry, services);

    const minimapOrbHandler = registry.findButton(MINIMAP_GROUP_ID, MINIMAP_PRAYER_ORB_COMPONENT);
    assert.ok(minimapOrbHandler, "minimap prayer orb handler should be registered");

    const quickPrayerButtonsHandler = registry.findButton(
        QUICK_PRAYER_GROUP_ID,
        QUICK_PRAYER_BUTTONS_COMPONENT,
    );
    assert.ok(quickPrayerButtonsHandler, "quick-prayer buttons handler should be registered");

    const quickPrayerDoneHandler = registry.findButton(
        QUICK_PRAYER_GROUP_ID,
        QUICK_PRAYER_DONE_COMPONENT,
    );
    assert.ok(quickPrayerDoneHandler, "quick-prayer done handler should be registered");

    return {
        services,
        openSubs,
        focusedTabs,
        queuedWidgetEvents,
        combatSnapshots: () => combatSnapshots,
        minimapOrbHandler: minimapOrbHandler!,
        quickPrayerButtonsHandler: quickPrayerButtonsHandler!,
        quickPrayerDoneHandler: quickPrayerDoneHandler!,
    };
}

(function testMinimapPrayerOrbSetupOpOpensQuickPrayerTab() {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.displayMode = DisplayMode.RESIZABLE_NORMAL;

    harness.minimapOrbHandler({
        tick: 100,
        player,
        widgetId: (MINIMAP_GROUP_ID << 16) | MINIMAP_PRAYER_ORB_COMPONENT,
        groupId: MINIMAP_GROUP_ID,
        childId: MINIMAP_PRAYER_ORB_COMPONENT,
        opId: 2,
        services: harness.services,
    } as any);

    assert.strictEqual(harness.openSubs.length, 1, "setup should open quick-prayer interface");
    assert.deepStrictEqual(harness.openSubs[0], {
        playerId: player.id,
        targetUid: getPrayerTabUid(DisplayMode.RESIZABLE_NORMAL),
        groupId: QUICK_PRAYER_GROUP_ID,
        type: 1,
    });
    assert.deepStrictEqual(harness.focusedTabs[0], {
        playerId: player.id,
        tab: GameframeTab.PRAYER,
    });
    assert.strictEqual(
        harness.combatSnapshots(),
        1,
        "opening setup should queue combat state for quick-prayer selection sync",
    );
    assert.ok(
        harness.queuedWidgetEvents.some(
            ({ playerId, event }) =>
                playerId === player.id &&
                event?.action === "set_flags_range" &&
                event?.uid === QUICK_PRAYER_BUTTONS_UID &&
                event?.fromSlot === 0 &&
                event?.toSlot === 0 &&
                event?.flags === QUICK_PRAYER_BUTTON_FLAGS,
        ),
        "opening setup should set transmit-op1 flags for quick-prayer button slots",
    );
    assert.ok(
        harness.queuedWidgetEvents.some(
            ({ playerId, event }) =>
                playerId === player.id &&
                event?.action === "set_flags_range" &&
                event?.uid === QUICK_PRAYER_BUTTONS_UID &&
                event?.fromSlot === 14 &&
                event?.toSlot === 14 &&
                event?.flags === QUICK_PRAYER_BUTTON_FLAGS,
        ),
        "opening setup should set transmit-op1 for slot 14 (Protect from Melee)",
    );
})();

(function testMinimapPrayerOrbActivateOpTogglesQuickPrayers() {
    const harness = createHarness();
    const player = new PlayerState(11, 3222, 3222, 0);
    player.setQuickPrayers(["piety"]);

    harness.minimapOrbHandler({
        tick: 150,
        player,
        widgetId: (MINIMAP_GROUP_ID << 16) | MINIMAP_PRAYER_ORB_COMPONENT,
        groupId: MINIMAP_GROUP_ID,
        childId: MINIMAP_PRAYER_ORB_COMPONENT,
        opId: 1,
        services: harness.services,
    } as any);

    assert.strictEqual(player.areQuickPrayersEnabled(), true, "op1 should activate quick prayers");
    assert.deepStrictEqual(Array.from(player.getActivePrayers()), ["piety"]);
    assert.strictEqual(harness.combatSnapshots(), 1);

    harness.minimapOrbHandler({
        tick: 151,
        player,
        widgetId: (MINIMAP_GROUP_ID << 16) | MINIMAP_PRAYER_ORB_COMPONENT,
        groupId: MINIMAP_GROUP_ID,
        childId: MINIMAP_PRAYER_ORB_COMPONENT,
        opId: 1,
        services: harness.services,
    } as any);

    assert.strictEqual(player.areQuickPrayersEnabled(), false, "second op1 should deactivate");
    assert.strictEqual(player.getActivePrayers().size, 0, "deactivate should clear active prayers");
    assert.strictEqual(harness.combatSnapshots(), 2);
})();

(function testQuickPrayerSetupButtonTogglesSelection() {
    const harness = createHarness();
    const player = new PlayerState(2, 3222, 3222, 0);

    // Slot 0 is the enum key used by quickprayer_init for the first quick-prayer button.
    harness.quickPrayerButtonsHandler({
        tick: 200,
        player,
        widgetId: (QUICK_PRAYER_GROUP_ID << 16) | QUICK_PRAYER_BUTTONS_COMPONENT,
        groupId: QUICK_PRAYER_GROUP_ID,
        childId: QUICK_PRAYER_BUTTONS_COMPONENT,
        slot: 0,
        opId: 1,
        services: harness.services,
    } as any);

    assert.deepStrictEqual(Array.from(player.getQuickPrayers()), ["piety"]);
    assert.strictEqual(player.areQuickPrayersEnabled(), false);
    assert.strictEqual(harness.combatSnapshots(), 1);

    harness.quickPrayerButtonsHandler({
        tick: 201,
        player,
        widgetId: (QUICK_PRAYER_GROUP_ID << 16) | QUICK_PRAYER_BUTTONS_COMPONENT,
        groupId: QUICK_PRAYER_GROUP_ID,
        childId: QUICK_PRAYER_BUTTONS_COMPONENT,
        slot: 0,
        opId: 1,
        services: harness.services,
    } as any);

    assert.strictEqual(player.getQuickPrayers().size, 0, "second click should untoggle prayer");
    assert.strictEqual(harness.combatSnapshots(), 2);
})();

(function testQuickPrayerSetupButtonUsesCanonicalQuickSlotFallback() {
    const harness = createHarness();
    const player = new PlayerState(4, 3222, 3222, 0);

    harness.quickPrayerButtonsHandler({
        tick: 250,
        player,
        widgetId: (QUICK_PRAYER_GROUP_ID << 16) | QUICK_PRAYER_BUTTONS_COMPONENT,
        groupId: QUICK_PRAYER_GROUP_ID,
        childId: QUICK_PRAYER_BUTTONS_COMPONENT,
        slot: 14, // Protect from Melee quick-prayer slot
        opId: 1,
        services: harness.services,
    } as any);

    assert.deepStrictEqual(Array.from(player.getQuickPrayers()), ["protect_from_melee"]);
    assert.strictEqual(player.areQuickPrayersEnabled(), false);
})();

(function testQuickPrayerDoneRestoresPrayerTab() {
    const harness = createHarness();
    const player = new PlayerState(3, 3222, 3222, 0);
    player.displayMode = DisplayMode.RESIZABLE_NORMAL;

    harness.quickPrayerDoneHandler({
        tick: 300,
        player,
        widgetId: (QUICK_PRAYER_GROUP_ID << 16) | QUICK_PRAYER_DONE_COMPONENT,
        groupId: QUICK_PRAYER_GROUP_ID,
        childId: QUICK_PRAYER_DONE_COMPONENT,
        opId: 1,
        services: harness.services,
    } as any);

    assert.strictEqual(harness.openSubs.length, 1, "done should restore prayer tab");
    assert.deepStrictEqual(harness.openSubs[0], {
        playerId: player.id,
        targetUid: getPrayerTabUid(DisplayMode.RESIZABLE_NORMAL),
        groupId: 541,
        type: 1,
    });
    assert.deepStrictEqual(harness.focusedTabs[0], {
        playerId: player.id,
        tab: GameframeTab.PRAYER,
    });
})();
