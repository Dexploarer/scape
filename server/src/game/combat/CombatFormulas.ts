/**
 * Combat Formulas - Pure functions for OSRS combat calculations.
 *
 * RSMod parity: All formulas match RSMod's MeleeCombatFormula, RangedCombatFormula, etc.
 * No class state, no side effects - just math.
 */
import type { AttackType } from "./AttackType";

// =============================================================================
// Types
// =============================================================================

export interface AttackerStats {
    effectiveLevel: number; // Level + 8 + stance bonus + prayer
    bonus: number; // Equipment/NPC attack bonus
}

export interface DefenderStats {
    effectiveLevel: number; // Level + 8 + stance bonus + prayer
    bonus: number; // Equipment/NPC defence bonus
}

export interface MaxHitParams {
    effectiveStrength: number; // Strength level + 8 + stance bonus + prayer
    strengthBonus: number; // Equipment/NPC strength bonus
}

// =============================================================================
// Core Formulas
// =============================================================================

/**
 * Calculate attack roll.
 * RSMod: effectiveLevel * (bonus + 64)
 */
export function attackRoll(attacker: AttackerStats): number {
    return attacker.effectiveLevel * (attacker.bonus + 64);
}

/**
 * Calculate defence roll.
 * RSMod: effectiveLevel * (bonus + 64)
 */
export function defenceRoll(defender: DefenderStats): number {
    return defender.effectiveLevel * (defender.bonus + 64);
}

/**
 * Calculate hit chance from attack and defence rolls.
 * RSMod formula:
 *   if attack > defence: 1 - (defence + 2) / (2 * (attack + 1))
 *   else: attack / (2 * (defence + 1))
 */
export function hitChance(attackRoll: number, defenceRoll: number): number {
    if (defenceRoll <= 0) return 1;
    if (attackRoll > defenceRoll) {
        return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
    }
    return attackRoll / (2 * (defenceRoll + 1));
}

/**
 * Calculate max hit from effective strength and bonus.
 * RSMod formula: floor(0.5 + effectiveStrength * (strengthBonus + 64) / 640)
 */
export function maxHit(params: MaxHitParams): number {
    const raw = 0.5 + (params.effectiveStrength * (params.strengthBonus + 64)) / 640;
    return Math.max(1, Math.floor(raw));
}

/**
 * Roll damage between 0 and maxHit (inclusive).
 * OSRS: Uniform distribution.
 */
export function rollDamage(maxHit: number, random: number): number {
    if (maxHit <= 0) return 0;
    // random should be [0, 1), result is [0, maxHit]
    return Math.floor(random * (maxHit + 1));
}

// =============================================================================
// Effective Level Calculations
// =============================================================================

/**
 * Calculate effective level for melee/ranged attack or defence.
 * Formula: floor(level * prayerMultiplier) + stanceBonus + 8
 */
export function effectiveLevel(
    level: number,
    prayerMultiplier: number,
    stanceBonus: number,
): number {
    const prayed = Math.floor(level * prayerMultiplier);
    return Math.max(1, prayed + stanceBonus + 8);
}

/**
 * Calculate effective level for magic defence.
 * OSRS: 70% magic, 30% defence.
 * Formula: floor(magic * 0.7 + defence * 0.3) + 8
 */
export function effectiveMagicDefence(magicLevel: number, defenceLevel: number): number {
    return Math.max(1, Math.floor(magicLevel * 0.7 + defenceLevel * 0.3) + 8);
}

/**
 * Calculate NPC effective attack level.
 * NPCs don't have prayers or stance - just level + 8.
 */
export function npcEffectiveAttack(attackLevel: number): number {
    return attackLevel + 8;
}

/**
 * Calculate NPC effective strength level.
 * RSMod: NPCs just use level + 8 (no stance bonus).
 */
export function npcEffectiveStrength(strengthLevel: number): number {
    return strengthLevel + 8;
}

/**
 * Calculate NPC effective defence level.
 * NPCs just use level + 8.
 */
export function npcEffectiveDefence(defenceLevel: number): number {
    return defenceLevel + 8;
}

// =============================================================================
// NPC Combat Helpers
// =============================================================================

/**
 * Get NPC attack bonus for a specific attack type.
 */
export function getNpcAttackBonus(
    profile: { attackBonus: number; magicBonus: number; rangedBonus: number },
    attackType: AttackType,
): number {
    switch (attackType) {
        case "magic":
            return profile.magicBonus;
        case "ranged":
            return profile.rangedBonus;
        case "melee":
        default:
            return profile.attackBonus;
    }
}

/**
 * Get NPC defence bonus for a specific attack type.
 */
export function getNpcDefenceBonus(
    profile: {
        defenceStab: number;
        defenceSlash: number;
        defenceCrush: number;
        defenceMagic: number;
        defenceRanged: number;
    },
    attackType: AttackType,
    meleeStyle: "stab" | "slash" | "crush" = "slash",
): number {
    switch (attackType) {
        case "magic":
            return profile.defenceMagic;
        case "ranged":
            return profile.defenceRanged;
        case "melee":
        default:
            switch (meleeStyle) {
                case "stab":
                    return profile.defenceStab;
                case "crush":
                    return profile.defenceCrush;
                case "slash":
                default:
                    return profile.defenceSlash;
            }
    }
}

/**
 * Calculate NPC max hit from profile.
 * Uses explicit maxHit if > 0, otherwise calculates from strength.
 */
export function npcMaxHit(profile: {
    maxHit: number;
    strengthLevel: number;
    strengthBonus: number;
}): number {
    if (profile.maxHit > 0) {
        return profile.maxHit;
    }
    const effectiveStr = npcEffectiveStrength(profile.strengthLevel);
    return maxHit({ effectiveStrength: effectiveStr, strengthBonus: profile.strengthBonus });
}

// =============================================================================
// Full Combat Calculations
// =============================================================================

/**
 * Calculate NPC attack outcome against a player.
 * Returns hit chance and max hit - caller rolls the actual hit.
 */
export function calculateNpcVsPlayer(
    npcProfile: {
        attackLevel: number;
        attackBonus: number;
        magicBonus: number;
        rangedBonus: number;
        maxHit: number;
        strengthLevel: number;
        strengthBonus: number;
        attackType: AttackType;
    },
    playerDefence: {
        defenceLevel: number;
        magicLevel: number;
        defenceBonus: number;
    },
    attackType?: AttackType,
): { hitChance: number; maxHit: number } {
    const type = attackType ?? npcProfile.attackType;

    // NPC attack roll
    const npcEffAtk = npcEffectiveAttack(npcProfile.attackLevel);
    const npcAtkBonus = getNpcAttackBonus(npcProfile, type);
    const npcAtkRoll = attackRoll({ effectiveLevel: npcEffAtk, bonus: npcAtkBonus });

    // Player defence roll
    let playerEffDef: number;
    if (type === "magic") {
        playerEffDef = effectiveMagicDefence(playerDefence.magicLevel, playerDefence.defenceLevel);
    } else {
        playerEffDef = effectiveLevel(playerDefence.defenceLevel, 1, 0); // No prayer/stance for simplicity
    }
    const playerDefRoll = defenceRoll({
        effectiveLevel: playerEffDef,
        bonus: playerDefence.defenceBonus,
    });

    return {
        hitChance: hitChance(npcAtkRoll, playerDefRoll),
        maxHit: npcMaxHit(npcProfile),
    };
}
