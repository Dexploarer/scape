import { SkillId } from "../skill/skills";

export type PrayerGroup =
    | "attack"
    | "strength"
    | "defence"
    | "ranged"
    | "magic"
    | "overhead"
    | "combat";

export type PrayerHeadIcon =
    | "protect_melee"
    | "protect_missiles"
    | "protect_magic"
    | "retribution"
    | "redemption"
    | "smite";

export const PRAYER_HEAD_ICON_ORDER: PrayerHeadIcon[] = [
    "protect_melee",
    "protect_missiles",
    "protect_magic",
    "retribution",
    "smite",
    "redemption",
];

export const PRAYER_HEAD_ICON_IDS: Record<PrayerHeadIcon, number> = PRAYER_HEAD_ICON_ORDER.reduce(
    (acc, icon, idx) => {
        acc[icon] = idx;
        return acc;
    },
    {} as Record<PrayerHeadIcon, number>,
);

export type PrayerSpecialEffect =
    | "rapid_restore"
    | "rapid_heal"
    | "protect_item"
    | "retribution"
    | "redemption"
    | "smite"
    | "preserve";

export type PrayerName =
    | "thick_skin"
    | "burst_of_strength"
    | "clarity_of_thought"
    | "sharp_eye"
    | "mystic_will"
    | "rock_skin"
    | "superhuman_strength"
    | "improved_reflexes"
    | "rapid_restore"
    | "rapid_heal"
    | "protect_item"
    | "hawk_eye"
    | "mystic_lore"
    | "steel_skin"
    | "ultimate_strength"
    | "incredible_reflexes"
    | "protect_from_magic"
    | "protect_from_missiles"
    | "protect_from_melee"
    | "eagle_eye"
    | "mystic_might"
    | "retribution"
    | "redemption"
    | "smite"
    | "preserve"
    | "chivalry"
    | "piety"
    | "rigour"
    | "augury";

interface PrayerDefinitionInit {
    readonly id: PrayerName;
    readonly name: string;
    readonly description: string;
    readonly level: number;
    readonly drainRate: number;
    readonly quickSlot: number | null;
    readonly varbit?: number;
    readonly order: number;
    readonly groups?: PrayerGroup;
    readonly exclusiveGroups: PrayerGroup[];
    readonly headIcon?: PrayerHeadIcon;
    readonly specialEffect?: PrayerSpecialEffect;
    readonly unlockVarbit?: number;
    readonly questRequirement?: { varbit: number; minValue: number; hint: string };
    readonly soundId?: number;
    readonly category: "offence" | "defence" | "overhead" | "utility";
    readonly statBoosts?: Partial<Record<SkillId, number>>;
}

export interface PrayerDefinition extends PrayerDefinitionInit {
    readonly spriteOnId: number;
    readonly spriteOffId: number;
}

const QUEST_VARBIT_KINGS_RANSOM = 3909;
const RIGOUR_UNLOCK_VARBIT = 5451;
const AUGURY_UNLOCK_VARBIT = 5452;
const PRESERVE_UNLOCK_VARBIT = 5453;

