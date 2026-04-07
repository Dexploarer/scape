/**
 * Degradation System for OSRS equipment.
 *
 * Handles equipment that degrades with use:
 * - Crystal bow (historical): Item ID changes every 250 shots
 * - Crystal bow (modern): Varbit-based charges up to 20,000
 * - Barrows equipment: Degrades to "0" state after 15 hours of combat
 * - Other degradable items
 *
 *  Notes:
 * - Historical crystal bow: 4212 (new) → 4214 (full) → 4215-4223 (9/10 to 1/10) → seed
 * - Each state lasts 250 shots, total 2,500 shots
 * - Stats decrease linearly: Ranged atk 100→64, Ranged str 70→52
 */
import type { PlayerState } from "../player";

// =============================================================================
// Types
// =============================================================================

export interface DegradableItemConfig {
    /** Base item ID (e.g., 4212 for new crystal bow) */
    baseItemId: number;
    /** Item IDs in degradation order (first = new/full, last = most degraded) */
    itemIds: number[];
    /** Charges per degradation level (e.g., 250 for crystal bow) */
    chargesPerLevel: number;
    /** Total charges before fully depleted */
    totalCharges: number;
    /** Item ID when fully depleted (e.g., crystal seed), or -1 to destroy */
    depletedItemId: number;
    /** Whether first use transforms from "new" to "full" state */
    transformOnFirstUse: boolean;
    /** Varbit ID for modern charge tracking (if applicable) */
    chargeVarbit?: number;
}

export interface ItemChargeState {
    /** Current charges remaining */
    charges: number;
    /** Current item ID */
    currentItemId: number;
}

// =============================================================================
// Crystal Bow Configuration
// =============================================================================

/** Historical crystal bow item IDs in degradation order */
export const CRYSTAL_BOW_ITEM_IDS = [
    4212, // New crystal bow
    4214, // Crystal bow full (10/10)
    4215, // Crystal bow 9/10
    4216, // Crystal bow 8/10
    4217, // Crystal bow 7/10
    4218, // Crystal bow 6/10
    4219, // Crystal bow 5/10
    4220, // Crystal bow 4/10
    4221, // Crystal bow 3/10
    4222, // Crystal bow 2/10
    4223, // Crystal bow 1/10
];

/** Crystal seed item ID (returned when bow fully depletes) */
export const CRYSTAL_SEED_ID = 4207;

/** Historical crystal bow configuration */
export const CRYSTAL_BOW_CONFIG: DegradableItemConfig = {
    baseItemId: 4212,
    itemIds: CRYSTAL_BOW_ITEM_IDS,
    chargesPerLevel: 250,
    totalCharges: 2500,
    depletedItemId: CRYSTAL_SEED_ID,
    transformOnFirstUse: true, // New (4212) → Full (4214) on first shot
};

/** Modern crystal bow (post-Song of the Elves) item IDs */
export const MODERN_CRYSTAL_BOW_IDS = [23983, 24123];

/** Modern crystal bow varbit for charge tracking */
export const CRYSTAL_BOW_CHARGE_VARBIT = 4212; // TODO: Find correct varbit ID

// =============================================================================
// Crystal Shield Configuration
// =============================================================================

export const CRYSTAL_SHIELD_ITEM_IDS = [
    4224, // New crystal shield
    4225, // Crystal shield full
    4226, // Crystal shield 9/10
    4227, // Crystal shield 8/10
    4228, // Crystal shield 7/10
    4229, // Crystal shield 6/10
    4230, // Crystal shield 5/10
    4231, // Crystal shield 4/10
    4232, // Crystal shield 3/10
    4233, // Crystal shield 2/10
    4234, // Crystal shield 1/10
];

export const CRYSTAL_SHIELD_CONFIG: DegradableItemConfig = {
    baseItemId: 4224,
    itemIds: CRYSTAL_SHIELD_ITEM_IDS,
    chargesPerLevel: 250,
    totalCharges: 2500,
    depletedItemId: CRYSTAL_SEED_ID,
    transformOnFirstUse: true,
};

// =============================================================================
// Lookup Maps
// =============================================================================

/** Map from item ID to its degradation config */
const DEGRADABLE_CONFIGS = new Map<number, DegradableItemConfig>();

// Register crystal bow variants
for (const itemId of CRYSTAL_BOW_ITEM_IDS) {
    DEGRADABLE_CONFIGS.set(itemId, CRYSTAL_BOW_CONFIG);
}

// Register crystal shield variants
for (const itemId of CRYSTAL_SHIELD_ITEM_IDS) {
    DEGRADABLE_CONFIGS.set(itemId, CRYSTAL_SHIELD_CONFIG);
}

// =============================================================================
// DegradationSystem Class
// =============================================================================

export class DegradationSystem {
    /**
     * Check if an item is degradable.
     */
    static isDegradable(itemId: number): boolean {
        return DEGRADABLE_CONFIGS.has(itemId);
    }

