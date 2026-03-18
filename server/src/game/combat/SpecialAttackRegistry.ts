/**
 * Special Attack Registry
 *
 * OSRS-accurate special attack system.
 * Each weapon has a defined special attack with:
 * - Energy cost (25%, 50%, 55%, 60%, 100%)
 * - Accuracy/damage multipliers
 * - Special effects (freeze, heal, drain, etc.)
 * - Custom animations and graphics
 *
 * Reference: RSMod SpecialAttacks.kt, OSRS Wiki
 */
import type { AttackType } from "./AttackType";

// =============================================================================
// Types
// =============================================================================

/**
 * Special attack effect applied on hit.
 */
export interface SpecialAttackEffect {
    /** Freeze target for N ticks */
    freezeTicks?: number;
    /** Stun target for N ticks (prevents all actions) */
    stunTicks?: number;
    /** Heal attacker by fraction of damage dealt (0.0-1.0) */
    healFraction?: number;
    /** Restore prayer by fraction of damage dealt (0.0-1.0) */
    prayerFraction?: number;
    /** Drain target's defence level */
    drainDefence?: number;
    /** Drain target's defence by fraction of damage */
    drainDefenceByDamage?: number;
    /** Drain target's magic level by damage dealt */
    drainMagicByDamage?: boolean;
    /** Drain target's attack level */
    drainAttack?: number;
    /** Drain target's strength level */
    drainStrength?: number;
    /** Drain target's ranged level */
    drainRanged?: number;
    /** Drain all combat stats by damage dealt */
    drainAllCombatByDamage?: boolean;
    /** Drain run energy (PvP only) */
    drainRunEnergy?: number;
    /** Apply poison (starting damage) */
    applyPoison?: number;
    /** Apply venom */
    applyVenom?: boolean;
    /** Guaranteed hit on first swing */
    guaranteedFirstHit?: boolean;
    /** Attack twice */
    doubleHit?: boolean;
    /** Attack four times */
    quadHit?: boolean;
    /** Increase attack range */
    rangeBoost?: number;
    /** Lowers target's prayer by damage/4 (Bandos Godsword) */
    drainPrayerByDamage?: boolean;
    /** Teleport behind target (Dragon Dagger, Claws) */
    teleportBehind?: boolean;
    /** Smash through protection prayers */
    ignoreProtectionPrayer?: boolean;
}

/**
 * Special attack definition.
 */
export interface SpecialAttackDef {
    /** Weapon item ID(s) this special applies to */
    weaponIds: number[];
    /** Energy cost as percentage (25, 50, 55, 60, 100) */
    energyCost: number;
    /** Accuracy multiplier (1.0 = normal) */
    accuracyMultiplier: number;
    /** Damage multiplier (1.0 = normal) */
    damageMultiplier: number;
    /** Number of hits (1, 2, 4 for DDS, claws, etc.) */
    hitCount: number;
    /** Attack type override (some specs change attack style) */
    attackType?: AttackType;
    /** Special effects on hit */
    effects?: SpecialAttackEffect;
    /** Animation ID for special attack */
    animationId?: number;
    /** Graphic/SpotAnim ID on attacker */
    graphicId?: number;
    /** Graphic ID on target */
    targetGraphicId?: number;
    /** Projectile ID for ranged specs */
    projectileId?: number;
    /** Sound effect ID (plays on attack swing) */
    soundId?: number;
    /** Per-hit sound effects for multi-hit specials (e.g., dragon claws: [4138, 4140, 4141, 4141]) */
    hitSounds?: number[];
    /** Name for logging/debugging */
    name: string;
    /** Minimum damage per hit (e.g., Dark bow spec) */
    minDamagePerHit?: number;
    /** Maximum damage per hit cap (e.g., Dark bow with dragon arrows = 48) */
    maxDamagePerHit?: number;
    /**
     * Dynamic ammo-based modifiers (e.g., Dark bow changes based on arrow type)
     * Key is ammo item ID or 'default' for fallback
     */
    ammoModifiers?: {
        [ammoId: number]: {
            damageMultiplier: number;
            minDamagePerHit: number;
            maxDamagePerHit?: number;
            graphicId?: number;
            projectileId?: number;
            soundId?: number;
            name?: string;
        };
        default?: {
            damageMultiplier: number;
            minDamagePerHit: number;
            maxDamagePerHit?: number;
            graphicId?: number;
            projectileId?: number;
            soundId?: number;
            name?: string;
        };
    };
}

