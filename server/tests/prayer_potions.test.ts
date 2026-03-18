import assert from "assert";

import { SkillId, getXpForLevel } from "../../src/rs/skill/skills";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { prayerRestoresModule } from "../src/game/scripts/modules/items/prayerPotions";
import { type ScriptServices } from "../src/game/scripts/types";
import { createTestScriptServices } from "./scriptServices";

type Harness = {
    registry: ScriptRegistry;
    services: ScriptServices;
    calls: {
        consumedSlots: number[];
        slotUpdates: Array<{ slot: number; itemId: number; qty: number }>;
        messages: string[];
        snapshots: number;
        seqs: number[];
    };
};

const DRINK_SEQ = 829;
const VIAL_ITEM_ID = 229;

function createHarness(): Harness {
    const registry = new ScriptRegistry();
    const calls = {
        consumedSlots: [] as number[],
        slotUpdates: [] as Array<{ slot: number; itemId: number; qty: number }>,
        messages: [] as string[],
        snapshots: 0,
        seqs: [] as number[],
    };
    const services: ScriptServices = createTestScriptServices();
    services.consumeItem = (_player, slotIndex) => {
        calls.consumedSlots.push(slotIndex);
        return true;
    };
    services.setInventorySlot = (_player, slotIndex, itemId, qty) => {
        calls.slotUpdates.push({ slot: slotIndex, itemId, qty });
    };
    services.sendGameMessage = (_player, text) => {
        calls.messages.push(text);
    };
    services.snapshotInventoryImmediate = () => {
        calls.snapshots++;
    };
    services.playPlayerSeq = (_player, seq) => {
        calls.seqs.push(seq);
    };
    services.requestAction = (_player, req) => {
        const apply = (req.data as { apply?: () => void } | undefined)?.apply;
        if (apply) {
            apply();
        }
        return { ok: true, actionId: 1 };
    };
    prayerRestoresModule.register(registry, services);
    return { registry, services, calls };
}

function createPlayer(): PlayerState {
    return new PlayerState(1, 3222, 3222, 0);
}

function setSkillLevels(
    player: PlayerState,
    skillId: SkillId,
    baseLevel: number,
    currentLevel: number,
): void {
    player.setSkillXp(skillId, getXpForLevel(baseLevel));
    player.setSkillBoost(skillId, currentLevel);
}

function invokeAction(
    registry: ScriptRegistry,
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    slot: number,
    option: string = "drink",
): void {
    const handler = registry.findItemOnItem(itemId, -1, option);
    assert.ok(handler, `expected handler for item ${itemId}`);
    handler({
        tick: 0,
        option,
        player,
        source: { slot, itemId },
        target: { slot: -1, itemId: -1 },
        services,
    } as any);
}

function testPrayerPotionRestoresBasedOnLevel(): void {
    const harness = createHarness();
    const player = createPlayer();
    setSkillLevels(player, SkillId.Prayer, 60, 20);

    invokeAction(harness.registry, harness.services, player, 2434, 4);

    assert.strictEqual(player.getPrayerLevel(), 42, "prayer pot should add floor(7 + level/4)");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 4, itemId: 139, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your prayer potion.",
        "You have 3 doses of potion left.",
    ]);
    assert.deepStrictEqual(harness.calls.consumedSlots, [4]);
    assert.strictEqual(harness.calls.snapshots, 1);
    assert.deepStrictEqual(harness.calls.seqs, [DRINK_SEQ]);
}

function testSuperRestoreRebalancesStatsAndPrayer(): void {
    const harness = createHarness();
    const player = createPlayer();
    setSkillLevels(player, SkillId.Attack, 80, 60);
    setSkillLevels(player, SkillId.Defence, 75, 55);
    setSkillLevels(player, SkillId.Prayer, 70, 30);

    invokeAction(harness.registry, harness.services, player, 3024, 2);

    const attack = player.getSkill(SkillId.Attack);
    const defence = player.getSkill(SkillId.Defence);
    assert.strictEqual(attack.baseLevel + attack.boost, 80, "attack should restore to base");
    assert.strictEqual(defence.baseLevel + defence.boost, 75, "defence should restore to base");
    assert.strictEqual(player.getPrayerLevel(), 55, "super restore should add floor(8 + level/4)");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 2, itemId: 3026, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your super restore potion.",
        "You have 3 doses of potion left.",
    ]);
    assert.deepStrictEqual(harness.calls.seqs, [DRINK_SEQ]);
    assert.strictEqual(harness.calls.snapshots, 1);
}

function testPrayerMixHealsAndFinishesIntoVial(): void {
    const harness = createHarness();
    const player = createPlayer();
    setSkillLevels(player, SkillId.Prayer, 45, 15);
    player.applyHitpointsDamage(10);
    const hpBeforeDrink = player.getHitpointsCurrent();

    invokeAction(harness.registry, harness.services, player, 11467, 7);

    assert.strictEqual(player.getPrayerLevel(), 33, "mix should apply standard prayer restore");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBeforeDrink + 6,
        "prayer mix should heal 6 hitpoints",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 7, itemId: VIAL_ITEM_ID, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your prayer mix.",
        "You have finished your potion.",
    ]);
    assert.deepStrictEqual(harness.calls.seqs, [DRINK_SEQ]);
}

function testSanfewSerumCuresStatuses(): void {
    const harness = createHarness();
    const player = createPlayer();
    setSkillLevels(player, SkillId.Prayer, 75, 20);
    player.inflictPoison(6, 0, 1);
    player.inflictDisease(2, 0, 1);

    assert.notStrictEqual(
        (player as any).poisonEffect,
        undefined,
        "poison should be active before",
    );
    assert.notStrictEqual(
        (player as any).diseaseEffect,
        undefined,
        "disease should be active before",
    );

    invokeAction(harness.registry, harness.services, player, 10925, 1);

    assert.strictEqual(
        (player as any).poisonEffect,
        undefined,
        "Sanfew serum should cure poison immediately",
    );
    assert.strictEqual(
        (player as any).diseaseEffect,
        undefined,
        "Sanfew serum should cure disease immediately",
    );
    assert.strictEqual(
        player.getPrayerLevel(),
        46,
        "serum should restore prayer like super restore",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 1, itemId: 10927, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your Sanfew serum.",
        "You have 3 doses of potion left.",
    ]);
}

function testBlightedSuperRestoreMatchesStandardPotion(): void {
    const harness = createHarness();
    const player = createPlayer();
    setSkillLevels(player, SkillId.Attack, 90, 70);
    setSkillLevels(player, SkillId.Prayer, 80, 10);

    invokeAction(harness.registry, harness.services, player, 24598, 0);

    assert.strictEqual(
        player.getPrayerLevel(),
        38,
        "blighted super restore should use same formula",
    );
    const attack = player.getSkill(SkillId.Attack);
    assert.strictEqual(attack.baseLevel + attack.boost, 90, "combat stats should restore to base");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 0, itemId: 24601, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your blighted super restore potion.",
        "You have 3 doses of potion left.",
    ]);
}

function runTests(): void {
    testPrayerPotionRestoresBasedOnLevel();
    testSuperRestoreRebalancesStatsAndPrayer();
    testPrayerMixHealsAndFinishesIntoVial();
    testSanfewSerumCuresStatuses();
    testBlightedSuperRestoreMatchesStandardPotion();
}

runTests();
