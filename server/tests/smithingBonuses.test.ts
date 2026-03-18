import assert from "assert";

import type { SmeltingRecipe } from "../src/game/skills/skillSurfaces";
import {
    GOLDSMITH_GAUNTLETS_ITEM_ID,
    RING_OF_FORGING_ITEM_ID,
    getSmeltingXpWithBonuses,
    shouldGuaranteeIronSmelt,
} from "../src/game/skills/smithingBonuses";

const IRON_RECIPE: SmeltingRecipe = {
    id: "smelt_iron_bar",
    name: "Iron bar",
    level: 15,
    xp: 13,
    inputs: [{ itemId: 440, quantity: 1 }],
    outputItemId: 2351,
    outputQuantity: 1,
    successType: "iron",
};

const GOLD_RECIPE: SmeltingRecipe = {
    id: "smelt_gold_bar",
    name: "Gold bar",
    level: 40,
    xp: 22,
    inputs: [{ itemId: 444, quantity: 1 }],
    outputItemId: 2357,
    outputQuantity: 1,
    successType: "guaranteed",
};

(function testRingGuaranteesIron() {
    const equip = new Array<number>(14).fill(-1);
    equip[9] = RING_OF_FORGING_ITEM_ID; // EquipmentSlot.RING
    assert.ok(
        shouldGuaranteeIronSmelt(IRON_RECIPE, equip, 140),
        "ring should guarantee iron smelts when it has charges",
    );
    equip[9] = -1;
    assert.ok(
        !shouldGuaranteeIronSmelt(IRON_RECIPE, equip, 140),
        "without ring iron smelts rely on chance",
    );
    equip[9] = RING_OF_FORGING_ITEM_ID;
    assert.ok(
        !shouldGuaranteeIronSmelt(IRON_RECIPE, equip, 0),
        "ring without charges should not guarantee smelts",
    );
})();

(function testGoldsmithGauntletsXpBonus() {
    const equip = new Array<number>(14).fill(-1);
    equip[7] = GOLDSMITH_GAUNTLETS_ITEM_ID; // EquipmentSlot.GLOVES
    const bonusXp = getSmeltingXpWithBonuses(GOLD_RECIPE, equip);
    assert.strictEqual(bonusXp, Math.floor(22 * 2.5), "goldsmith gauntlets boost gold xp");
    equip[7] = -1;
    assert.strictEqual(
        getSmeltingXpWithBonuses(GOLD_RECIPE, equip),
        GOLD_RECIPE.xp,
        "without gauntlets xp should be base value",
    );
})();

console.log("Smithing bonus tests passed.");
