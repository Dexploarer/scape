import type { AttackType } from "../combat/AttackType";
import {
    LIL_CREATOR_ITEM_ID,
    LIL_CREATOR_NPC_TYPE_ID,
    LIL_DESTRUCTOR_NPC_TYPE_ID,
} from "./followerDefinitions";

export interface FollowerCombatDefinition {
    attackSpeed: number;
    maxHit: number;
    attackRange?: number;
    hitDelay?: number;
    attackType?: AttackType;
    attackAnimationId?: number;
    attackSoundId?: number;
}

export interface CombatCompanionVariantDefinition {
    itemId: number;
    npcTypeId: number;
    combat: FollowerCombatDefinition;
}

export const COMBAT_COMPANION_VARIANTS: readonly CombatCompanionVariantDefinition[] = [
    {
        itemId: LIL_CREATOR_ITEM_ID,
        npcTypeId: LIL_CREATOR_NPC_TYPE_ID,
        combat: {
            attackSpeed: 4,
            maxHit: 1,
            attackRange: 1,
            hitDelay: 1,
            attackType: "melee",
            attackAnimationId: 8844,
            attackSoundId: 4882,
        },
    },
    {
        itemId: LIL_CREATOR_ITEM_ID,
        npcTypeId: LIL_DESTRUCTOR_NPC_TYPE_ID,
        combat: {
            attackSpeed: 4,
            maxHit: 1,
            attackRange: 1,
            hitDelay: 1,
            attackType: "melee",
            attackAnimationId: 8840,
            attackSoundId: 4844,
        },
    },
];

const combatCompanionByKey = new Map<string, FollowerCombatDefinition>(
    COMBAT_COMPANION_VARIANTS.map((variant) => [
        makeCombatCompanionKey(variant.itemId, variant.npcTypeId),
        variant.combat,
    ]),
);

export function getCombatCompanionDefinition(
    itemId: number,
    npcTypeId: number,
): FollowerCombatDefinition | undefined {
    return combatCompanionByKey.get(makeCombatCompanionKey(itemId, npcTypeId));
}

function makeCombatCompanionKey(itemId: number, npcTypeId: number): string {
    return `${itemId | 0}:${npcTypeId | 0}`;
}