const BASE_DEFINITIONS: PrayerDefinitionInit[] = [
    {
        id: "thick_skin",
        name: "Thick Skin",
        description: "+5% Defence.",
        level: 1,
        drainRate: 1,
        quickSlot: 0,
        varbit: 4104,
        order: 0,
        groups: "defence",
        exclusiveGroups: ["defence", "combat"],
        soundId: 2690,
        category: "defence",
        statBoosts: { [SkillId.Defence]: 5 },
    },
    {
        id: "burst_of_strength",
        name: "Burst of Strength",
        description: "+5% Strength.",
        level: 4,
        drainRate: 1,
        quickSlot: 1,
        varbit: 4105,
        order: 1,
        groups: "strength",
        exclusiveGroups: ["strength", "ranged", "magic", "combat"],
        soundId: 2688,
        category: "offence",
        statBoosts: { [SkillId.Strength]: 5 },
    },
    {
        id: "clarity_of_thought",
        name: "Clarity of Thought",
        description: "+5% Attack.",
        level: 7,
        drainRate: 1,
        quickSlot: 2,
        varbit: 4106,
        order: 2,
        groups: "attack",
        exclusiveGroups: ["attack", "ranged", "magic", "combat"],
        soundId: 2664,
        category: "offence",
        statBoosts: { [SkillId.Attack]: 5 },
    },
    {
        id: "sharp_eye",
        name: "Sharp Eye",
        description: "+5% Ranged accuracy.",
        level: 8,
        drainRate: 1,
        quickSlot: 18,
        varbit: 4122,
        order: 3,
        groups: "ranged",
        exclusiveGroups: ["ranged", "attack", "strength", "magic", "combat"],
        soundId: 2685,
        category: "offence",
        statBoosts: { [SkillId.Ranged]: 5 },
    },
    {
        id: "mystic_will",
        name: "Mystic Will",
        description: "+5% Magic accuracy and defence.",
        level: 9,
        drainRate: 1,
        quickSlot: 19,
        varbit: 4123,
        order: 4,
        groups: "magic",
        exclusiveGroups: ["magic", "attack", "strength", "ranged", "combat"],
        soundId: 2670,
        category: "offence",
        statBoosts: { [SkillId.Magic]: 5 },
    },
    {
        id: "rock_skin",
        name: "Rock Skin",
        description: "+10% Defence.",
        level: 10,
        drainRate: 6,
        quickSlot: 3,
        varbit: 4107,
        order: 5,
        groups: "defence",
        exclusiveGroups: ["defence", "combat"],
        soundId: 2684,
        category: "defence",
        statBoosts: { [SkillId.Defence]: 10 },
    },
    {
        id: "superhuman_strength",
        name: "Superhuman Strength",
        description: "+10% Strength.",
        level: 13,
        drainRate: 6,
        quickSlot: 4,
        varbit: 4108,
        order: 6,
        groups: "strength",
        exclusiveGroups: ["strength", "ranged", "magic", "combat"],
        soundId: 2689,
        category: "offence",
        statBoosts: { [SkillId.Strength]: 10 },
    },
    {
        id: "improved_reflexes",
        name: "Improved Reflexes",
        description: "+10% Attack.",
        level: 16,
        drainRate: 6,
        quickSlot: 5,
        varbit: 4109,
        order: 7,
        groups: "attack",
        exclusiveGroups: ["attack", "ranged", "magic", "combat"],
        soundId: 2662,
        category: "offence",
        statBoosts: { [SkillId.Attack]: 10 },
    },
    {
        id: "rapid_restore",
        name: "Rapid Restore",
        description: "Doubles stat restoration (not Hitpoints/Prayer).",
        level: 19,
        drainRate: 1,
        quickSlot: 6,
        varbit: 4110,
        order: 8,
        exclusiveGroups: [],
        soundId: 2679,
        category: "utility",
        specialEffect: "rapid_restore",
    },
    {
        id: "rapid_heal",
        name: "Rapid Heal",
        description: "Doubles Hitpoints regeneration rate.",
        level: 22,
        drainRate: 2,
        quickSlot: 7,
        varbit: 4111,
        order: 9,
        exclusiveGroups: [],
        soundId: 2678,
        category: "utility",
        specialEffect: "rapid_heal",
    },
    {
        id: "protect_item",
        name: "Protect Item",
        description: "Keeps one extra item on death.",
        level: 25,
        drainRate: 2,
        quickSlot: 8,
        varbit: 4112,
        order: 10,
        exclusiveGroups: [],
        soundId: 1982,
        category: "utility",
        specialEffect: "protect_item",
    },
    {
        id: "hawk_eye",
        name: "Hawk Eye",
        description: "+10% Ranged accuracy.",
        level: 26,
        drainRate: 6,
        quickSlot: 20,
        varbit: 4124,
        order: 11,
        groups: "ranged",
        exclusiveGroups: ["ranged", "attack", "strength", "magic", "combat"],
        soundId: 2666,
        category: "offence",
        statBoosts: { [SkillId.Ranged]: 10 },
    },
    {
        id: "mystic_lore",
        name: "Mystic Lore",
        description: "+10% Magic accuracy and defence.",
        level: 27,
        drainRate: 6,
        quickSlot: 21,
        varbit: 4125,
        order: 12,
        groups: "magic",
        exclusiveGroups: ["magic", "attack", "strength", "ranged", "combat"],
        soundId: 2668,
        category: "offence",
        statBoosts: { [SkillId.Magic]: 10 },
    },
    {
        id: "steel_skin",
        name: "Steel Skin",
        description: "+15% Defence.",
        level: 28,
        drainRate: 12,
        quickSlot: 9,
        varbit: 4113,
        order: 13,
        groups: "defence",
        exclusiveGroups: ["defence", "combat"],
        soundId: 2687,
        category: "defence",
        statBoosts: { [SkillId.Defence]: 15 },
    },
    {
        id: "ultimate_strength",
        name: "Ultimate Strength",
        description: "+15% Strength.",
        level: 31,
        drainRate: 12,
        quickSlot: 10,
        varbit: 4114,
        order: 14,
        groups: "strength",
        exclusiveGroups: ["strength", "ranged", "magic", "combat"],
        soundId: 2691,
        category: "offence",
        statBoosts: { [SkillId.Strength]: 15 },
    },
    {
        id: "incredible_reflexes",
        name: "Incredible Reflexes",
        description: "+15% Attack.",
        level: 34,
        drainRate: 12,
        quickSlot: 11,
        varbit: 4115,
        order: 15,
        groups: "attack",
        exclusiveGroups: ["attack", "ranged", "magic", "combat"],
        soundId: 2667,
        category: "offence",
        statBoosts: { [SkillId.Attack]: 15 },
    },
    {
        id: "protect_from_magic",
        name: "Protect from Magic",
        description: "Protects against magical attacks.",
        level: 37,
        drainRate: 12,
        quickSlot: 12,
        varbit: 4116,
        order: 16,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "protect_magic",
        soundId: 2675,
        category: "overhead",
    },
    {
        id: "protect_from_missiles",
        name: "Protect from Missiles",
        description: "Protects against ranged attacks.",
        level: 40,
        drainRate: 12,
        quickSlot: 13,
        varbit: 4117,
        order: 17,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "protect_missiles",
        soundId: 2677,
        category: "overhead",
    },
    {
        id: "protect_from_melee",
        name: "Protect from Melee",
        description: "Protects against melee attacks.",
        level: 43,
        drainRate: 12,
        quickSlot: 14,
        varbit: 4118,
        order: 18,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "protect_melee",
        soundId: 2676,
        category: "overhead",
    },
    {
        id: "eagle_eye",
        name: "Eagle Eye",
        description: "+15% Ranged accuracy.",
        level: 44,
        drainRate: 12,
        quickSlot: 22,
        varbit: 4126,
        order: 19,
        groups: "ranged",
        exclusiveGroups: ["ranged", "attack", "strength", "magic", "combat"],
        soundId: 2665,
        category: "offence",
        statBoosts: { [SkillId.Ranged]: 15 },
    },
    {
        id: "mystic_might",
        name: "Mystic Might",
        description: "+15% Magic accuracy and defence.",
        level: 45,
        drainRate: 12,
        quickSlot: 23,
        varbit: 4127,
        order: 20,
        groups: "magic",
        exclusiveGroups: ["magic", "attack", "strength", "ranged", "combat"],
        soundId: 2669,
        category: "offence",
        statBoosts: { [SkillId.Magic]: 15 },
    },
    {
        id: "retribution",
        name: "Retribution",
        description: "Damages nearby foes on death.",
        level: 46,
        drainRate: 3,
        quickSlot: 15,
        varbit: 4119,
        order: 21,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "retribution",
        soundId: 2682,
        category: "overhead",
        specialEffect: "retribution",
    },
    {
        id: "redemption",
        name: "Redemption",
        description: "Heals when Hitpoints fall below 10%.",
        level: 49,
        drainRate: 6,
        quickSlot: 16,
        varbit: 4120,
        order: 22,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "redemption",
        soundId: 2680,
        category: "overhead",
        specialEffect: "redemption",
    },
    {
        id: "smite",
        name: "Smite",
        description: "Reduces enemy Prayer by a quarter of damage dealt.",
        level: 52,
        drainRate: 18,
        quickSlot: 17,
        varbit: 4121,
        order: 23,
        groups: "overhead",
        exclusiveGroups: ["overhead"],
        headIcon: "smite",
        soundId: 2686,
        category: "overhead",
        specialEffect: "smite",
    },
    {
        id: "preserve",
        name: "Preserve",
        description: "Extends boosted stats by 50%.",
        level: 55,
        drainRate: 2,
        quickSlot: 28,
        varbit: 5466,
        order: 24,
        exclusiveGroups: [],
        soundId: 3825,
        category: "utility",
        specialEffect: "preserve",
        unlockVarbit: PRESERVE_UNLOCK_VARBIT,
    },
    {
        id: "chivalry",
        name: "Chivalry",
        description: "+15% Attack, +18% Strength, +20% Defence.",
        level: 60,
        drainRate: 24,
        quickSlot: 25,
        varbit: 4128,
        order: 25,
        groups: "combat",
        exclusiveGroups: ["combat", "attack", "strength", "defence", "ranged", "magic"],
        soundId: 3826,
        category: "offence",
        statBoosts: {
            [SkillId.Attack]: 15,
            [SkillId.Strength]: 18,
            [SkillId.Defence]: 20,
        },
        questRequirement: {
            varbit: QUEST_VARBIT_KINGS_RANSOM,
            minValue: 8,
            hint: "Complete King's Ransom to unlock Chivalry.",
        },
    },
    {
        id: "piety",
        name: "Piety",
        description: "+20% Attack, +23% Strength, +25% Defence.",
        level: 70,
        drainRate: 24,
        quickSlot: 26,
        varbit: 4129,
        order: 26,
        groups: "combat",
        exclusiveGroups: ["combat", "attack", "strength", "defence", "ranged", "magic"],
        soundId: 3825,
        category: "offence",
        statBoosts: {
            [SkillId.Attack]: 20,
            [SkillId.Strength]: 23,
            [SkillId.Defence]: 25,
        },
        questRequirement: {
            varbit: QUEST_VARBIT_KINGS_RANSOM,
            minValue: 8,
            hint: "Complete King's Ransom to unlock Piety.",
        },
    },
    {
        id: "rigour",
        name: "Rigour",
        description: "+20% Ranged accuracy, +23% Ranged damage, +25% Defence.",
        level: 74,
        drainRate: 24,
        quickSlot: 24,
        varbit: 5464,
        order: 27,
        groups: "combat",
        exclusiveGroups: ["combat", "attack", "strength", "defence", "ranged", "magic"],
        soundId: 3825,
        category: "offence",
        statBoosts: {
            [SkillId.Ranged]: 20,
            [SkillId.Defence]: 25,
        },
        unlockVarbit: RIGOUR_UNLOCK_VARBIT,
    },
    {
        id: "augury",
        name: "Augury",
        description: "+25% Magic accuracy, +25% Defence.",
        level: 77,
        drainRate: 24,
        quickSlot: 27,
        varbit: 5465,
        order: 28,
        groups: "combat",
        exclusiveGroups: ["combat", "attack", "strength", "defence", "ranged", "magic"],
        soundId: 3825,
        category: "offence",
        statBoosts: {
            [SkillId.Magic]: 25,
            [SkillId.Defence]: 25,
        },
        unlockVarbit: AUGURY_UNLOCK_VARBIT,
    },
];

