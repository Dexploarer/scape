import { ObjType } from "../objtype/ObjType";
import { PlayerAppearance } from "./PlayerAppearance";

// Mirrors OSRS slot ordering used by PlayerComposition.equipment (12 slots)
export enum EquipmentSlot {
    HEAD = 0,
    CAPE = 1,
    AMULET = 2,
    WEAPON = 3,
    BODY = 4,
    SHIELD = 5,
    LEGS = 6,
    GLOVES = 7,
    BOOTS = 8,
    RING = 9,
    AMMO = 10,
    HEAD2 = 11, // secondary head/chat-head component slot
}

// OSRS IF3/wornicons display indices used by enum_904 and sprite tokens
export enum EquipmentDisplaySlot {
    HEAD = 0,
    CAPE = 1,
    AMULET = 2,
    WEAPON = 3,
    BODY = 4,
    SHIELD = 5,
    LEGS = 7,
    GLOVES = 9,
    BOOTS = 10,
    RING = 12,
    AMMO = 13,
}

// Mapping between display indices and PlayerAppearance.equip indices
export const DisplayToEquipSlot: Record<number, EquipmentSlot> = {
    [EquipmentDisplaySlot.HEAD]: EquipmentSlot.HEAD,
    [EquipmentDisplaySlot.CAPE]: EquipmentSlot.CAPE,
    [EquipmentDisplaySlot.AMULET]: EquipmentSlot.AMULET,
    [EquipmentDisplaySlot.WEAPON]: EquipmentSlot.WEAPON,
    [EquipmentDisplaySlot.BODY]: EquipmentSlot.BODY,
    [EquipmentDisplaySlot.SHIELD]: EquipmentSlot.SHIELD,
    [EquipmentDisplaySlot.LEGS]: EquipmentSlot.LEGS,
    [EquipmentDisplaySlot.GLOVES]: EquipmentSlot.GLOVES,
    [EquipmentDisplaySlot.BOOTS]: EquipmentSlot.BOOTS,
    [EquipmentDisplaySlot.RING]: EquipmentSlot.RING,
    [EquipmentDisplaySlot.AMMO]: EquipmentSlot.AMMO,
};

export const EquipToDisplaySlot: Record<number, EquipmentDisplaySlot> = {
    [EquipmentSlot.HEAD]: EquipmentDisplaySlot.HEAD,
    [EquipmentSlot.CAPE]: EquipmentDisplaySlot.CAPE,
    [EquipmentSlot.AMULET]: EquipmentDisplaySlot.AMULET,
    [EquipmentSlot.WEAPON]: EquipmentDisplaySlot.WEAPON,
    [EquipmentSlot.BODY]: EquipmentDisplaySlot.BODY,
    [EquipmentSlot.SHIELD]: EquipmentDisplaySlot.SHIELD,
    [EquipmentSlot.LEGS]: EquipmentDisplaySlot.LEGS,
    [EquipmentSlot.GLOVES]: EquipmentDisplaySlot.GLOVES,
    [EquipmentSlot.BOOTS]: EquipmentDisplaySlot.BOOTS,
    [EquipmentSlot.RING]: EquipmentDisplaySlot.RING,
    [EquipmentSlot.AMMO]: EquipmentDisplaySlot.AMMO,
};

// Head coverage behavior removed: server is expected to provide final appearance kits.

// OSRS equipment slot param mapping seen in item.params[1564]
// Observed values from dump: 0=head, 3=weapon, 4=body, 5=shield, 7=legs
export const OSRS_EQUIP_SLOT_PARAM_ID = 1564;

export function mapPlayerCompositionSlot(
    slotId: number | undefined | null,
): EquipmentSlot | undefined {
    if (slotId === undefined || slotId === null) return undefined;

    switch (slotId | 0) {
        case 0:
            return EquipmentSlot.HEAD;
        case 1:
            return EquipmentSlot.CAPE;
        case 2:
            return EquipmentSlot.AMULET;
        case 3:
            return EquipmentSlot.WEAPON;
        case 4:
            return EquipmentSlot.BODY;
        case 5:
            return EquipmentSlot.SHIELD;
        case 7:
            return EquipmentSlot.LEGS;
        case 9:
            return EquipmentSlot.GLOVES;
        case 10:
            return EquipmentSlot.BOOTS;
        case 11:
            return EquipmentSlot.HEAD2;
        case 12:
            return EquipmentSlot.RING as any; // some revisions use 12 for ring
        case 13:
            return EquipmentSlot.AMMO as any; // some revisions use 13 for ammo
        default:
            return undefined;
    }
}

export function deriveEquipSlotFromParams(obj: ObjType | undefined): EquipmentSlot | undefined {
    if (!obj) return undefined;
    let slotId: number | undefined;
    if (obj.params) {
        slotId = obj.params.get(OSRS_EQUIP_SLOT_PARAM_ID) as number | undefined;
    }
    // item "wearpos" is stored as opcode 13 in ObjType and indicates the equipment slot
    // using PlayerComposition indices (e.g., 0=head, 3=weapon, 4=body, 5=shield, 7=legs).
    if (slotId === undefined || slotId === null) {
        const wearPos = (obj as any).op13;
        if (typeof wearPos === "number" && wearPos >= 0) {
            slotId = wearPos | 0;
        }
    }
    return mapPlayerCompositionSlot(slotId);
}

export function deriveAdditionalEquipSlotsFromParams(obj: ObjType | undefined): EquipmentSlot[] {
    if (!obj) return [];

    const resolved = [mapPlayerCompositionSlot(obj.op14), mapPlayerCompositionSlot(obj.op27)];
    const slots: EquipmentSlot[] = [];
    for (const slot of resolved) {
        if (slot === undefined || slots.includes(slot)) continue;
        slots.push(slot);
    }
    return slots;
}

// Heuristic keyword lists to determine whether a head-slot item should suppress
// the base head/jaw identity kits (complete helmets, masks, etc.).
const HEAD_HIDE_KEYWORDS = [
    "helm",
    "hood",
    "mask",
    "cowl",
    "faceguard",
    "facemask",
    "helmet",
    "headpiece",
    "headdress",
    "earmuff",
    "visage",
];

const HEAD_SHOW_KEYWORDS = [
    "hat",
    "cap",
    "crown",
    "tiara",
    "circlet",
    "wreath",
    "hair",
    "headband",
];

function matchesKeyword(name: string, keywords: string[]): boolean {
    for (const key of keywords) {
        if (name.includes(key)) return true;
    }
    return false;
}

export enum HeadCoverage {
    NONE = 0,
    HEAD = 1,
    HEAD_AND_JAW = 2,
}

export function getHeadCoverage(obj: ObjType | undefined): HeadCoverage {
    const rawName = obj?.name;
    if (typeof rawName !== "string") return HeadCoverage.NONE;
    const name = rawName.toLowerCase();
    if (matchesKeyword(name, HEAD_SHOW_KEYWORDS)) return HeadCoverage.NONE;
    if (name.includes("med helm")) return HeadCoverage.HEAD;
    if (matchesKeyword(name, HEAD_HIDE_KEYWORDS)) return HeadCoverage.HEAD_AND_JAW;
    return HeadCoverage.NONE;
}

export function itemHidesHead(obj: ObjType | undefined): boolean {
    return getHeadCoverage(obj) !== HeadCoverage.NONE;
}