/**
 * Context for executing a special attack.
 */
export interface SpecialAttackContext {
    attackerId: number;
    targetId: number;
    targetType: "npc" | "player";
    baseDamage: number;
    baseAccuracy: number;
    tick: number;
}

/**
 * Result of a special attack calculation.
 */
export interface SpecialAttackResult {
    totalDamage: number;
    hits: Array<{
        damage: number;
        delay: number;
        hitsplatStyle: number;
    }>;
    effects: SpecialAttackEffect;
    animationId?: number;
    graphicId?: number;
    targetGraphicId?: number;
    energyUsed: number;
}

// =============================================================================
// Special Attack Registry
// =============================================================================

/**
 * Registry of all special attacks.
 * Keyed by weapon item ID for fast lookup.
 */
class SpecialAttackRegistryImpl {
    private readonly specs = new Map<number, SpecialAttackDef>();

    constructor() {
        this.registerAllSpecials();
    }

    /**
     * Get special attack definition for a weapon.
     */
    get(weaponId: number): SpecialAttackDef | undefined {
        return this.specs.get(weaponId);
    }

    /**
     * Check if weapon has a special attack.
     */
    has(weaponId: number): boolean {
        return this.specs.has(weaponId);
    }

    /**
     * Get energy cost for a weapon's special attack.
     */
    getEnergyCost(weaponId: number): number {
        return this.specs.get(weaponId)?.energyCost ?? 0;
    }

    /**
     * Register a special attack definition.
     */
    private register(def: SpecialAttackDef): void {
        for (const weaponId of def.weaponIds) {
            this.specs.set(weaponId, def);
        }
    }

