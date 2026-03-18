export const HITMARK_BLOCK = 0;
export const HITMARK_DAMAGE = 1;
export const HITMARK_POISON = 2;
export const HITMARK_DISEASE = 3;
export const HITMARK_VENOM = 4;
export const HITMARK_REFLECT = 5;
export const HITMARK_PRAYER_SPLASH = 6;
export const HITMARK_REGEN = 7;
export const HITMARK_HEAL = 8;

export enum HitEffectType {
    Block = "block",
    Damage = "damage",
    Heal = "heal",
    Poison = "poison",
    Disease = "disease",
    Venom = "venom",
    Regeneration = "regeneration",
    Reflect = "reflect",
    PrayerSplash = "prayer_splash",
}

export interface HitEffectConfig {
    type: HitEffectType;
    defaultAmount?: number;
    minAmount?: number;
    interval?: number;
    ramp?: number;
    cap?: number;
    clampAtOne?: boolean;
}

// OSRS: Poison deals damage every 30 ticks (18 seconds)
export const DEFAULT_POISON_INTERVAL_TICKS = 30;
// OSRS: Venom deals damage every 30 ticks (18 seconds)
export const DEFAULT_VENOM_INTERVAL_TICKS = 30;
// Disease interval (affects stat drain)
export const DEFAULT_DISEASE_INTERVAL_TICKS = 30;
export const DEFAULT_REGEN_INTERVAL_TICKS = 10;

const HIT_EFFECTS: Record<number, HitEffectConfig> = {
    [HITMARK_BLOCK]: { type: HitEffectType.Block },
    [HITMARK_DAMAGE]: { type: HitEffectType.Damage },
    [HITMARK_POISON]: {
        type: HitEffectType.Poison,
        defaultAmount: 1,
        interval: DEFAULT_POISON_INTERVAL_TICKS,
        minAmount: 1,
    },
    [HITMARK_DISEASE]: {
        type: HitEffectType.Disease,
        defaultAmount: 1,
        interval: DEFAULT_DISEASE_INTERVAL_TICKS,
        minAmount: 0,
        clampAtOne: true,
    },
    [HITMARK_VENOM]: {
        type: HitEffectType.Venom,
        defaultAmount: 6,
        interval: DEFAULT_VENOM_INTERVAL_TICKS,
        ramp: 2,
        cap: 20,
        minAmount: 6,
    },
    [HITMARK_REFLECT]: { type: HitEffectType.Reflect },
    [HITMARK_PRAYER_SPLASH]: { type: HitEffectType.PrayerSplash },
    [HITMARK_REGEN]: {
        type: HitEffectType.Regeneration,
        defaultAmount: 1,
        interval: DEFAULT_REGEN_INTERVAL_TICKS,
        minAmount: 1,
    },
    [HITMARK_HEAL]: { type: HitEffectType.Heal },
};

export function resolveHitEffect(style: number): HitEffectConfig {
    return HIT_EFFECTS[style] ?? HIT_EFFECTS[HITMARK_DAMAGE];
}

export interface StatusHitsplat {
    style: number;
    amount: number;
    hpCurrent: number;
    hpMax: number;
}