const PRAYER_SPRITE_IDS: Record<PrayerName, { on: number; off: number }> = {
    thick_skin: { on: 115, off: 135 },
    burst_of_strength: { on: 116, off: 136 },
    clarity_of_thought: { on: 117, off: 137 },
    rock_skin: { on: 118, off: 138 },
    superhuman_strength: { on: 119, off: 139 },
    improved_reflexes: { on: 120, off: 140 },
    rapid_restore: { on: 121, off: 141 },
    rapid_heal: { on: 122, off: 142 },
    protect_item: { on: 123, off: 143 },
    steel_skin: { on: 124, off: 144 },
    ultimate_strength: { on: 125, off: 145 },
    incredible_reflexes: { on: 126, off: 146 },
    protect_from_magic: { on: 127, off: 147 },
    protect_from_missiles: { on: 128, off: 148 },
    protect_from_melee: { on: 129, off: 149 },
    redemption: { on: 130, off: 150 },
    retribution: { on: 131, off: 151 },
    smite: { on: 132, off: 152 },
    sharp_eye: { on: 133, off: 153 },
    mystic_will: { on: 134, off: 154 },
    hawk_eye: { on: 502, off: 506 },
    mystic_lore: { on: 503, off: 507 },
    eagle_eye: { on: 504, off: 508 },
    mystic_might: { on: 505, off: 509 },
    preserve: { on: 947, off: 951 },
    chivalry: { on: 945, off: 949 },
    piety: { on: 946, off: 950 },
    rigour: { on: 1420, off: 1424 },
    augury: { on: 1421, off: 1425 },
};