    /**
     * Get the degradation config for an item.
     */
    static getConfig(itemId: number): DegradableItemConfig | undefined {
        return DEGRADABLE_CONFIGS.get(itemId);
    }

    /**
     * Get the current degradation level (0 = new/full, 10 = depleted).
     */
    static getDegradationLevel(itemId: number): number {
        const config = DEGRADABLE_CONFIGS.get(itemId);
        if (!config) return -1;
        const index = config.itemIds.indexOf(itemId);
        return index >= 0 ? index : -1;
    }

    /**
     * Get the item ID for a specific degradation level.
     */
    static getItemIdForLevel(config: DegradableItemConfig, level: number): number {
        if (level < 0) return config.itemIds[0];
        if (level >= config.itemIds.length) return config.depletedItemId;
        return config.itemIds[level];
    }

    /**
     * Calculate remaining charges based on current item ID.
     * For historical items, charges are implicit based on item ID.
     */
    static getRemainingCharges(itemId: number, usedInCurrentLevel: number = 0): number {
        const config = DEGRADABLE_CONFIGS.get(itemId);
        if (!config) return 0;

        const level = this.getDegradationLevel(itemId);
        if (level < 0) return 0;

        // New item (level 0) has full charges
        // Each subsequent level has (totalLevels - level) * chargesPerLevel remaining
        const totalLevels = config.itemIds.length - 1; // Exclude "new" state
        const remainingLevels = totalLevels - level;
        const chargesFromLevels = remainingLevels * config.chargesPerLevel;

        return Math.max(0, chargesFromLevels - usedInCurrentLevel);
    }

    /**
     * Process a use of the degradable item (e.g., firing the crystal bow).
     * Returns the new item ID after degradation (or same ID if no change).
     */
    static processUse(
        itemId: number,
        currentChargesUsed: number,
    ): { newItemId: number; depleted: boolean; chargesUsed: number } {
        const config = DEGRADABLE_CONFIGS.get(itemId);
        if (!config) {
            return { newItemId: itemId, depleted: false, chargesUsed: currentChargesUsed };
        }

        const level = this.getDegradationLevel(itemId);
        if (level < 0) {
            return { newItemId: itemId, depleted: false, chargesUsed: currentChargesUsed };
        }

        // Handle "new" → "full" transformation on first use
        if (level === 0 && config.transformOnFirstUse) {
            // Transform from "new" to "full" (level 1)
            const newItemId = config.itemIds[1];
            return { newItemId, depleted: false, chargesUsed: 1 };
        }

        // Increment charges used
        const newChargesUsed = currentChargesUsed + 1;

        // Check if we need to degrade to next level
        if (newChargesUsed >= config.chargesPerLevel) {
            const nextLevel = level + 1;
            if (nextLevel >= config.itemIds.length) {
                // Fully depleted
                return {
                    newItemId: config.depletedItemId,
                    depleted: true,
                    chargesUsed: 0,
                };
            }
            // Degrade to next level
            return {
                newItemId: config.itemIds[nextLevel],
                depleted: false,
                chargesUsed: 0, // Reset counter for new level
            };
        }

        // No state change, just increment charges
        return { newItemId: itemId, depleted: false, chargesUsed: newChargesUsed };
    }

    /**
     * Check if the item is in "new" state (transforms on first use).
     */
    static isNewState(itemId: number): boolean {
        const config = DEGRADABLE_CONFIGS.get(itemId);
        if (!config || !config.transformOnFirstUse) return false;
        return config.itemIds[0] === itemId;
    }

    /**
     * Check if the item is fully depleted (e.g., crystal seed).
     */
    static isDepleted(itemId: number): boolean {
        for (const config of DEGRADABLE_CONFIGS.values()) {
            if (config.depletedItemId === itemId) return true;
        }
        return false;
    }
}

// =============================================================================
// Player Charge Tracking
// =============================================================================

/**
 * Track charges used in current degradation level.
 * Key: slot index (e.g., weapon slot)
 * Value: charges used in current level (0-249 for crystal bow)
 */
export type ChargeTracker = Map<number, number>;

/**
 * Create a new charge tracker for a player.
 */
export function createChargeTracker(): ChargeTracker {
    return new Map();
}

/**
 * Get charges used in current level for a slot.
 */
export function getChargesUsed(tracker: ChargeTracker, slot: number): number {
    return tracker.get(slot) ?? 0;
}

/**
 * Set charges used in current level for a slot.
 */
export function setChargesUsed(tracker: ChargeTracker, slot: number, charges: number): void {
    tracker.set(slot, charges);
}

/**
 * Reset charges for a slot (called when item changes).
 */
export function resetCharges(tracker: ChargeTracker, slot: number): void {
    tracker.delete(slot);
}