    /**
     * Register all OSRS special attacks.
     */
    private registerAllSpecials(): void {
        // =====================================================================
        // Godswords
        // =====================================================================

        // Armadyl Godsword - The Judgment
        this.register({
            name: "The Judgment",
            weaponIds: [11802, 20368], // AGS, AGS (or)
            energyCost: 50,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.375,
            hitCount: 1,
            animationId: 7644,
            graphicId: 1211,
            soundId: 3869, // Godsword special
        });

        // Bandos Godsword - Warstrike
        this.register({
            name: "Warstrike",
            weaponIds: [11804, 20370], // BGS, BGS (or)
            energyCost: 50,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.21,
            hitCount: 1,
            effects: {
                drainDefenceByDamage: 1.0, // Drains defence equal to damage dealt
            },
            animationId: 7642,
            graphicId: 1212,
            soundId: 3865, // Godsword special
        });

        // Saradomin Godsword - Healing Blade
        this.register({
            name: "Healing Blade",
            weaponIds: [11806, 20372], // SGS, SGS (or)
            energyCost: 50,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.1,
            hitCount: 1,
            effects: {
                healFraction: 0.5, // Heal 50% of damage
                prayerFraction: 0.25, // Restore 25% of damage as prayer
            },
            animationId: 7640,
            graphicId: 1209,
            soundId: 3866, // Godsword special
        });

        // Zamorak Godsword - Ice Cleave
        this.register({
            name: "Ice Cleave",
            weaponIds: [11808, 20374], // ZGS, ZGS (or)
            energyCost: 50,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.1,
            hitCount: 1,
            effects: {
                freezeTicks: 33, // 20 second freeze
            },
            animationId: 7638,
            graphicId: 1210,
            targetGraphicId: 369,
            soundId: 3867, // Godsword special + freeze
        });

        // =====================================================================
        // Dragon Weapons
        // =====================================================================

        // Dragon Dagger - Puncture
        this.register({
            name: "Puncture",
            weaponIds: [1215, 1231, 5680, 5698], // Dragon dagger variants
            energyCost: 25,
            accuracyMultiplier: 1.15,
            damageMultiplier: 1.15,
            hitCount: 2,
            effects: {
                doubleHit: true,
            },
            animationId: 1062,
            graphicId: 252,
            soundId: 2537, // Dragon dagger spec
        });

        // Dragon Longsword - Cleave
        this.register({
            name: "Cleave",
            weaponIds: [1305],
            energyCost: 25,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.15,
            hitCount: 1,
            animationId: 1058,
            graphicId: 248,
            soundId: 2529, // Dragon longsword spec
        });

        // Dragon Battleaxe - Rampage
        this.register({
            name: "Rampage",
            weaponIds: [1377],
            energyCost: 100,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 0, // No attack, just buff
            effects: {
                // Drains Attack, Defence, Ranged, Magic by 10%
                // Boosts Strength by 10 + (levels drained / 4)
            },
            animationId: 1056,
            graphicId: 246,
            soundId: 2530, // Dragon battleaxe spec
        });

        // Dragon Mace - Shatter
        this.register({
            name: "Shatter",
            weaponIds: [1434],
            energyCost: 25,
            accuracyMultiplier: 1.25,
            damageMultiplier: 1.5,
            hitCount: 1,
            animationId: 1060,
            graphicId: 251,
            soundId: 2541, // Dragon mace spec
        });

        // Dragon Scimitar - Sever
        this.register({
            name: "Sever",
            weaponIds: [4587],
            energyCost: 55,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            effects: {
                // Prevents target from using protection prayers for 5 seconds
            },
            animationId: 1872,
            graphicId: 347,
            soundId: 2540, // Dragon scimitar spec
        });

        // Dragon Halberd - Sweep
        this.register({
            name: "Sweep",
            weaponIds: [3204],
            energyCost: 30,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.1,
            hitCount: 2, // Hits twice on large targets
            animationId: 1203,
            graphicId: 282,
            soundId: 2533, // Dragon halberd spec
        });

        // Dragon Spear - Shove
        this.register({
            name: "Shove",
            weaponIds: [1249, 1263, 5716, 5730],
            energyCost: 25,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 0, // No damage, just pushes
            effects: {
                stunTicks: 5,
            },
            animationId: 1064,
            soundId: 2544, // Dragon spear spec
        });

        // Dragon Warhammer - Smash
        this.register({
            name: "Smash",
            weaponIds: [13576],
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.5,
            hitCount: 1,
            effects: {
                drainDefence: 0.3, // Drain 30% of target's defence on hit
            },
            animationId: 1378,
            graphicId: 1292,
            soundId: 2541, // Dragon warhammer spec
        });

        // Dragon Claws - Slice and Dice
        this.register({
            name: "Slice and Dice",
            weaponIds: [13652, 20784], // Dragon claws, Dragon claws (cr)
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 4,
            effects: {
                quadHit: true,
                // Damage pattern: if first hits X, hits are X, X/2, X/4, X/4
            },
            animationId: 7514,
            graphicId: 1171,
            // Per-hit sounds: hit1=dragonclaws_special_1, hit2=dragonclaws_special_2, hit3&4=dragonclaws_special_3
            hitSounds: [4138, 4140, 4141, 4141],
        });

        // =====================================================================
        // Abyssal Weapons
        // =====================================================================

        // Abyssal Whip - Energy Drain
        this.register({
            name: "Energy Drain",
            weaponIds: [4151, 12773, 12774, 12006], // Whip variants
            energyCost: 50,
            accuracyMultiplier: 1.25,
            damageMultiplier: 1.0,
            hitCount: 1,
            effects: {
                drainRunEnergy: 10, // Drains 10% run energy, transfers to attacker
            },
            animationId: 1658,
            soundId: 2713, // Abyssal whip spec
        });

        // Abyssal Dagger - Abyssal Puncture
        this.register({
            name: "Abyssal Puncture",
            weaponIds: [13265, 13267, 13269, 13271],
            energyCost: 50,
            accuracyMultiplier: 1.25,
            damageMultiplier: 0.85,
            hitCount: 2,
            effects: {
                doubleHit: true,
            },
            animationId: 3300,
            graphicId: 1283,
            soundId: 2537, // Similar to dragon dagger
        });

        // Abyssal Bludgeon - Penance
        this.register({
            name: "Penance",
            weaponIds: [13263],
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0, // +0.5% per missing prayer point
            hitCount: 1,
            animationId: 3299,
            graphicId: 1284,
            soundId: 3302, // Abyssal bludgeon spec
        });

        // =====================================================================
        // Barrows Weapons
        // =====================================================================

        // Verac's Flail - Defiler
        // Note: Verac's set effect (ignore defence) is separate from this spec
        this.register({
            name: "Defiler",
            weaponIds: [4755],
            energyCost: 100,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            effects: {
                ignoreProtectionPrayer: true,
            },
        });

        // =====================================================================
        // Ranged Weapons
        // =====================================================================

        // Dark Bow - Descent of Darkness / Descent of Dragons
        // OSRS: Different effects based on arrow type
        // Dragon arrows: 1.5x damage, min 8, max 48, dragon head graphics, sound 3733
        // Other arrows: 1.3x damage, min 5, no max cap, smoke arrow graphics, sound 3736
        this.register({
            name: "Descent of Darkness",
            weaponIds: [11235, 12765, 12766, 12767, 12768],
            energyCost: 55,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.3, // Default for non-dragon arrows
            hitCount: 2,
            attackType: "ranged",
            animationId: 426,
            graphicId: 1101, // Smoke arrow (default)
            soundId: 3736, // darkbow_shadow_attack (default for non-dragon arrows)
            minDamagePerHit: 5, // Default minimum
            ammoModifiers: {
                // Dragon arrows (all variants including poisoned)
                // Uses soundId 3733 = darkbow_dragon_attack
                11212: {
                    damageMultiplier: 1.5,
                    minDamagePerHit: 8,
                    maxDamagePerHit: 48,
                    graphicId: 1099,
                    projectileId: 1099,
                    name: "Descent of Dragons",
                    soundId: 3733,
                },
                11227: {
                    damageMultiplier: 1.5,
                    minDamagePerHit: 8,
                    maxDamagePerHit: 48,
                    graphicId: 1099,
                    projectileId: 1099,
                    name: "Descent of Dragons",
                    soundId: 3733,
                }, // p
                11228: {
                    damageMultiplier: 1.5,
                    minDamagePerHit: 8,
                    maxDamagePerHit: 48,
                    graphicId: 1099,
                    projectileId: 1099,
                    name: "Descent of Dragons",
                    soundId: 3733,
                }, // p+
                11229: {
                    damageMultiplier: 1.5,
                    minDamagePerHit: 8,
                    maxDamagePerHit: 48,
                    graphicId: 1099,
                    projectileId: 1099,
                    name: "Descent of Dragons",
                    soundId: 3733,
                }, // p++
                // Default for all other arrows - uses soundId 3736 = darkbow_shadow_attack
                default: {
                    damageMultiplier: 1.3,
                    minDamagePerHit: 5,
                    graphicId: 1101,
                    projectileId: 1101,
                    name: "Descent of Darkness",
                    soundId: 3736,
                },
            },
        });

        // Magic Shortbow - Snapshot
        this.register({
            name: "Snapshot",
            weaponIds: [861, 12788], // MSB, MSB(i)
            energyCost: 55,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 2,
            attackType: "ranged",
            animationId: 1074,
            soundId: 2545, // Magic shortbow spec
        });

        // Armadyl Crossbow - Armadyl Eye
        this.register({
            name: "Armadyl Eye",
            weaponIds: [11785],
            energyCost: 40,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            attackType: "ranged",
            animationId: 4230,
            graphicId: 301,
            soundId: 3870, // Armadyl crossbow spec
        });

        // Dragon Crossbow - Annihilate
        this.register({
            name: "Annihilate",
            weaponIds: [21902],
            energyCost: 60,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.2,
            hitCount: 1,
            attackType: "ranged",
            animationId: 7552,
            graphicId: 1438,
            soundId: 2545, // Crossbow spec
        });

        // Toxic Blowpipe - Toxic Siphon
        this.register({
            name: "Toxic Siphon",
            weaponIds: [12926],
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.5,
            hitCount: 1,
            attackType: "ranged",
            effects: {
                healFraction: 0.5, // Heal 50% of damage dealt
            },
            animationId: 5061,
            graphicId: 1043,
            soundId: 2697, // Blowpipe spec
        });

        // Ballista - Concentrated Shot
        this.register({
            name: "Concentrated Shot",
            weaponIds: [19478, 19481], // Light ballista, Heavy ballista
            energyCost: 65,
            accuracyMultiplier: 1.25,
            damageMultiplier: 1.25,
            hitCount: 1,
            attackType: "ranged",
            animationId: 7222,
            soundId: 3739, // Ballista spec
        });

        // Zaryte Crossbow - Evoke
        this.register({
            name: "Evoke",
            weaponIds: [26374],
            energyCost: 75,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            attackType: "ranged",
            // Next attack is guaranteed to hit and activate bolt effect
            effects: {
                guaranteedFirstHit: true,
            },
            soundId: 3870, // Zaryte crossbow spec
        });

        // =====================================================================
        // Magic Weapons
        // =====================================================================

        // Staff of the Dead - Power of Death
        this.register({
            name: "Power of Death",
            weaponIds: [11791, 12904, 22296], // SOTD, Toxic SOTD, Staff of light
            energyCost: 100,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 0, // No attack
            attackType: "magic",
            // Reduces melee damage by 50% for 1 minute
            animationId: 7967,
            graphicId: 1228,
        });

        // Eldritch Nightmare Staff - Invocate
        this.register({
            name: "Invocate",
            weaponIds: [24424],
            energyCost: 75,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            attackType: "magic",
            effects: {
                prayerFraction: 0.5, // Restore prayer equal to 50% of damage
                drainPrayerByDamage: true, // Also drains target's prayer
            },
        });

        // Volatile Nightmare Staff - Immolate
        this.register({
            name: "Immolate",
            weaponIds: [24422],
            energyCost: 55,
            accuracyMultiplier: 1.5, // Uses magic accuracy formula
            damageMultiplier: 1.0, // Damage = magic level * 0.5 to 1.0
            hitCount: 1,
            attackType: "magic",
        });

        // Harmonised Nightmare Staff - No special attack (passive)

        // =====================================================================
        // Other Melee Weapons
        // =====================================================================

        // Granite Maul - Quick Smash
        this.register({
            name: "Quick Smash",
            weaponIds: [4153, 12848], // Granite maul, Granite maul (or)
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            // Instant attack, can be used in same tick as regular attack
            animationId: 1667,
            graphicId: 340,
            soundId: 2715, // Granite maul spec
        });

        // Saradomin Sword - Saradomin's Lightning
        this.register({
            name: "Saradomin's Lightning",
            weaponIds: [11838],
            energyCost: 100,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.1,
            hitCount: 1,
            effects: {
                // Deals 1-16 bonus magic damage
            },
            animationId: 7515,
            graphicId: 1194,
            targetGraphicId: 1195,
            soundId: 3853, // Saradomin sword spec
        });

        // Blessed Saradomin Sword - Saradomin's Lightning
        this.register({
            name: "Saradomin's Lightning",
            weaponIds: [12809],
            energyCost: 65,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.25,
            hitCount: 1,
            effects: {
                // 1/6 chance to deal double damage
            },
            animationId: 7515,
            graphicId: 1194,
            targetGraphicId: 1195,
            soundId: 3853, // Saradomin sword spec
        });

        // Arclight - Demonbane
        this.register({
            name: "Demonbane",
            weaponIds: [19675],
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            effects: {
                // Lowers demon's Attack, Strength, Defence by 5%
            },
            animationId: 2890,
        });

        // Bone Dagger - Backstab
        this.register({
            name: "Backstab",
            weaponIds: [8872],
            energyCost: 75,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 1,
            effects: {
                drainDefence: 1.0, // Drains defence by damage dealt
            },
            animationId: 4198,
            graphicId: 704,
        });

        // Crystal Halberd - Sweep
        this.register({
            name: "Sweep",
            weaponIds: [13080, 13091, 23987, 23995],
            energyCost: 30,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.1,
            hitCount: 2, // Hits twice on large NPCs
            animationId: 1203,
            graphicId: 282,
        });

        // Osmumten's Fang - Ruthless Impale
        this.register({
            name: "Ruthless Impale",
            weaponIds: [26219],
            energyCost: 25,
            accuracyMultiplier: 1.5,
            damageMultiplier: 1.0,
            hitCount: 1,
            // Double accuracy roll against previous target
            animationId: 6118,
        });

        // Ancient Godsword - Blood Sacrifice
        this.register({
            name: "Blood Sacrifice",
            weaponIds: [26233],
            energyCost: 50,
            accuracyMultiplier: 2.0,
            damageMultiplier: 1.1,
            hitCount: 1,
            effects: {
                // Marks target, heals attacker after 8 ticks if target takes damage
            },
            animationId: 9171,
            graphicId: 2006,
            targetGraphicId: 2005,
        });

        // Voidwaker - Disrupt
        this.register({
            name: "Disrupt",
            weaponIds: [27690],
            energyCost: 50,
            accuracyMultiplier: 1.0, // Always hits
            damageMultiplier: 1.0,
            hitCount: 1,
            attackType: "magic",
            effects: {
                guaranteedFirstHit: true,
                // Damage: 50-150% of magic level
            },
            animationId: 9620,
            graphicId: 2373,
            targetGraphicId: 2374,
        });

        // Soulreaper Axe - Soul Harvest
        this.register({
            name: "Soul Harvest",
            weaponIds: [28338],
            energyCost: 50,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0, // 6% per stack (up to 5 stacks)
            hitCount: 1,
            effects: {
                // Consumes all stacks, each stack = +6% damage
            },
            animationId: 10171,
            graphicId: 2582,
        });

        // Scythe of Vitur - Reap
        this.register({
            name: "Reap",
            weaponIds: [22325, 22486, 22664],
            energyCost: 100,
            accuracyMultiplier: 1.0,
            damageMultiplier: 1.0,
            hitCount: 3, // Hits in 3x3 area
            // First hit = 100%, second = 50%, third = 25%
            animationId: 8056,
        });
    }
}

