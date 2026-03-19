import type { ObjType } from "../../../src/rs/config/objtype/ObjType";
import {
    EquipmentSlot,
    deriveAdditionalEquipSlotsFromParams,
    deriveEquipSlotFromParams,
} from "../../../src/rs/config/player/Equipment";
import { getItemDefinition } from "../data/items";
import type { InventoryAddResult, PlayerAppearance } from "./player";

export const DEFAULT_EQUIP_SLOT_COUNT = 14;
const MAX_ITEM_STACK_QUANTITY = 2_147_483_647;

export type InventoryEntry = { itemId: number; quantity: number };
export type EquipQtyArray = number[];

/**
 * Normalize an appearance.equip array to a fixed slotCount and write it back.
 * Returns the normalized array.
 */
export function ensureEquipArrayOn(
    appearance: PlayerAppearance,
    slotCount: number = DEFAULT_EQUIP_SLOT_COUNT,
): number[] {
    let equip: number[] = Array.isArray(appearance.equip) ? appearance.equip.map((n) => n) : [];
    if (equip.length !== slotCount) {
        const next = new Array<number>(slotCount).fill(-1);
        for (let i = 0; i < Math.min(equip.length, slotCount); i++) next[i] = equip[i];
        equip = next;
    }
    appearance.equip = equip;
    return equip;
}

/**
 * Normalize an appearance.equipQty array to a fixed slotCount and write it back.
 * Quantity is only meaningful for the AMMO slot; other slots use 1 (equipped) / 0 (empty).
 */
export function ensureEquipQtyArrayOn(
    appearance: PlayerAppearance,
    slotCount: number = DEFAULT_EQUIP_SLOT_COUNT,
): EquipQtyArray {
    let equipQty: number[] = Array.isArray(appearance.equipQty)
        ? appearance.equipQty.map((n) => Math.max(0, n))
        : [];
    if (equipQty.length !== slotCount) {
        const next = new Array<number>(slotCount).fill(0);
        for (let i = 0; i < Math.min(equipQty.length, slotCount); i++) next[i] = equipQty[i];
        equipQty = next;
    }
    appearance.equipQty = equipQty;
    return equipQty;
}

export function inferEquipSlot(
    itemId: number,
    getObjType: (id: number) => ObjType | undefined,
): number | undefined {
    const obj = getObjType(itemId);
    return deriveEquipSlotFromParams(obj);
}

export function isTwoHanded(itemId: number): boolean {
    const def = getItemDefinition(itemId);
    return !!def?.doubleHanded;
}

function getEquippedSlotQuantity(equipSlot: number, equipQty: EquipQtyArray): number {
    if (equipSlot === EquipmentSlot.AMMO) {
        return Math.max(1, equipQty[equipSlot] ?? 0);
    }
    return 1;
}

function getInventoryFullReasonForEquipSlot(equipSlot: number): string {
    switch (equipSlot) {
        case EquipmentSlot.SHIELD:
            return "inventory_full_for_shield";
        case EquipmentSlot.WEAPON:
            return "inventory_full_for_weapon";
        default:
            return "inventory_full";
    }
}

function getBlockedEquipSlots(
    itemId: number,
    obj: ObjType | undefined,
    equipSlot: number,
): number[] {
    const blocked = deriveAdditionalEquipSlotsFromParams(obj).filter((slot) => slot !== equipSlot);
    if (blocked.length > 0) {
        return blocked;
    }

    // Preserve existing data-driven behavior for definitions that still rely on items.json
    // while preferring cache wearPos2/wearPos3 whenever available.
    if (equipSlot === EquipmentSlot.WEAPON && isTwoHanded(itemId)) {
        return [EquipmentSlot.SHIELD];
    }

    return [];
}

