import { SkillId } from "../../../../src/rs/skill/skills";

export const HAMMER_ITEM_ID = 2347;

export type CookingHeatSource = "range" | "fire";

export type SkillSurfaceKind = "smith" | "cook" | "tan" | "smelt";

export interface SmithingRecipe {
    id: string;
    name: string;
    level: number;
    xp: number;
    barItemId: number;
    barCount: number;
    outputItemId: number;
    outputQuantity: number;
    requireHammer?: boolean;
    animation?: number;
    delayTicks?: number;
}

export interface SmeltingRequirement {
    itemId: number;
    quantity: number;
}

export interface SmeltingRecipe {
    id: string;
    name: string;
    level: number;
    xp: number;
    inputs: SmeltingRequirement[];
    outputItemId: number;
    outputQuantity: number;
    animation?: number;
    delayTicks?: number;
    successType?: "guaranteed" | "iron";
    ingredientsLabel?: string;
}

export interface CookingRecipe {
    id: string;
    name: string;
    level: number;
    xp: number;
    rawItemId: number;
    cookedItemId: number;
    burntItemId?: number;
    animation?: number;
    delayTicks?: number;
    stopBurnLevel?: number;
}

export interface TanningRecipe {
    id: string;
    name: string;
    level?: number;
    xp: number;
    inputItemId: number;
    outputItemId: number;
    animation?: number;
    delayTicks?: number;
}

export interface SkillSurfaceRecipeLookup {
    smith?: SmithingRecipe[];
    cook?: CookingRecipe[];
    tan?: TanningRecipe[];
    smelt?: SmeltingRecipe[];
}

