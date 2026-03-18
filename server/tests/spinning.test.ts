import assert from "assert";

import {
    SINEW_ITEM_ID,
    SINEW_SOURCE_ITEM_IDS,
    SPINNING_ANIMATION_ID,
    SPINNING_RECIPES,
    SPINNING_WHEEL_LOC_IDS,
    getSpinningRecipeById,
    isSinewSourceItem,
    isSpinningWheelLocId,
} from "../src/game/skills/spinning";

function testRecipeRegistry(): void {
    assert.ok(SPINNING_RECIPES.length >= 4, "expected spinning registry to include core recipes");

    const flax = getSpinningRecipeById("spin_flax_bowstring");
    assert.ok(flax, "spin_flax_bowstring recipe should exist");
    assert.strictEqual(flax?.inputItemId, 1779);
    assert.strictEqual(flax?.productItemId, 1777);
    assert.strictEqual(flax?.level, 10);
    assert.strictEqual(flax?.xp, 15);
    assert.strictEqual(flax?.animation, SPINNING_ANIMATION_ID);

    const wool = getSpinningRecipeById("spin_wool_ball");
    assert.ok(wool, "spin_wool_ball recipe should exist");
    assert.strictEqual(wool?.inputQuantity, 1);
    assert.strictEqual(wool?.outputQuantity, 1);
    assert.strictEqual(wool?.level, 1);
    assert.strictEqual(wool?.xp, 2.5);

    const magic = getSpinningRecipeById("spin_magic_roots_string");
    assert.ok(magic, "spin_magic_roots_string recipe should exist");
    assert.strictEqual(magic?.level, 19);
    assert.strictEqual(magic?.xp, 30);
    assert.strictEqual(magic?.productItemId, 6038);
}

function testWheelIds(): void {
    assert.ok(
        SPINNING_WHEEL_LOC_IDS.includes(4309),
        "Viking spinning wheel id should be registered",
    );
    assert.ok(
        SPINNING_WHEEL_LOC_IDS.includes(26143),
        "Miscellania spinning wheel id should be registered",
    );
    assert.ok(isSpinningWheelLocId(30934), "Built Fossil Island wheel should be recognized");
    assert.ok(
        !isSpinningWheelLocId(1234),
        "Irrelevant loc id should not be treated as spinning wheel",
    );
}

function testSinewData(): void {
    assert.strictEqual(SINEW_ITEM_ID, 9436, "Sinew item id should match OSRS data");
    assert.ok(SINEW_SOURCE_ITEM_IDS.includes(2132), "Raw beef should produce sinew");
    assert.ok(SINEW_SOURCE_ITEM_IDS.includes(2136), "Bear meat should produce sinew");
    assert.ok(isSinewSourceItem(2132), "Helper should recognise sinew sources");
    assert.ok(!isSinewSourceItem(3142), "Helper should reject unrelated items");
}

testRecipeRegistry();
testWheelIds();
testSinewData();

console.log("Spinning tests passed.");
