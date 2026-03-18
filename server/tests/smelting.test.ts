import assert from "assert";

import {
    SMELTING_RECIPES,
    calculateIronSmeltChance,
    getSmeltingRecipeById,
} from "../src/game/skills/skillSurfaces";

function testBronzeRecipe(): void {
    const bronze = getSmeltingRecipeById("smelt_bronze_bar");
    assert.ok(bronze, "bronze recipe should exist");
    assert.strictEqual(bronze?.inputs.length, 2, "bronze requires two different ores");
    const copper = bronze?.inputs.find((req) => req.itemId === 436);
    const tin = bronze?.inputs.find((req) => req.itemId === 438);
    assert.strictEqual(copper?.quantity, 1, "bronze should consume 1 copper ore");
    assert.strictEqual(tin?.quantity, 1, "bronze should consume 1 tin ore");
}

function testSteelCoalRequirement(): void {
    const steel = getSmeltingRecipeById("smelt_steel_bar");
    assert.ok(steel, "steel recipe should exist");
    const coal = steel?.inputs.find((req) => req.itemId === 453);
    assert.strictEqual(coal?.quantity, 2, "steel should consume 2 coal");
}

function testIronChanceProgression(): void {
    const level15 = Math.round(calculateIronSmeltChance(15) * 100);
    const level45 = Math.round(calculateIronSmeltChance(45) * 100);
    const level99 = Math.round(calculateIronSmeltChance(99) * 100);
    assert.strictEqual(level15, 50, "level 15 iron smelt chance should be 50%");
    assert.strictEqual(level45, 80, "level 45 iron smelt chance should be 80%");
    assert.strictEqual(level99, 100, "iron chance should cap at 100%");
}

function testAllRecipesExposeLabels(): void {
    for (const recipe of SMELTING_RECIPES) {
        assert.ok(recipe.ingredientsLabel, `recipe ${recipe.id} should expose ingredients label`);
    }
}

testBronzeRecipe();
testSteelCoalRequirement();
testIronChanceProgression();
testAllRecipesExposeLabels();

console.log("Smelting recipe tests passed.");