// Skillcape spot animation ids per cape item id (approximate across OSRS caches)
export const SKILLCAPE_SPOT_BY_CAPE_ID: Record<number, number> = {
    9747: 823,
    9748: 823, // Attack
    9750: 828,
    9751: 828, // Strength
    9753: 824,
    9754: 824, // Defence
    9756: 832,
    9757: 832, // Ranged
    9759: 829,
    9760: 829, // Prayer
    9762: 813,
    9763: 813, // Magic
    9765: 817,
    9766: 817, // Runecraft
    9768: 833,
    9769: 833, // Hitpoints
    9771: 830,
    9772: 830, // Agility
    9774: 835,
    9775: 835, // Herblore
    9777: 826,
    9778: 826, // Thieving
    9780: 818,
    9781: 818, // Crafting
    9783: 812,
    9784: 812, // Fletching
    9786: 827,
    9787: 827, // Slayer
    9789: 820,
    9790: 820, // Construction
    9792: 814,
    9793: 814, // Mining
    9795: 815,
    9796: 815, // Smithing
    9798: 819,
    9799: 819, // Fishing
    9801: 821,
    9802: 821, // Cooking
    9804: 831,
    9805: 831, // Firemaking
    9807: 822,
    9808: 822, // Woodcutting
    9810: 825,
    9811: 825, // Farming
    10662: 816, // Max
    9948: 907,
    9949: 907, // Hunter
};

export function getSkillcapeSpotId(capeItemId: number | undefined): number | undefined {
    if (capeItemId === undefined) return undefined;
    const id = capeItemId;
    const val = SKILLCAPE_SPOT_BY_CAPE_ID[id];
    return val !== undefined && val >= 0 ? val : undefined;
}

// Player emote sequence ids per skillcape (from common OSRS mappings)
export const SKILLCAPE_SEQ_BY_CAPE_ID: Record<number, number> = {
    9747: 4959,
    9748: 4959, // Attack
    9750: 4981,
    9751: 4981, // Strength
    9753: 4961,
    9754: 4961, // Defence
    9756: 4973,
    9757: 4973, // Ranged
    9759: 4979,
    9760: 4979, // Prayer
    9762: 4939,
    9763: 4939, // Magic
    9765: 4947,
    9766: 4947, // Runecraft
    9768: 4971,
    9769: 4971, // Hitpoints
    9771: 4977,
    9772: 4977, // Agility
    9774: 4969,
    9775: 4969, // Herblore
    9777: 4965,
    9778: 4965, // Thieving
    9780: 4949,
    9781: 4949, // Crafting
    9783: 4937,
    9784: 4937, // Fletching
    9786: 4967,
    9787: 4967, // Slayer
    9789: 4953,
    9790: 4953, // Construction
    9792: 4941,
    9793: 4941, // Mining
    9795: 4943,
    9796: 4943, // Smithing
    9798: 4951,
    9799: 4951, // Fishing
    9801: 4955,
    9802: 4955, // Cooking
    9804: 4975,
    9805: 4975, // Firemaking
    9807: 4957,
    9808: 4957, // Woodcutting
    9810: 4963,
    9811: 4963, // Farming
    10662: 4945, // Max
    9948: 5158,
    9949: 5158, // Hunter
};

export function getSkillcapeSeqId(capeItemId: number | undefined): number | undefined {
    if (capeItemId === undefined) return undefined;
    const id = capeItemId;
    const val = SKILLCAPE_SEQ_BY_CAPE_ID[id];
    return val !== undefined && val >= 0 ? val : undefined;
}

