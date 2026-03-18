import assert from "assert";

import { type PrayerName } from "../../src/rs/prayer/prayers";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { prayerWidgetModule } from "../src/game/scripts/modules/prayerWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { createTestScriptServices } from "./scriptServices";

const GROUP_ID = 541;
const QUICK_CHILD_ID = 1000;

type PrayerQuickHarness = {
    registry: ScriptRegistry;
    services: ScriptServices;
    calls: {
        messages: string[];
        applyArgs: PrayerName[][];
        combatSnapshots: number;
    };
    handler: NonNullable<ReturnType<ScriptRegistry["findWidgetAction"]>>;
    widgetId: number;
};

function createHarness(): PrayerQuickHarness {
    const registry = new ScriptRegistry();
    const calls = {
        messages: [] as string[],
        applyArgs: [] as PrayerName[][],
        combatSnapshots: 0,
    };
    const services: ScriptServices = createTestScriptServices();
    services.applyPrayers = (_player, prayers) => {
        const normalized = (prayers ?? []) as PrayerName[];
        calls.applyArgs.push(normalized);
        _player.setActivePrayers(normalized as any);
        return { changed: true, activePrayers: normalized, errors: [] } as any;
    };
    services.sendGameMessage = (_player, text) => {
        calls.messages.push(text);
    };
    services.queueCombatState = () => {
        calls.combatSnapshots++;
    };
    prayerWidgetModule.register(registry, services);
    const widgetId = (GROUP_ID & 0xffff) << 16;
    const handler = registry.findWidgetAction(widgetId, undefined, undefined);
    assert.ok(handler, "prayer widget handler should be registered");
    return { registry, services, calls, handler: handler!, widgetId };
}

function invokeQuickAction(harness: PrayerQuickHarness, player: PlayerState, option: string) {
    harness.handler({
        tick: 0,
        player,
        widgetId: harness.widgetId,
        groupId: GROUP_ID,
        childId: QUICK_CHILD_ID,
        option,
        target: "quick_prayer",
        services: harness.services,
    } as any);
}

function testQuickSetCopiesActivePrayers(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setActivePrayers(["piety" as PrayerName]);

    invokeQuickAction(harness, player, "QuickSet");

    assert.deepStrictEqual(
        Array.from(player.getQuickPrayers()),
        ["piety"],
        "quick set should mirror active prayers",
    );
    assert.strictEqual(player.areQuickPrayersEnabled(), false);
    assert.ok(
        harness.calls.messages.includes("Quick-prayers set."),
        "setting quick prayers should send confirmation",
    );
}

function testQuickToggleRequiresSetup(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);

    invokeQuickAction(harness, player, "QuickToggle");

    assert.strictEqual(player.areQuickPrayersEnabled(), false);
    assert.strictEqual(
        harness.calls.messages[harness.calls.messages.length - 1],
        "You haven't selected any quick-prayers.",
        "missing quick prayers should warn the player",
    );
}

function testQuickToggleActivatesAndDeactivates(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setActivePrayers(["piety" as PrayerName, "protect_from_melee" as PrayerName]);
    invokeQuickAction(harness, player, "QuickSet");

    invokeQuickAction(harness, player, "QuickToggle");
    assert.strictEqual(player.areQuickPrayersEnabled(), true, "toggle should enable quick prayers");
    assert.deepStrictEqual(
        harness.calls.applyArgs.pop(),
        ["piety", "protect_from_melee"],
        "applyPrayers should receive configured quick set",
    );

    invokeQuickAction(harness, player, "QuickToggle");
    assert.strictEqual(
        player.areQuickPrayersEnabled(),
        false,
        "second toggle should disable quick prayers",
    );
    assert.deepStrictEqual(
        harness.calls.applyArgs.pop(),
        [],
        "disabling should clear active prayers",
    );
    const lastMessage = harness.calls.messages[harness.calls.messages.length - 1];
    assert.strictEqual(lastMessage, "You deactivate your quick-prayers.");
}

function runTests(): void {
    testQuickSetCopiesActivePrayers();
    testQuickToggleRequiresSetup();
    testQuickToggleActivatesAndDeactivates();
}

runTests();
