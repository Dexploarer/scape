import assert from "assert";

import { SkillId } from "../../src/rs/skill/skills";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { runEnergyPotionsModule } from "../src/game/scripts/modules/items/energyPotions";
import { type ScriptServices } from "../src/game/scripts/types";
import { readPositiveEnvInteger } from "../src/game/scripts/utils/env";
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
const PIE_DISH_ITEM_ID = 2313;
const TEA_CUP_ITEM_ID = 1980;
const GUTHIX_REST_DURATION_SECONDS = 300;
const DEFAULT_TICK_MS = readPositiveEnvInteger("TICK_MS") ?? 600;
const STAMINA_BASE_SECONDS = 120;
const configuredStaminaDurationTicks = readPositiveEnvInteger("STAMINA_DURATION_TICKS");
const STAMINA_DURATION_TICKS =
    configuredStaminaDurationTicks !== undefined
        ? configuredStaminaDurationTicks
        : Math.max(1, Math.round((STAMINA_BASE_SECONDS * 1000) / Math.max(1, DEFAULT_TICK_MS)));

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
    runEnergyPotionsModule.register(registry, services);
    return { registry, services, calls };
}

function createPlayer(): PlayerState {
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setRunEnergyUnits(0);
    return player;
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
    assert.ok(handler, `handler should exist for item ${itemId}`);
    handler({
        tick: 0,
        option,
        player,
        source: { slot, itemId },
        target: { slot: -1, itemId: -1 },
        services,
    } as any);
}

function testEnergyPotionRestoresTenPercent(): void {
    const harness = createHarness();
    const player = createPlayer();
    invokeAction(harness.registry, harness.services, player, 3008, 5);

    assert.strictEqual(player.getRunEnergyPercent(), 10, "energy potion should restore 10%");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 5, itemId: 3010, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your energy potion.",
        "You have 3 doses of potion left.",
    ]);
    assert.deepStrictEqual(harness.calls.consumedSlots, [5]);
    assert.strictEqual(harness.calls.snapshots, 1, "inventory snapshot should fire once");
    assert.deepStrictEqual(harness.calls.seqs, [DRINK_SEQ], "drink seq should play once");
}

function testSuperEnergyPotionRestoresTwentyPercent(): void {
    const harness = createHarness();
    const player = createPlayer();
    invokeAction(harness.registry, harness.services, player, 3016, 2);

    assert.strictEqual(player.getRunEnergyPercent(), 20, "super energy should restore 20%");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 2, itemId: 3018, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your super energy potion.",
        "You have 3 doses of potion left.",
    ]);
}

function testLastDoseYieldsVialAndCapsEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(95);
    invokeAction(harness.registry, harness.services, player, 3022, 7);

    assert.strictEqual(player.getRunEnergyPercent(), 100, "run energy should cap at 100%");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 7, itemId: VIAL_ITEM_ID, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages.slice(-1), ["You have finished your potion."]);
}

function testEnergyMixHealsAndDowngradesDose(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(4);
    const hpBeforeDrink = player.getHitpointsCurrent();
    invokeAction(harness.registry, harness.services, player, 11453, 3);

    assert.strictEqual(player.getRunEnergyPercent(), 10, "energy mix should restore 10%");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBeforeDrink + 6,
        "energy mix should heal 6 hitpoints (allowing overheal)",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 3, itemId: 11455, qty: 1 }]);
    assert.strictEqual(
        harness.calls.seqs[0],
        DRINK_SEQ,
        "mixes should still play the drinking sequence",
    );
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your energy mix.",
        "You have 1 dose of potion left.",
    ]);
}

function testSuperEnergyMixFinishesIntoVial(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(90);
    invokeAction(harness.registry, harness.services, player, 11483, 9);

    assert.strictEqual(player.getRunEnergyPercent(), 100, "super energy mix should cap at 100%");
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 9, itemId: VIAL_ITEM_ID, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your super energy mix.",
        "You have finished your potion.",
    ]);
}