export function equipItemApply(args: {
    appearance: PlayerAppearance;
    inv: InventoryEntry[];
    slotIndex: number;
    itemId: number;
    equipSlot: number;
    getObjType: (id: number) => ObjType | undefined;
    addItemToInventory: (itemId: number, qty: number) => InventoryAddResult;
    slotCount?: number;
}): { ok: boolean; reason?: string } {
    const {
        appearance,
        inv,
        slotIndex,
        itemId,
        equipSlot,
        getObjType,
        addItemToInventory,
        slotCount = DEFAULT_EQUIP_SLOT_COUNT,
    } = args;
    const equip = ensureEquipArrayOn(appearance, slotCount);
    const equipQty = ensureEquipQtyArrayOn(appearance, slotCount);

    const src = inv[slotIndex];
    if (!src || src.itemId !== itemId || src.quantity <= 0) {
        return { ok: false, reason: "source_mismatch" };
    }

    const incomingObj = getObjType(itemId);
    const previous = equip[equipSlot];
    const previousQtyRaw = equipQty[equipSlot];
    const isAmmoSlot = equipSlot === EquipmentSlot.AMMO;
    const previousQty = isAmmoSlot ? Math.max(1, previousQtyRaw) : 1;
    const incomingQty = isAmmoSlot ? Math.max(1, src.quantity) : 1;

    if (isAmmoSlot && previous === itemId) {
        const add = Math.min(incomingQty, MAX_ITEM_STACK_QUANTITY - previousQty);
        if (add <= 0) {
            return { ok: false, reason: "inventory_full" };
        }

        equipQty[equipSlot] = previousQty + add;
        src.quantity -= add;
        if (src.quantity <= 0) {
            src.itemId = -1;
            src.quantity = 0;
        }

        return { ok: true };
    }

    const conflictSlots: number[] = [];
    const pushConflictSlot = (slot: number | undefined) => {
        if (slot === undefined || slot === equipSlot || conflictSlots.includes(slot)) return;
        if ((equip[slot] ?? -1) > 0) {
            conflictSlots.push(slot);
        }
    };

    for (const blockedSlot of getBlockedEquipSlots(itemId, incomingObj, equipSlot)) {
        pushConflictSlot(blockedSlot);
    }

    for (let equippedSlot = 0; equippedSlot < equip.length; equippedSlot++) {
        if (equippedSlot === equipSlot) continue;
        const equippedItemId = equip[equippedSlot] ?? -1;
        if (!(equippedItemId > 0)) continue;

        const equippedObj = getObjType(equippedItemId);
        const blockedSlots = getBlockedEquipSlots(equippedItemId, equippedObj, equippedSlot);
        if (blockedSlots.includes(equipSlot)) {
            pushConflictSlot(equippedSlot);
        }
    }

    const conflictDestinations = new Map<number, number>();
    let clickedSlotAvailable = previous <= 0;
    for (const conflictSlot of conflictSlots) {
        if (clickedSlotAvailable) {
            conflictDestinations.set(conflictSlot, slotIndex);
            clickedSlotAvailable = false;
            continue;
        }

        const reservedDestinations = new Set(conflictDestinations.values());
        const empty = inv.findIndex(
            (entry, idx) =>
                idx !== slotIndex &&
                !reservedDestinations.has(idx) &&
                (entry.itemId <= 0 || entry.quantity <= 0),
        );
        if (empty === -1) {
            return { ok: false, reason: getInventoryFullReasonForEquipSlot(conflictSlot) };
        }
        conflictDestinations.set(conflictSlot, empty);
    }

    // Remove from inventory
    src.itemId = -1;
    src.quantity = 0;

    // Apply equip
    equip[equipSlot] = itemId;
    equipQty[equipSlot] = incomingQty;

    for (const conflictSlot of conflictSlots) {
        const displacedItemId = equip[conflictSlot];
        if (!(displacedItemId > 0)) continue;

        const dstIndex = conflictDestinations.get(conflictSlot);
        if (dstIndex === undefined) continue;

        const dst = inv[dstIndex];
        dst.itemId = displacedItemId;
        dst.quantity = getEquippedSlotQuantity(conflictSlot, equipQty);
        equip[conflictSlot] = -1;
        equipQty[conflictSlot] = 0;
    }

    // Swap previous equipped item back into the clicked inventory slot (OSRS behaviour)
    if (previous > 0) {
        const dst = inv[slotIndex];
        dst.itemId = previous;
        dst.quantity = previousQty;
    }

    return { ok: true };
}