export const PRAYER_DEFINITIONS: PrayerDefinition[] = BASE_DEFINITIONS.map((def) => {
    const sprites = PRAYER_SPRITE_IDS[def.id];
    return {
        ...def,
        spriteOnId: sprites?.on ?? -1,
        spriteOffId: sprites?.off ?? -1,
    };
});
export const PRAYER_NAME_SET = new Set<PrayerName>(PRAYER_DEFINITIONS.map((p) => p.id));
export const PRAYER_BY_NAME = new Map<PrayerName, PrayerDefinition>(
    PRAYER_DEFINITIONS.map((p) => [p.id, p]),
);

export function getPrayerDefinition(id: PrayerName): PrayerDefinition {
    const def = PRAYER_BY_NAME.get(id);
    if (!def) {
        throw new Error(`Unknown prayer: ${id}`);
    }
    return def;
}

export function getExclusivePrayers(prayer: PrayerName): PrayerName[] {
    const def = getPrayerDefinition(prayer);
    if (!def.groups && def.exclusiveGroups.length === 0) return [];
    return PRAYER_DEFINITIONS.filter((candidate) => {
        if (candidate.id === prayer) return false;
        if (!candidate.groups) return false;
        if (def.groups && candidate.groups === def.groups) return true;
        return def.exclusiveGroups.includes(candidate.groups);
    }).map((candidate) => candidate.id);
}

