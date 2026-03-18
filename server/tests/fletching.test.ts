import assert from "assert";

import {
    BOW_STRING_ITEM_ID,
    FLETCHING_COMBINE_RECIPES,
    FLETCHING_LOG_IDS,
    FLETCHING_STRING_IDS,
    getFletchingProductsForLog,
    getFletchingRecipeById,
    getStringingRecipeByUnstrungId,
} from "../src/game/skills/fletching";

function testLogRegistry(): void {
    assert.ok(FLETCHING_LOG_IDS.length >= 6, "expected fletching log registry to be populated");
    for (const logId of FLETCHING_LOG_IDS) {
        const products = getFletchingProductsForLog(logId);
        assert.ok(products, `expected products for log ${logId}`);
        assert.ok(products!.length >= 2, `log ${logId} should have at least two outputs`);
        for (const product of products!) {
            assert.ok(product.id.length > 0, "product id should be defined");
            assert.ok(product.level > 0, "product should have a positive level requirement");
            assert.ok(product.xp > 0, "product should award xp");
        }
    }
}

function testRecipeLookup(): void {
    const mapleLongbow = getFletchingRecipeById("log_1517_longbow_u");
    assert.ok(mapleLongbow, "maple longbow recipe should exist");
    assert.strictEqual(
        mapleLongbow?.productItemId,
        62,
        "maple longbow (u) should use the correct item id",
    );
    assert.strictEqual(mapleLongbow?.level, 55);
    assert.strictEqual(mapleLongbow?.xp, 58.3);

    const magicShortbow = getFletchingRecipeById("log_1513_shortbow_u");
    assert.ok(magicShortbow, "magic shortbow recipe should exist");
    assert.strictEqual(magicShortbow?.level, 80);
    assert.strictEqual(magicShortbow?.xp, 83.3);

    const oakShafts = getFletchingRecipeById("log_1521_arrow_shafts");
    assert.ok(oakShafts, "oak arrow shaft recipe should exist");
    assert.strictEqual(oakShafts?.outputQuantity, 30);
    assert.strictEqual(oakShafts?.xp, 10);
}

function testStringingRecipes(): void {
    assert.ok(FLETCHING_STRING_IDS.length >= 6, "stringing registry should be populated");
    const magicShort = getStringingRecipeByUnstrungId(72);
    assert.ok(magicShort, "magic shortbow stringing recipe should exist");
    assert.strictEqual(magicShort?.secondaryItemId, BOW_STRING_ITEM_ID);
    assert.strictEqual(magicShort?.productItemId, 861);
    assert.strictEqual(magicShort?.mode, "string");
    assert.strictEqual(magicShort?.xp, 83.3);
}

function testCombineRecipes(): void {
    assert.ok(
        FLETCHING_COMBINE_RECIPES.length >= 2,
        "combine registry should include headless/arrow recipes",
    );
    const headless = FLETCHING_COMBINE_RECIPES.find((recipe) => recipe.productItemId === 53);
    assert.ok(headless, "headless arrow recipe should be registered");
    assert.strictEqual(headless?.mode, "combine");
    assert.strictEqual(headless?.level, 1);
    assert.strictEqual(headless?.xp, 1);
    assert.strictEqual(headless?.outputQuantity, 1);

    const runeArrow = getFletchingRecipeById("combine_headless_rune_arrows");
    assert.ok(runeArrow, "rune arrow recipe should exist");
    assert.strictEqual(runeArrow?.secondaryItemId, 44);
    assert.strictEqual(runeArrow?.productItemId, 892);
    assert.strictEqual(runeArrow?.level, 75);
    assert.strictEqual(runeArrow?.xp, 12.5);

    const amethystArrow = getFletchingRecipeById("combine_headless_amethyst_arrows");
    assert.ok(amethystArrow, "amethyst arrow recipe should exist");
    assert.strictEqual(amethystArrow?.level, 82);
    assert.strictEqual(amethystArrow?.xp, 13.5);
    assert.strictEqual(amethystArrow?.productItemId, 21326);

    const amethystTips = getFletchingRecipeById("carve_amethyst_arrowtips");
    assert.ok(amethystTips, "amethyst arrowtip recipe should exist");
    assert.strictEqual(amethystTips?.outputQuantity, 15);
    assert.strictEqual(amethystTips?.level, 85);
    assert.strictEqual(amethystTips?.xp, 60);
    assert.strictEqual(amethystTips?.consumeSecondary, false);
    assert.strictEqual(amethystTips?.secondaryIsTool, true);
    assert.strictEqual(amethystTips?.mode, "combine");

    const amethystBoltTips = getFletchingRecipeById("carve_amethyst_bolt_tips");
    assert.ok(amethystBoltTips, "amethyst bolt tip recipe should exist");
    assert.strictEqual(amethystBoltTips?.productItemId, 21338);
    assert.strictEqual(amethystBoltTips?.level, 85);
    assert.strictEqual(amethystBoltTips?.consumeSecondary, false);

    const amethystBroadBolts = getFletchingRecipeById("combine_broad_bolts_amethyst");
    assert.ok(amethystBroadBolts, "amethyst broad bolt recipe should exist");
    assert.strictEqual(amethystBroadBolts?.productItemId, 21316);
    assert.strictEqual(amethystBroadBolts?.level, 76);
    assert.strictEqual(amethystBroadBolts?.xp, 10.6);

    const amethystJavelinHeads = getFletchingRecipeById("carve_amethyst_javelin_heads");
    assert.ok(amethystJavelinHeads, "amethyst javelin head recipe should exist");
    assert.strictEqual(amethystJavelinHeads?.productItemId, 21352);

    const amethystJavelin = getFletchingRecipeById("combine_javelin_shafts_amethyst");
    assert.ok(amethystJavelin, "amethyst javelin recipe should exist");
    assert.strictEqual(amethystJavelin?.productItemId, 21318);
    assert.strictEqual(amethystJavelin?.level, 84);
    assert.strictEqual(amethystJavelin?.xp, 13.5);

    const amethystDartTips = getFletchingRecipeById("carve_amethyst_dart_tips");
    assert.ok(amethystDartTips, "amethyst dart tip recipe should exist");
    assert.strictEqual(amethystDartTips?.productItemId, 25853);

    const amethystDart = getFletchingRecipeById("combine_amethyst_dart_tips_feathers");
    assert.ok(amethystDart, "amethyst dart recipe should exist");
    assert.strictEqual(amethystDart?.productItemId, 25849);
    assert.strictEqual(amethystDart?.level, 90);
    assert.strictEqual(amethystDart?.xp, 21);
}

testLogRegistry();
testRecipeLookup();
testStringingRecipes();
testCombineRecipes();

console.log("Fletching tests passed.");