export function unequipItemApply(args: {
    appearance: PlayerAppearance;
    equipSlot: number;
    addItemToInventory: (itemId: number, qty: number) => InventoryAddResult;
    slotCount?: number;
}): { ok: boolean; reason?: string } {
    const {
        appearance,
        equipSlot,
        addItemToInventory,
        slotCount = DEFAULT_EQUIP_SLOT_COUNT,
    } = args;
    const equip = ensureEquipArrayOn(appearance, slotCount);
    const equipQty = ensureEquipQtyArrayOn(appearance, slotCount);
    const itemId = equip[equipSlot];
    if (!(itemId > 0)) return { ok: false, reason: "equipment_slot_empty" };
    const isAmmoSlot = equipSlot === EquipmentSlot.AMMO;
    const qtyRaw = equipQty[equipSlot];
    const qty = isAmmoSlot ? Math.max(1, qtyRaw) : 1;
    const dest = addItemToInventory(itemId, qty);
    if (dest.added <= 0) return { ok: false, reason: "inventory_full" };
    equip[equipSlot] = -1;
    equipQty[equipSlot] = 0;
    return { ok: true };
}

export function consumeEquippedAmmoApply(args: {
    appearance: PlayerAppearance;
    count: number;
    slotCount?: number;
}): { ok: boolean; reason?: string; itemId?: number; remaining?: number } {
    const { appearance, count, slotCount = DEFAULT_EQUIP_SLOT_COUNT } = args;
    const shots = Math.max(1, count);
    const equip = ensureEquipArrayOn(appearance, slotCount);
    const equipQty = ensureEquipQtyArrayOn(appearance, slotCount);

    const ammoItemId = equip[EquipmentSlot.AMMO];
    if (!(ammoItemId > 0)) return { ok: false, reason: "ammo_missing" };

    const qtyRaw = equipQty[EquipmentSlot.AMMO];
    const qty = Math.max(1, qtyRaw);
    if (qty < shots) return { ok: false, reason: "ammo_insufficient", itemId: ammoItemId };

    const remaining = qty - shots;
    if (remaining <= 0) {
        equip[EquipmentSlot.AMMO] = -1;
        equipQty[EquipmentSlot.AMMO] = 0;
        return { ok: true, itemId: ammoItemId, remaining: 0 };
    }
    equipQty[EquipmentSlot.AMMO] = remaining;
    return { ok: true, itemId: ammoItemId, remaining };
}

// Equipment sounds - per-category (from cache synth/equipsounds)
export const EQUIP_SOUNDS = {
    AXE: 2229, // Woodcutting axes
    BACKPACK: 3284, // Backpacks
    BANNER: 2231, // Banners
    BATTLEAXE: 2232, // Battleaxes, pickaxes
    BLUNT: 2233, // Maces, hammers
    BODY: 2234, // Generic body armor
    BOLT: 2235, // Bolts
    ELEMENTAL_STAFF: 2230, // Elemental staves
    FEET: 2237, // Boots
    FUN: 2238, // Capes, rings, amulets, misc
    HANDS: 2236, // Gloves
    HELMET: 2240, // Helmets
    JESTER: 3285, // Jester items
    LEATHER: 2241, // D'hide, leather armor
    LEGS: 2242, // Generic legs
    METAL_BODY: 2239, // Platebodies, chainbodies
    METAL_CHARM: 6597, // Metal charms
    METAL_LEGS: 2243, // Platelegs
    RANGED: 2244, // Bows, crossbows
    SHIELD: 2245, // Shields
    SILVERLIGHT: 2990, // Silverlight
    SPIKED: 2246, // Spiked weapons (flails)
    STAFF: 2247, // Staves
    SWORD: 2248, // Swords, scimitars, daggers
    WHIP: 2249, // Whips
    WOOD: 2250, // Wooden items
} as const;