// Singleton instance
export const SpecialAttackRegistry = new SpecialAttackRegistryImpl();

// =============================================================================
// Convenience Functions (for index.ts exports)
// =============================================================================

/**
 * Get special attack definition for a weapon.
 */
export function getSpecialAttack(weaponId: number): SpecialAttackDef | undefined {
    return SpecialAttackRegistry.get(weaponId);
}

/**
 * Check if player can use special attack with current energy.
 */
export function canUseSpecialAttack(weaponId: number, currentEnergy: number): boolean {
    const spec = SpecialAttackRegistry.get(weaponId);
    if (!spec) return false;
    return currentEnergy >= spec.energyCost;
}

/**
 * Consume special attack energy and return new energy value.
 */
export function consumeSpecialEnergy(weaponId: number, currentEnergy: number): number {
    const cost = SpecialAttackRegistry.getEnergyCost(weaponId);
    return Math.max(0, currentEnergy - cost);
}

/**
 * Restore special energy (e.g., from regen or special restore).
 * Returns clamped value at 100.
 */
export function restoreSpecialEnergy(currentEnergy: number, amount: number): number {
    return Math.min(100, currentEnergy + amount);
}

/**
 * Resolve ammo-based special attack modifiers.
 * Used for weapons like Dark bow that change behavior based on ammo type.
 */
