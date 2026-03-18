import type { WeaponInterface } from "../../data/items";

const WEAPON_INTERFACE_CATEGORY: Partial<Record<WeaponInterface, number>> = {
    // Category 0: Punch/Kick/Block (Unarmed)
    UNARMED: 0,

    // Category 1: Chop/Hack/Smash/Block (Axes)
    BATTLEAXE: 1,
    GREATAXE: 1,

    // Category 2: Pound/Pummel/Block (Hammers)
    WARHAMMER: 2,
    GRANITE_MAUL: 2,

    // Category 3: Accurate/Rapid/Longrange (Bows - Standard projectile)
    SHORTBOW: 3,
    LONGBOW: 3,
    DARK_BOW: 3,

    // Category 4: Chop/Slash/Lunge/Block (Claws)
    CLAWS: 4,

    // Category 9: Chop/Slash/Lunge/Block (Slash swords: scimitars, longswords)
    SCIMITAR: 9,
    LONGSWORD: 9,

    // Category 5: Accurate/Rapid/Longrange (Crossbows - Heavy projectile)
    CROSSBOW: 5,
    BALLISTA: 5,
    KARILS_CROSSBOW: 5,

    // Category 10: Chop/Slash/Smash/Block (2H Swords, Godswords)
    TWO_HANDED_SWORD: 10,
    GODSWORD: 10,

    // Category 11: Spike/Impale/Smash/Block (Pickaxes)
    PICKAXE: 11,

    // Category 12: Jab/Swipe/Fend (Halberds)
    HALBERD: 12,

    // Category 14: Reap/Chop/Jab/Block (Scythes)
    SCYTHE: 14,

    // Category 15: Lunge/Swipe/Pound/Block (Spears)
    SPEAR: 15,

    // Category 16: Pound/Pummel/Spike/Block (Maces, Flails)
    MACE: 16,
    VERACS_FLAIL: 16,

    // Category 17: Stab/Lunge/Slash/Block (Stab sword weapons: daggers, rapiers, swords)
    DAGGER: 17,
    DRAGON_DAGGER: 17,
    ABYSSAL_DAGGER: 17,
    GHRAZI_RAPIER: 17,
    SWORD: 17,
    SARADOMIN_SWORD: 17,

    // Category 18: Bash/Pound/Focus (Staves)
    STAFF: 18,
    ANCIENT_STAFF: 18,

    // Category 19: Accurate/Rapid/Longrange (Thrown - Light projectile)
    DART: 19,
    KNIFE: 19,
    JAVELIN: 19,
    THROWNAXE: 19,
    OBBY_RINGS: 19,
    BLOWPIPE: 19,

    // Category 20: Flick/Lash/Deflect (Whips)
    WHIP: 20,

    // Category 27: Pound/Pummel/Smash (Mauls, Bludgeons - all aggressive)
    ELDER_MAUL: 27,
    MAUL: 27,
    ABYSSAL_BLUDGEON: 27,

    // Category 28: Pummel/Block (Bulwarks - defensive)
    BULWARK: 28,
};

export function getCategoryForWeaponInterface(iface?: WeaponInterface | null): number | undefined {
    if (!iface) return undefined;
    return WEAPON_INTERFACE_CATEGORY[iface];
}