function testStrangeFruitRestoresRunAndHealth(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(6);
    const hpBeforeFruit = player.getHitpointsCurrent();
    invokeAction(harness.registry, harness.services, player, 464, 1, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 30, "Strange fruit should restore 30% run.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBeforeFruit + 2,
        "Strange fruit should heal 2 hitpoints.",
    );
    assert.deepStrictEqual(harness.calls.messages, [
        "You eat the strange fruit.",
        "It tastes... unusual.",
    ]);
    assert.deepStrictEqual(
        harness.calls.slotUpdates,
        [],
        "no follow-up item should be set for fruit consumption",
    );
    assert.deepStrictEqual(
        harness.calls.seqs,
        [],
        "fruit should not trigger the drink animation sequence",
    );
}

testEnergyPotionRestoresTenPercent();
testSuperEnergyPotionRestoresTwentyPercent();
testLastDoseYieldsVialAndCapsEnergy();
testEnergyMixHealsAndDowngradesDose();
testSuperEnergyMixFinishesIntoVial();
testStrangeFruitRestoresRunAndHealth();

function testGuthixRestAppliesStaminaAndCuresStatus(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(0);
    player.inflictPoison(6, 0);
    player.inflictDisease(4, 0);
    invokeAction(harness.registry, harness.services, player, 4417, 4);

    assert.strictEqual(
        player.getRunEnergyPercent(),
        5,
        "Guthix rest should restore 5% run energy.",
    );
    assert.strictEqual(
        player.getRunEnergyDrainMultiplier(0),
        0.95,
        "Guthix rest should reduce drain rate by 5%",
    );
    const expectedTicks = Math.max(
        1,
        Math.round((GUTHIX_REST_DURATION_SECONDS * 1000) / Math.max(1, DEFAULT_TICK_MS)),
    );
    assert.strictEqual(
        player.getStaminaEffectRemainingTicks(0),
        expectedTicks,
        "Guthix rest should apply its stamina effect duration",
    );
    assert.strictEqual(
        (player as any).poisonEffect,
        undefined,
        "Guthix rest should cure poison immediately",
    );
    assert.strictEqual(
        (player as any).diseaseEffect,
        undefined,
        "Guthix rest should cure disease immediately",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 4, itemId: 4419, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your Guthix rest.",
        "You have 3 doses of potion left.",
    ]);
}

function testSummerPieBitesLeaveDishAndRestoreEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(8);
    player.setRunEnergyPercent(0);
    const hpBeforeFirstBite = player.getHitpointsCurrent();
    invokeAction(harness.registry, harness.services, player, 7218, 0, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 10, "First bite should restore 10% energy.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBeforeFirstBite + 11,
        "First bite should heal 11 hitpoints.",
    );
    const agilityAfterFirst = player.getSkill(SkillId.Agility).boost;
    assert.strictEqual(agilityAfterFirst, 5, "First bite should boost Agility by 5.");
    assert.deepStrictEqual(harness.calls.slotUpdates[0], { slot: 0, itemId: 7220, qty: 1 });
    assert.deepStrictEqual(harness.calls.messages, ["You eat half of the pie."]);

    const hpBeforeSecondBite = player.getHitpointsCurrent();
    invokeAction(harness.registry, harness.services, player, 7220, 0, "eat");
    assert.strictEqual(player.getRunEnergyPercent(), 20, "Second bite should add another 10%.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBeforeSecondBite + 11,
        "Second bite should also heal 11 hitpoints.",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates[1], {
        slot: 0,
        itemId: PIE_DISH_ITEM_ID,
        qty: 1,
    });
    const agilityAfterSecond = player.getSkill(SkillId.Agility).boost;
    assert.strictEqual(
        agilityAfterSecond,
        5,
        "Second bite should refresh Agility boost without stacking beyond +5.",
    );
    assert.deepStrictEqual(harness.calls.messages, [
        "You eat half of the pie.",
        "You eat the remaining half of the pie.",
    ]);
}

function testGuthixRestFinalDoseLeavesTeaCup(): void {
    const harness = createHarness();
    const player = createPlayer();
    invokeAction(harness.registry, harness.services, player, 4423, 2);
    assert.deepStrictEqual(harness.calls.slotUpdates, [
        { slot: 2, itemId: TEA_CUP_ITEM_ID, qty: 1 },
    ]);
}

testGuthixRestAppliesStaminaAndCuresStatus();
testSummerPieBitesLeaveDishAndRestoreEnergy();
testGuthixRestFinalDoseLeavesTeaCup();

function testPurpleSweetsRestoreEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(3);
    player.setRunEnergyPercent(0);

    invokeAction(harness.registry, harness.services, player, 4561, 6, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 10, "Purple sweets should restore 10% run.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        player.getHitpointsMax() - 3 + 2,
        "Purple sweets should heal 2 hitpoints.",
    );
    assert.deepStrictEqual(
        harness.calls.messages,
        ["You eat the purple sweets."],
        "Purple sweets should send the correct consume message.",
    );
}

function testWhiteTreeFruitRestoresEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(5);
    player.setRunEnergyPercent(5);

    invokeAction(harness.registry, harness.services, player, 6469, 7, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 13, "White tree fruit should add 8% run.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        player.getHitpointsMax() - 5 + 3,
        "White tree fruit should heal 3 hitpoints.",
    );
    assert.deepStrictEqual(
        harness.calls.messages,
        ["You eat the white tree fruit."],
        "White tree fruit should send the consume message.",
    );
}

testPurpleSweetsRestoreEnergy();
testWhiteTreeFruitRestoresEnergy();

function testPapayaFruitRestoresFivePercent(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.applyHitpointsDamage(6);
    player.setRunEnergyPercent(0);
    const hpBefore = player.getHitpointsCurrent();

    invokeAction(harness.registry, harness.services, player, 5972, 4, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 5, "Papaya fruit should add 5% run.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBefore + 8,
        "Papaya fruit should heal 8 hitpoints.",
    );
    assert.deepStrictEqual(harness.calls.messages, ["You eat the papaya fruit."]);
}

function testMintCakeRestoresFullEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(1);

    invokeAction(harness.registry, harness.services, player, 9475, 8, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 100, "Mint cake should fully restore energy.");
    assert.deepStrictEqual(harness.calls.messages, ["You eat the mint cake."]);
}

function testGoutTuberRestoresHalfEnergy(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(10);
    player.applyHitpointsDamage(4);
    const hpBefore = player.getHitpointsCurrent();

    invokeAction(harness.registry, harness.services, player, 6311, 1, "eat");

    assert.strictEqual(player.getRunEnergyPercent(), 60, "Gout tuber should add 50% run energy.");
    assert.strictEqual(
        player.getHitpointsCurrent(),
        hpBefore + 12,
        "Gout tuber should heal 12 hitpoints.",
    );
    assert.deepStrictEqual(harness.calls.messages, ["You eat the gout tuber. Peculiar taste!"]);
}

function testSummerSqirkJuiceBoostsThieving(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(0);

    invokeAction(harness.registry, harness.services, player, 10849, 0, "drink");

    assert.strictEqual(
        player.getRunEnergyPercent(),
        20,
        "Summer sq'irkjuice should add 20% run energy.",
    );
    assert.strictEqual(
        player.getSkill(SkillId.Thieving).boost,
        3,
        "Summer sq'irkjuice should boost Thieving by 3.",
    );
    assert.deepStrictEqual(harness.calls.messages, ["You drink the summer sq'irkjuice."]);
    assert.deepStrictEqual(harness.calls.seqs, [DRINK_SEQ]);
}

testPapayaFruitRestoresFivePercent();
testMintCakeRestoresFullEnergy();
testGoutTuberRestoresHalfEnergy();
testSummerSqirkJuiceBoostsThieving();

function testStaminaMixAppliesStaminaEffect(): void {
    const harness = createHarness();
    const player = createPlayer();
    player.setRunEnergyPercent(0);

    invokeAction(harness.registry, harness.services, player, 12633, 2, "drink");

    assert.strictEqual(player.getRunEnergyPercent(), 20, "Stamina mix should restore 20% run.");
    assert.strictEqual(
        player.getRunEnergyDrainMultiplier(0),
        0.3,
        "Stamina mix should apply the stamina drain multiplier.",
    );
    assert.strictEqual(
        player.getStaminaEffectRemainingTicks(0),
        STAMINA_DURATION_TICKS,
        "Stamina mix should set the stamina effect duration.",
    );
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 2, itemId: 12635, qty: 1 }]);
    assert.deepStrictEqual(harness.calls.messages, [
        "You drink some of your stamina mix.",
        "You have 1 dose of potion left.",
    ]);
}

testStaminaMixAppliesStaminaEffect();

console.log("Energy potion module tests passed.");
