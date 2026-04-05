import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import type { SmeltingRecipe } from "./smithingData";

export const RING_OF_FORGING_ITEM_ID = 2568;
export const GOLDSMITH_GAUNTLETS_ITEM_ID = 776;
export const RING_OF_FORGING_MAX_CHARGES = 140;
const GOLD_BAR_ITEM_ID = 2357;
const GOLD_GAUNTLETS_XP_MULTIPLIER = 2.5;

type EquipArray = ReadonlyArray<number> | undefined;

function getEquippedItem(equip: EquipArray, slot: EquipmentSlot): number {
    if (!Array.isArray(equip) || slot < 0 || slot >= equip.length) return -1;
    const value = equip[slot];
    return Number.isFinite(value) ? (value as number) : -1;
}

export function hasRingOfForging(equip: EquipArray): boolean {
    return getEquippedItem(equip, EquipmentSlot.RING) === RING_OF_FORGING_ITEM_ID;
}

export function hasGoldsmithGauntlets(equip: EquipArray): boolean {
    return getEquippedItem(equip, EquipmentSlot.GLOVES) === GOLDSMITH_GAUNTLETS_ITEM_ID;
}

export function shouldGuaranteeIronSmelt(
    recipe: SmeltingRecipe,
    equip: EquipArray,
    chargesRemaining?: number,
): boolean {
    if (recipe.successType !== "iron") return false;
    if (!hasRingOfForging(equip)) return false;
    if (chargesRemaining !== undefined && !(chargesRemaining > 0)) return false;
    return true;
}

export function getSmeltingXpWithBonuses(recipe: SmeltingRecipe, equip: EquipArray): number {
    const base = recipe?.xp ?? 0;
    if (base <= 0) return base;
    if (recipe.outputItemId === GOLD_BAR_ITEM_ID && hasGoldsmithGauntlets(equip)) {
        return Math.floor(base * GOLD_GAUNTLETS_XP_MULTIPLIER);
    }
    return base;
}
