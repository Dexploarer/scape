import assert from "assert";

import { getSmithingRecipeById } from "../src/game/skills/skillSurfaces";

const TIERS = [
    { id: "bronze_arrowtips", level: 5, xp: 12.5, barItemId: 2349, outputItemId: 39 },
    { id: "iron_arrowtips", level: 20, xp: 25, barItemId: 2351, outputItemId: 40 },
    { id: "steel_arrowtips", level: 35, xp: 37.5, barItemId: 2353, outputItemId: 41 },
    { id: "mithril_arrowtips", level: 55, xp: 50, barItemId: 2359, outputItemId: 42 },
    { id: "adamant_arrowtips", level: 75, xp: 62.5, barItemId: 2361, outputItemId: 43 },
    { id: "rune_arrowtips", level: 90, xp: 75, barItemId: 2363, outputItemId: 44 },
];

for (const tier of TIERS) {
    const recipe = getSmithingRecipeById(tier.id);
    assert.ok(recipe, `${tier.id} recipe should exist`);
    assert.strictEqual(recipe?.level, tier.level, `${tier.id} level mismatch`);
    assert.strictEqual(recipe?.xp, tier.xp, `${tier.id} xp mismatch`);
    assert.strictEqual(recipe?.barItemId, tier.barItemId, `${tier.id} bar mismatch`);
    assert.strictEqual(recipe?.outputItemId, tier.outputItemId, `${tier.id} item mismatch`);
    assert.strictEqual(recipe?.outputQuantity, 15, `${tier.id} should produce 15 tips`);
}

console.log("Smithing arrowtips tests passed.");
