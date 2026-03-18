export interface FollowerVariantDefinition {
    npcTypeId: number;
}

export interface FollowerItemDefinition {
    itemId: number;
    npcTypeId: number;
    variants?: readonly FollowerVariantDefinition[];
}

export const LIL_CREATOR_ITEM_ID = 25348;
export const LIL_CREATOR_NPC_TYPE_ID = 3566;
export const LIL_DESTRUCTOR_NPC_TYPE_ID = 5008;

export const FOLLOWER_ITEM_DEFINITIONS: readonly FollowerItemDefinition[] = [
    {
        itemId: LIL_CREATOR_ITEM_ID,
        npcTypeId: LIL_CREATOR_NPC_TYPE_ID,
        variants: [
            {
                npcTypeId: LIL_CREATOR_NPC_TYPE_ID,
            },
            {
                npcTypeId: LIL_DESTRUCTOR_NPC_TYPE_ID,
            },
        ],
    },
];

const followerByItemId = new Map<number, FollowerItemDefinition>(
    FOLLOWER_ITEM_DEFINITIONS.map((definition) => [definition.itemId, definition]),
);
const followerByNpcTypeId = new Map<number, FollowerItemDefinition>();

for (const definition of FOLLOWER_ITEM_DEFINITIONS) {
    followerByNpcTypeId.set(definition.npcTypeId, definition);
    for (const variant of definition.variants ?? []) {
        followerByNpcTypeId.set(variant.npcTypeId, definition);
    }
}

export function getFollowerDefinitionByItemId(itemId: number): FollowerItemDefinition | undefined {
    return followerByItemId.get(itemId | 0);
}

export function getFollowerDefinitionByNpcTypeId(
    npcTypeId: number,
): FollowerItemDefinition | undefined {
    return followerByNpcTypeId.get(npcTypeId | 0);
}

export function getFollowerVariant(
    definition: FollowerItemDefinition,
    npcTypeId: number,
): FollowerVariantDefinition | undefined {
    return (definition.variants ?? []).find((variant) => variant.npcTypeId === (npcTypeId | 0));
}

export function getDefaultFollowerVariant(
    definition: FollowerItemDefinition,
): FollowerVariantDefinition {
    return (
        getFollowerVariant(definition, definition.npcTypeId) ?? {
            npcTypeId: definition.npcTypeId,
        }
    );
}