export function getPrayerOrder(): PrayerName[] {
    return PRAYER_DEFINITIONS.slice()
        .sort((a, b) => a.order - b.order)
        .map((p) => p.id);
}

// =============================================
// Prayer Varbits - used for client sync
// =============================================

/** Varbit IDs for prayer system */
export const PrayerVarbits = {
    /** Quick-prayer selected bitmask (PRAYER_ALLACTIVE-style bitset for quick-prayer setup UI). */
    QUICKPRAYER_SELECTED: 4102,

    /** Whether quick prayers are currently active (1/0) - confirmed varbit */
    QUICKPRAYER_ACTIVE: 4103,

    // Individual prayer activation varbits
    THICK_SKIN: 4104,
    BURST_OF_STRENGTH: 4105,
    CLARITY_OF_THOUGHT: 4106,
    ROCK_SKIN: 4107,
    SUPERHUMAN_STRENGTH: 4108,
    IMPROVED_REFLEXES: 4109,
    RAPID_RESTORE: 4110,
    RAPID_HEAL: 4111,
    PROTECT_ITEM: 4112,
    STEEL_SKIN: 4113,
    ULTIMATE_STRENGTH: 4114,
    INCREDIBLE_REFLEXES: 4115,
    PROTECT_FROM_MAGIC: 4116,
    PROTECT_FROM_MISSILES: 4117,
    PROTECT_FROM_MELEE: 4118,
    RETRIBUTION: 4119,
    REDEMPTION: 4120,
    SMITE: 4121,
    SHARP_EYE: 4122,
    MYSTIC_WILL: 4123,
    HAWK_EYE: 4124,
    MYSTIC_LORE: 4125,
    EAGLE_EYE: 4126,
    MYSTIC_MIGHT: 4127,
    CHIVALRY: 4128,
    PIETY: 4129,

    // Unlock varbits
    RIGOUR_UNLOCKED: 5451,
    AUGURY_UNLOCKED: 5452,
    PRESERVE_UNLOCKED: 5453,

    // Higher-level prayers
    RIGOUR: 5464,
    AUGURY: 5465,
    PRESERVE: 5466,
} as const;