/**
 * Pick the appropriate equip/unequip sound based on equipment slot and item name.
 * Falls back to EQUIP_SOUNDS.FUN (2238) for unknown items.
 */
export function pickEquipSound(equipSlot: number, itemName: string): number {
    const name = (itemName || "").toLowerCase();

    switch (equipSlot) {
        case EquipmentSlot.HEAD:
            return EQUIP_SOUNDS.HELMET;
        case EquipmentSlot.CAPE:
            return EQUIP_SOUNDS.FUN;
        case EquipmentSlot.AMULET:
            return EQUIP_SOUNDS.FUN;
        case EquipmentSlot.GLOVES:
            if (name.includes("vamb") || name.includes("leather") || name.includes("hide")) {
                return EQUIP_SOUNDS.LEATHER;
            }
            return EQUIP_SOUNDS.HANDS;
        case EquipmentSlot.BOOTS:
            return EQUIP_SOUNDS.FEET;
        case EquipmentSlot.RING:
            return EQUIP_SOUNDS.FUN;
        case EquipmentSlot.SHIELD:
            return EQUIP_SOUNDS.SHIELD;
        case EquipmentSlot.BODY:
            if (name.includes("platebody") || name.includes("chainbody")) {
                return EQUIP_SOUNDS.METAL_BODY;
            }
            if (name.includes("hide") || name.includes("leather") || name.includes("chaps")) {
                return EQUIP_SOUNDS.LEATHER;
            }
            return EQUIP_SOUNDS.BODY;
        case EquipmentSlot.LEGS:
            if (name.includes("platelegs") || name.includes("plateskirt")) {
                return EQUIP_SOUNDS.METAL_LEGS;
            }
            if (name.includes("hide") || name.includes("leather") || name.includes("chaps")) {
                return EQUIP_SOUNDS.LEATHER;
            }
            return EQUIP_SOUNDS.LEGS;
        case EquipmentSlot.AMMO:
            if (name.includes("bolt")) {
                return EQUIP_SOUNDS.BOLT;
            }
            return EQUIP_SOUNDS.RANGED;
        case EquipmentSlot.WEAPON:
            if (name.includes("whip")) return EQUIP_SOUNDS.WHIP;
            if (name.includes("staff") || name.includes("wand")) {
                if (
                    name.includes("fire") ||
                    name.includes("water") ||
                    name.includes("air") ||
                    name.includes("earth")
                ) {
                    return EQUIP_SOUNDS.ELEMENTAL_STAFF;
                }
                return EQUIP_SOUNDS.STAFF;
            }
            if (name.includes("bow") || name.includes("crossbow")) return EQUIP_SOUNDS.RANGED;
            if (name.includes("axe") && !name.includes("pickaxe") && !name.includes("battleaxe")) {
                return EQUIP_SOUNDS.AXE;
            }
            if (name.includes("pickaxe") || name.includes("battleaxe"))
                return EQUIP_SOUNDS.BATTLEAXE;
            if (name.includes("mace") || name.includes("hammer") || name.includes("maul")) {
                return EQUIP_SOUNDS.BLUNT;
            }
            if (name.includes("flail")) return EQUIP_SOUNDS.SPIKED;
            if (name.includes("silverlight") || name.includes("darklight"))
                return EQUIP_SOUNDS.SILVERLIGHT;
            if (
                name.includes("sword") ||
                name.includes("scimitar") ||
                name.includes("dagger") ||
                name.includes("rapier") ||
                name.includes("longsword") ||
                name.includes("sabre")
            ) {
                return EQUIP_SOUNDS.SWORD;
            }
            if (name.includes("wooden") || name.includes("oak") || name.includes("willow")) {
                return EQUIP_SOUNDS.WOOD;
            }
            return EQUIP_SOUNDS.SWORD; // Default weapon sound
        default:
            return EQUIP_SOUNDS.FUN;
    }
}