export function resolveAmmoModifiers(
    specialDef: SpecialAttackDef,
    ammoId: number,
): {
    damageMultiplier: number;
    minDamagePerHit: number;
    maxDamagePerHit?: number;
    graphicId?: number;
    projectileId?: number;
    soundId?: number;
    name: string;
} {
    if (!specialDef.ammoModifiers) {
        return {
            damageMultiplier: specialDef.damageMultiplier,
            minDamagePerHit: specialDef.minDamagePerHit ?? 0,
            maxDamagePerHit: specialDef.maxDamagePerHit,
            graphicId: specialDef.graphicId,
            projectileId: specialDef.projectileId,
            soundId: specialDef.soundId,
            name: specialDef.name,
        };
    }

    // Check for specific ammo modifier
    const specificMod = specialDef.ammoModifiers[ammoId];
    if (specificMod) {
        return {
            damageMultiplier: specificMod.damageMultiplier,
            minDamagePerHit: specificMod.minDamagePerHit,
            maxDamagePerHit: specificMod.maxDamagePerHit,
            graphicId: specificMod.graphicId ?? specialDef.graphicId,
            projectileId: specificMod.projectileId ?? specialDef.projectileId,
            soundId: specificMod.soundId ?? specialDef.soundId,
            name: specificMod.name ?? specialDef.name,
        };
    }

    // Fall back to default modifier
    const defaultMod = specialDef.ammoModifiers.default;
    if (defaultMod) {
        return {
            damageMultiplier: defaultMod.damageMultiplier,
            minDamagePerHit: defaultMod.minDamagePerHit,
            maxDamagePerHit: defaultMod.maxDamagePerHit,
            graphicId: defaultMod.graphicId ?? specialDef.graphicId,
            projectileId: defaultMod.projectileId ?? specialDef.projectileId,
            soundId: defaultMod.soundId ?? specialDef.soundId,
            name: defaultMod.name ?? specialDef.name,
        };
    }

    // No modifiers found, use base values
    return {
        damageMultiplier: specialDef.damageMultiplier,
        minDamagePerHit: specialDef.minDamagePerHit ?? 0,
        maxDamagePerHit: specialDef.maxDamagePerHit,
        graphicId: specialDef.graphicId,
        projectileId: specialDef.projectileId,
        soundId: specialDef.soundId,
        name: specialDef.name,
    };
}