/** Map from PrayerName to its activation varbit */
export const PRAYER_NAME_TO_VARBIT: Record<PrayerName, number> = {
    thick_skin: PrayerVarbits.THICK_SKIN,
    burst_of_strength: PrayerVarbits.BURST_OF_STRENGTH,
    clarity_of_thought: PrayerVarbits.CLARITY_OF_THOUGHT,
    sharp_eye: PrayerVarbits.SHARP_EYE,
    mystic_will: PrayerVarbits.MYSTIC_WILL,
    rock_skin: PrayerVarbits.ROCK_SKIN,
    superhuman_strength: PrayerVarbits.SUPERHUMAN_STRENGTH,
    improved_reflexes: PrayerVarbits.IMPROVED_REFLEXES,
    rapid_restore: PrayerVarbits.RAPID_RESTORE,
    rapid_heal: PrayerVarbits.RAPID_HEAL,
    protect_item: PrayerVarbits.PROTECT_ITEM,
    hawk_eye: PrayerVarbits.HAWK_EYE,
    mystic_lore: PrayerVarbits.MYSTIC_LORE,
    steel_skin: PrayerVarbits.STEEL_SKIN,
    ultimate_strength: PrayerVarbits.ULTIMATE_STRENGTH,
    incredible_reflexes: PrayerVarbits.INCREDIBLE_REFLEXES,
    protect_from_magic: PrayerVarbits.PROTECT_FROM_MAGIC,
    protect_from_missiles: PrayerVarbits.PROTECT_FROM_MISSILES,
    protect_from_melee: PrayerVarbits.PROTECT_FROM_MELEE,
    eagle_eye: PrayerVarbits.EAGLE_EYE,
    mystic_might: PrayerVarbits.MYSTIC_MIGHT,
    retribution: PrayerVarbits.RETRIBUTION,
    redemption: PrayerVarbits.REDEMPTION,
    smite: PrayerVarbits.SMITE,
    preserve: PrayerVarbits.PRESERVE,
    chivalry: PrayerVarbits.CHIVALRY,
    piety: PrayerVarbits.PIETY,
    rigour: PrayerVarbits.RIGOUR,
    augury: PrayerVarbits.AUGURY,
};

/** Map from PrayerName to its bit position in the PRAYER_ALLACTIVE bitmask */
export const PRAYER_NAME_TO_BIT: Record<PrayerName, number> = {
    thick_skin: 0,
    burst_of_strength: 1,
    clarity_of_thought: 2,
    sharp_eye: 18,
    mystic_will: 19,
    rock_skin: 3,
    superhuman_strength: 4,
    improved_reflexes: 5,
    rapid_restore: 6,
    rapid_heal: 7,
    protect_item: 8,
    hawk_eye: 20,
    mystic_lore: 21,
    steel_skin: 9,
    ultimate_strength: 10,
    incredible_reflexes: 11,
    protect_from_magic: 12,
    protect_from_missiles: 13,
    protect_from_melee: 14,
    eagle_eye: 22,
    mystic_might: 23,
    retribution: 15,
    redemption: 16,
    smite: 17,
    preserve: 28,
    chivalry: 25,
    piety: 26,
    rigour: 24,
    augury: 27,
};

/** Convert a set of active prayers to a bitmask for PRAYER_ALLACTIVE varbit */
export function prayerSetToBitmask(prayers: Iterable<PrayerName>): number {
    let mask = 0;
    for (const prayer of prayers) {
        const bit = PRAYER_NAME_TO_BIT[prayer];
        if (bit !== undefined) {
            mask |= 1 << bit;
        }
    }
    return mask;
}

/** Convert a PRAYER_ALLACTIVE bitmask to a set of active prayers */
export function bitmaskToPrayerSet(mask: number): Set<PrayerName> {
    const result = new Set<PrayerName>();
    for (const [name, bit] of Object.entries(PRAYER_NAME_TO_BIT) as [PrayerName, number][]) {
        if ((mask & (1 << bit)) !== 0) {
            result.add(name);
        }
    }
    return result;
}