export const SMITHING_RECIPES: SmithingRecipe[] = [
    {
        id: "bronze_dagger",
        name: "Bronze dagger",
        level: 1,
        xp: 12,
        barItemId: 2349,
        barCount: 1,
        outputItemId: 1205,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "bronze_sword",
        name: "Bronze sword",
        level: 4,
        xp: 12,
        barItemId: 2349,
        barCount: 1,
        outputItemId: 1277,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "bronze_scimitar",
        name: "Bronze scimitar",
        level: 5,
        xp: 37,
        barItemId: 2349,
        barCount: 2,
        outputItemId: 1321,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "bronze_platebody",
        name: "Bronze platebody",
        level: 18,
        xp: 112,
        barItemId: 2349,
        barCount: 5,
        outputItemId: 1117,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "iron_dagger",
        name: "Iron dagger",
        level: 15,
        xp: 25,
        barItemId: 2351,
        barCount: 1,
        outputItemId: 1203,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "iron_scimitar",
        name: "Iron scimitar",
        level: 20,
        xp: 75,
        barItemId: 2351,
        barCount: 2,
        outputItemId: 1323,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "iron_platebody",
        name: "Iron platebody",
        level: 33,
        xp: 250,
        barItemId: 2351,
        barCount: 5,
        outputItemId: 1115,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "iron_nails",
        name: "Iron nails",
        level: 34,
        xp: 38,
        barItemId: 2351,
        barCount: 1,
        outputItemId: 4820,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "steel_dagger",
        name: "Steel dagger",
        level: 30,
        xp: 37,
        barItemId: 2353,
        barCount: 1,
        outputItemId: 1207,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "steel_scimitar",
        name: "Steel scimitar",
        level: 40,
        xp: 100,
        barItemId: 2353,
        barCount: 2,
        outputItemId: 1325,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "steel_platebody",
        name: "Steel platebody",
        level: 48,
        xp: 375,
        barItemId: 2353,
        barCount: 5,
        outputItemId: 1119,
        outputQuantity: 1,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "steel_nails",
        name: "Steel nails",
        level: 46,
        xp: 50,
        barItemId: 2353,
        barCount: 1,
        outputItemId: 1539,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "bronze_arrowtips",
        name: "Bronze arrowtips",
        level: 5,
        xp: 12.5,
        barItemId: 2349,
        barCount: 1,
        outputItemId: 39,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "iron_arrowtips",
        name: "Iron arrowtips",
        level: 20,
        xp: 25,
        barItemId: 2351,
        barCount: 1,
        outputItemId: 40,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "steel_arrowtips",
        name: "Steel arrowtips",
        level: 35,
        xp: 37.5,
        barItemId: 2353,
        barCount: 1,
        outputItemId: 41,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "mithril_arrowtips",
        name: "Mithril arrowtips",
        level: 55,
        xp: 50,
        barItemId: 2359,
        barCount: 1,
        outputItemId: 42,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "adamant_arrowtips",
        name: "Adamant arrowtips",
        level: 75,
        xp: 62.5,
        barItemId: 2361,
        barCount: 1,
        outputItemId: 43,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
    {
        id: "rune_arrowtips",
        name: "Rune arrowtips",
        level: 90,
        xp: 75,
        barItemId: 2363,
        barCount: 1,
        outputItemId: 44,
        outputQuantity: 15,
        animation: 898,
        delayTicks: 4,
    },
];

export const COOKING_RECIPES: CookingRecipe[] = [
    {
        id: "cook_shrimps",
        name: "Shrimps",
        level: 1,
        xp: 30,
        rawItemId: 317,
        cookedItemId: 315,
        burntItemId: 323,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 33,
    },
    {
        id: "cook_chicken",
        name: "Chicken",
        level: 1,
        xp: 30,
        rawItemId: 2138,
        cookedItemId: 2140,
        burntItemId: 2144,
        animation: 897,
        delayTicks: 3,
    },
    {
        id: "cook_anchovies",
        name: "Anchovies",
        level: 1,
        xp: 30,
        rawItemId: 321,
        cookedItemId: 319,
        burntItemId: 323,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 34,
    },
    {
        id: "cook_trout",
        name: "Trout",
        level: 15,
        xp: 70,
        rawItemId: 335,
        cookedItemId: 333,
        burntItemId: 323,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 50,
    },
    {
        id: "cook_salmon",
        name: "Salmon",
        level: 25,
        xp: 90,
        rawItemId: 331,
        cookedItemId: 329,
        burntItemId: 323,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 58,
    },
    {
        id: "cook_tuna",
        name: "Tuna",
        level: 30,
        xp: 100,
        rawItemId: 359,
        cookedItemId: 361,
        burntItemId: 323,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 58,
    },
    {
        id: "cook_lobster",
        name: "Lobster",
        level: 40,
        xp: 120,
        rawItemId: 377,
        cookedItemId: 379,
        burntItemId: 381,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 74,
    },
    {
        id: "cook_swordfish",
        name: "Swordfish",
        level: 45,
        xp: 140,
        rawItemId: 371,
        cookedItemId: 373,
        burntItemId: 375,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 86,
    },
    {
        id: "cook_karambwan",
        name: "Karambwan",
        level: 30,
        xp: 190,
        rawItemId: 3142,
        cookedItemId: 3144,
        burntItemId: 3148,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 99,
    },
    {
        id: "cook_monkfish",
        name: "Monkfish",
        level: 62,
        xp: 150,
        rawItemId: 7944,
        cookedItemId: 7946,
        burntItemId: 7948,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 91,
    },
    {
        id: "cook_shark",
        name: "Shark",
        level: 80,
        xp: 210,
        rawItemId: 383,
        cookedItemId: 385,
        burntItemId: 387,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 94,
    },
    {
        id: "cook_manta_ray",
        name: "Manta ray",
        level: 91,
        xp: 216,
        rawItemId: 389,
        cookedItemId: 391,
        burntItemId: 393,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 99,
    },
    {
        id: "cook_dark_crab",
        name: "Dark crab",
        level: 90,
        xp: 215,
        rawItemId: 11934,
        cookedItemId: 11936,
        burntItemId: 11938,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 99,
    },
    {
        id: "cook_anglerfish",
        name: "Anglerfish",
        level: 84,
        xp: 230,
        rawItemId: 13439,
        cookedItemId: 13441,
        burntItemId: 13443,
        animation: 897,
        delayTicks: 3,
        stopBurnLevel: 99,
    },
];

export const TANNING_RECIPES: TanningRecipe[] = [
    {
        id: "tan_leather",
        name: "Leather",
        level: 1,
        xp: 1,
        inputItemId: 1739,
        outputItemId: 1741,
        animation: 1249,
        delayTicks: 2,
    },
    {
        id: "tan_hard_leather",
        name: "Hard leather",
        level: 28,
        xp: 35,
        inputItemId: 1739,
        outputItemId: 1743,
        animation: 1249,
        delayTicks: 2,
    },
    {
        id: "tan_green_dragonhide",
        name: "Green dragon leather",
        level: 57,
        xp: 62,
        inputItemId: 1753,
        outputItemId: 1745,
        animation: 1249,
        delayTicks: 2,
    },
    {
        id: "tan_blue_dragonhide",
        name: "Blue dragon leather",
        level: 66,
        xp: 70,
        inputItemId: 1751,
        outputItemId: 2505,
        animation: 1249,
        delayTicks: 2,
    },
    {
        id: "tan_red_dragonhide",
        name: "Red dragon leather",
        level: 73,
        xp: 78,
        inputItemId: 1749,
        outputItemId: 2507,
        animation: 1249,
        delayTicks: 2,
    },
    {
        id: "tan_black_dragonhide",
        name: "Black dragon leather",
        level: 79,
        xp: 86,
        inputItemId: 1747,
        outputItemId: 2509,
        animation: 1249,
        delayTicks: 2,
    },
];

const FURNACE_ANIMATION = 899;

export const SMELTING_RECIPES: SmeltingRecipe[] = [
    {
        id: "smelt_bronze_bar",
        name: "Bronze bar",
        level: 1,
        xp: 6,
        inputs: [
            { itemId: 436, quantity: 1 }, // Copper ore
            { itemId: 438, quantity: 1 }, // Tin ore
        ],
        outputItemId: 2349,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Copper + Tin ore",
    },
    {
        id: "smelt_iron_bar",
        name: "Iron bar",
        level: 15,
        xp: 13,
        inputs: [{ itemId: 440, quantity: 1 }], // Iron ore
        outputItemId: 2351,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "iron",
        ingredientsLabel: "Iron ore",
    },
    {
        id: "smelt_silver_bar",
        name: "Silver bar",
        level: 20,
        xp: 14,
        inputs: [{ itemId: 442, quantity: 1 }], // Silver ore
        outputItemId: 2355,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Silver ore",
    },
    {
        id: "smelt_steel_bar",
        name: "Steel bar",
        level: 30,
        xp: 18,
        inputs: [
            { itemId: 440, quantity: 1 }, // Iron ore
            { itemId: 453, quantity: 2 }, // Coal
        ],
        outputItemId: 2353,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Iron ore + 2 Coal",
    },
    {
        id: "smelt_gold_bar",
        name: "Gold bar",
        level: 40,
        xp: 22,
        inputs: [{ itemId: 444, quantity: 1 }], // Gold ore
        outputItemId: 2357,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Gold ore",
    },
    {
        id: "smelt_mithril_bar",
        name: "Mithril bar",
        level: 50,
        xp: 30,
        inputs: [
            { itemId: 447, quantity: 1 }, // Mithril ore
            { itemId: 453, quantity: 4 }, // Coal
        ],
        outputItemId: 2359,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Mithril ore + 4 Coal",
    },
    {
        id: "smelt_adamantite_bar",
        name: "Adamantite bar",
        level: 70,
        xp: 38,
        inputs: [
            { itemId: 449, quantity: 1 }, // Adamantite ore
            { itemId: 453, quantity: 6 }, // Coal
        ],
        outputItemId: 2361,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Adamantite ore + 6 Coal",
    },
    {
        id: "smelt_runite_bar",
        name: "Runite bar",
        level: 85,
        xp: 50,
        inputs: [
            { itemId: 451, quantity: 1 }, // Runite ore
            { itemId: 453, quantity: 8 }, // Coal
        ],
        outputItemId: 2363,
        outputQuantity: 1,
        animation: FURNACE_ANIMATION,
        delayTicks: 4,
        successType: "guaranteed",
        ingredientsLabel: "Runite ore + 8 Coal",
    },
];

export const SKILL_SURFACE_RECIPES: SkillSurfaceRecipeLookup = {
    smith: SMITHING_RECIPES,
    cook: COOKING_RECIPES,
    tan: TANNING_RECIPES,
    smelt: SMELTING_RECIPES,
};

export const SKILL_IDS_BY_KIND: Record<SkillSurfaceKind, SkillId> = {
    smith: SkillId.Smithing,
    cook: SkillId.Cooking,
    tan: SkillId.Crafting,
    smelt: SkillId.Smithing,
};

export function getSmithingRecipeById(id: string): SmithingRecipe | undefined {
    return SMITHING_RECIPES.find((recipe) => recipe.id === id);
}

export function getCookingRecipeById(id: string): CookingRecipe | undefined {
    return COOKING_RECIPES.find((recipe) => recipe.id === id);
}

export function getCookingRecipeByRawItemId(itemId: number): CookingRecipe | undefined {
    return COOKING_RECIPES.find((recipe) => recipe.rawItemId === itemId);
}

export function getTanningRecipeById(id: string): TanningRecipe | undefined {
    return TANNING_RECIPES.find((recipe) => recipe.id === id);
}

export function getSmeltingRecipeById(id: string): SmeltingRecipe | undefined {
    return SMELTING_RECIPES.find((recipe) => recipe.id === id);
}

export function calculateIronSmeltChance(level: number): number {
    const normalized = Math.max(15, Math.floor(level));
    const chancePercent = Math.min(100, 50 + (normalized - 15));
    return Math.max(0, Math.min(1, chancePercent / 100));
}

export function computeSmeltingBatchCount(
    entries: Array<{ itemId: number; quantity: number }>,
    recipe: SmeltingRecipe,
): number {
    if (!Array.isArray(recipe.inputs) || recipe.inputs.length === 0) {
        return 0;
    }
    let minBatch = Number.MAX_SAFE_INTEGER;
    for (const req of recipe.inputs) {
        const required = Math.max(1, req.quantity);
        const available = countItem(entries, req.itemId);
        const possible = Math.floor(available / required);
        minBatch = Math.min(minBatch, possible);
        if (minBatch <= 0) return 0;
    }
    if (minBatch === Number.MAX_SAFE_INTEGER) return 0;
    return Math.max(0, minBatch);
}

function countItem(entries: Array<{ itemId: number; quantity: number }>, itemId: number): number {
    if (!Array.isArray(entries)) return 0;
    let total = 0;
    for (const entry of entries) {
        if (!entry) continue;
        if (entry.itemId !== itemId) continue;
        total += Math.max(0, entry.quantity);
    }
    return total;
}

export type CookingOutcome = "success" | "burn";

export interface CookingRollOptions {
    burnBonus?: number;
    rng?: () => number;
}

export const DEFAULT_COOKING_BURN_BONUS = 3;

export function rollCookingOutcome(
    recipe: CookingRecipe,
    level: number,
    opts?: CookingRollOptions,
): CookingOutcome {
    const burntItemId = recipe.burntItemId ?? 0;
    const stopLevelRaw = recipe.stopBurnLevel ?? 0;
    if (!(burntItemId > 0 && stopLevelRaw > 0)) {
        return "success";
    }
    const stopLevel = Math.max(stopLevelRaw, recipe.level + 1);
    if (level >= stopLevel) {
        return "success";
    }
    const baseLevel = Math.max(recipe.level, 1);
    const effectiveLevel = Math.max(level, 1);
    const burnBonus = Math.max(0, opts?.burnBonus ?? DEFAULT_COOKING_BURN_BONUS);
    let burnChance = Math.max(0, 45 - burnBonus);
    const span = Math.max(1, stopLevel - baseLevel);
    const levelsProgressed = Math.max(0, effectiveLevel - baseLevel);
    const decrementPerLevel = burnChance / span;
    burnChance = Math.max(0, burnChance - levelsProgressed * decrementPerLevel);
    const roll = Math.max(0, Math.min(1, opts?.rng?.() ?? Math.random()));
    return burnChance > roll * 100 ? "burn" : "success";
}