/**
 * Apply Dark bow special attack damage modifiers.
 * OSRS: Enforces minimum and maximum damage per hit.
 * @param damage - The rolled damage
 * @param minDamage - Minimum damage per hit (5 for regular, 8 for dragon arrows)
 * @param maxDamage - Maximum damage per hit (undefined for regular, 48 for dragon arrows)
 * @param hitLanded - Whether the hit landed (0s bypass minimum)
 * @returns Adjusted damage value
 */
export function applyDarkBowDamageModifiers(
    damage: number,
    minDamage: number,
    maxDamage: number | undefined,
    hitLanded: boolean,
): number {
    if (!hitLanded) {
        // Misses still get minimum damage for Dark bow spec
        return minDamage;
    }
    let adjustedDamage = damage;
    // Apply minimum damage
    if (adjustedDamage < minDamage) {
        adjustedDamage = minDamage;
    }
    // Apply maximum damage cap (dragon arrows only)
    if (maxDamage !== undefined && adjustedDamage > maxDamage) {
        adjustedDamage = maxDamage;
    }
    return adjustedDamage;
}

/**
 * Check if weapon is a Dark bow (including painted variants).
 */
export function isDarkBow(weaponId: number): boolean {
    return (
        weaponId === 11235 ||
        weaponId === 12765 ||
        weaponId === 12766 ||
        weaponId === 12767 ||
        weaponId === 12768
    );
}

