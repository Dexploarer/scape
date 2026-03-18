import assert from "assert";

import {
    FLAX_ITEM_ID,
    FLAX_LOC_IDS,
    FLAX_PICK_ANIMATION_ID,
    FLAX_PICK_DELAY_TICKS,
    FLAX_PICK_XP,
    isFlaxLocId,
} from "../src/game/skills/flax";

function testFlaxConstants(): void {
    assert.strictEqual(FLAX_ITEM_ID, 1779, "flax item id should match OSRS data");
    assert.strictEqual(FLAX_PICK_XP, 1, "flax picking should award 1 Crafting XP");
    assert.strictEqual(FLAX_PICK_ANIMATION_ID, 827, "flax animation should use the pick animation");
    assert.strictEqual(FLAX_PICK_DELAY_TICKS, 3, "flax picking delay should be 3 ticks");
}

function testLocRegistry(): void {
    assert.ok(FLAX_LOC_IDS.includes(2646), "legacy Seers' flax id should be registered");
    assert.ok(FLAX_LOC_IDS.includes(14896), "RuneLite FLAX id should be registered");
    assert.ok(FLAX_LOC_IDS.includes(15075), "Miscellania flax variants should be registered");
    assert.ok(isFlaxLocId(15079), "helper should recognize multi-loc variant");
    assert.ok(!isFlaxLocId(1234), "helper should reject non-flax ids");
}

testFlaxConstants();
testLocRegistry();

console.log("Flax tests passed.");
