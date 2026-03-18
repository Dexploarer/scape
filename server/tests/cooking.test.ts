import assert from "assert";

import {
    DEFAULT_COOKING_BURN_BONUS,
    getCookingRecipeById,
    rollCookingOutcome,
} from "../src/game/skills/skillSurfaces";

function testCookingBurnsAtLowLevel(): void {
    const shrimp = getCookingRecipeById("cook_shrimps");
    assert.ok(shrimp, "Shrimp recipe should exist");
    const outcome = rollCookingOutcome(shrimp, shrimp.level, {
        burnBonus: DEFAULT_COOKING_BURN_BONUS,
        rng: () => 0, // Force the worst possible roll
    });
    assert.strictEqual(outcome, "burn", "Low-level shrimp should be able to burn");
}

function testCookingStopsBurningAtStopLevel(): void {
    const lobster = getCookingRecipeById("cook_lobster");
    assert.ok(lobster, "Lobster recipe should exist");
    const highLevel = Math.max(lobster?.stopBurnLevel ?? 0, lobster.level + 1);
    const outcome = rollCookingOutcome(lobster, highLevel, {
        burnBonus: DEFAULT_COOKING_BURN_BONUS,
        rng: () => 0,
    });
    assert.strictEqual(outcome, "success", "Cooking at or above stop-burn level should succeed");
}

function testRecipesWithoutBurnDataAlwaysSucceed(): void {
    const chicken = getCookingRecipeById("cook_chicken");
    assert.ok(chicken, "Chicken recipe should exist");
    const outcome = rollCookingOutcome(chicken, chicken.level, {
        burnBonus: DEFAULT_COOKING_BURN_BONUS,
        rng: () => 0,
    });
    assert.strictEqual(outcome, "success", "Recipes without burn data should not burn yet");
}

function testOpenFirePenaltyIsStronger(): void {
    const salmon = getCookingRecipeById("cook_salmon");
    assert.ok(salmon, "Salmon recipe should exist");
    const level = salmon.level;
    const riggedRoll = () => 0.44; // 44%
    const rangeOutcome = rollCookingOutcome(salmon, level, {
        burnBonus: DEFAULT_COOKING_BURN_BONUS,
        rng: riggedRoll,
    });
    const fireOutcome = rollCookingOutcome(salmon, level, {
        burnBonus: 0,
        rng: riggedRoll,
    });
    assert.strictEqual(rangeOutcome, "success", "Ranges should offer better burn protection");
    assert.strictEqual(fireOutcome, "burn", "Open fires should burn with the same roll");
}

testCookingBurnsAtLowLevel();
testCookingStopsBurningAtStopLevel();
testRecipesWithoutBurnDataAlwaysSucceed();
testOpenFirePenaltyIsStronger();

console.log("Cooking tests passed.");