// =============================================================================
// Special Attack Calculations
// =============================================================================

/**
 * Calculate dragon claw damage pattern.
 * OSRS: If first hit lands for X, pattern is: X, X/2, X/4, X/4
 * If first misses, second hit rolls normally, etc.
 */
export function calculateDragonClawsHits(maxHit: number, hitRolls: number[]): number[] {
    const hits: number[] = [0, 0, 0, 0];

    // First hit determines pattern
    if (hitRolls[0] > 0) {
        const first = hitRolls[0];
        hits[0] = first;
        hits[1] = Math.floor(first / 2);
        hits[2] = Math.floor(first / 4);
        hits[3] = Math.floor(first / 4) + (first % 4 >= 2 ? 1 : 0);
    } else if (hitRolls[1] > 0) {
        // First misses, second hits
        const second = hitRolls[1];
        hits[0] = 0;
        hits[1] = second;
        hits[2] = Math.floor(second / 2);
        hits[3] = Math.floor(second / 2) + (second % 2);
    } else if (hitRolls[2] > 0) {
        // First two miss, third hits
        const third = hitRolls[2];
        hits[0] = 0;
        hits[1] = 0;
        hits[2] = Math.floor(third * 0.75);
        hits[3] = Math.floor(third * 0.75) + (Math.floor(third * 0.5) % 2);
    } else {
        // All miss except possibly last
        hits[0] = 0;
        hits[1] = 0;
        hits[2] = 0;
        hits[3] = hitRolls[3] > 0 ? Math.floor(maxHit * 1.5) : 0;
    }

    return hits;
}

/**
 * Calculate granite maul combo.
 * OSRS: Can be used instantly after another attack.
 */
export function canGraniteMaulCombo(
    weaponId: number,
    lastAttackTick: number,
    currentTick: number,
): boolean {
    const isGmaul = weaponId === 4153 || weaponId === 12848;
    // Can spec immediately after any attack
    return isGmaul && currentTick === lastAttackTick;
}
