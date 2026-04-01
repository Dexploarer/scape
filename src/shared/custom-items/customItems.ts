/**
 * Custom Item Definitions
 *
 * To find model colors: window.debugModelColors(MODEL_ID) in browser console
 * OSRS HSL: (hue << 10) | (sat << 7) | light
 *   Hue: 0=red, 10=orange, 21=green, 32=gray, 43=blue, 51=purple
 */
import { CustomItemBuilder } from "../../custom/items/CustomItemBuilder";
import { CustomItemRegistry } from "../../custom/items/CustomItemRegistry";

const register = (
    id: number,
    baseId: number,
    name: string,
    from: number[],
    to: number[],
    actions: (string | null)[] = [null, null, null, null, "Drop"],
) => {
    CustomItemRegistry.register(
        CustomItemBuilder.create(id)
            .basedOn(baseId)
            .name(name)
            .recolor(from, to)
            .inventoryActions(...actions)
            .build(),
        name,
    );
    return id;
};

// =============================================================================
// DEMONIC ASHES - Override cache items to add "Scatter" action
// =============================================================================

// Register the demonic ashes with the same IDs to override cache data
CustomItemRegistry.register(
    CustomItemBuilder.create(25766)
        .basedOn(25766)
        .name("Fiendish ashes")
        .inventoryActions("Scatter", null, null, null, "Drop")
        .build(),
    "Fiendish ashes (override)",
);

CustomItemRegistry.register(
    CustomItemBuilder.create(25769)
        .basedOn(25769)
        .name("Vile ashes")
        .inventoryActions("Scatter", null, null, null, "Drop")
        .build(),
    "Vile ashes (override)",
);

CustomItemRegistry.register(
    CustomItemBuilder.create(25772)
        .basedOn(25772)
        .name("Malicious ashes")
        .inventoryActions("Scatter", null, null, null, "Drop")
        .build(),
    "Malicious ashes (override)",
);

CustomItemRegistry.register(
    CustomItemBuilder.create(25775)
        .basedOn(25775)
        .name("Abyssal ashes")
        .inventoryActions("Scatter", null, null, null, "Drop")
        .build(),
    "Abyssal ashes (override)",
);

CustomItemRegistry.register(
    CustomItemBuilder.create(25778)
        .basedOn(25778)
        .name("Infernal ashes")
        .inventoryActions("Scatter", null, null, null, "Drop")
        .build(),
    "Infernal ashes (override)",
);

// =============================================================================
// CUSTOM ITEMS
// =============================================================================

export const CUSTOM_ITEM_IDS = {
    RED_BOND: register(
        50000,
        13190,
        "$5 Bond",
        [20416, 21435, 22181, 22305, 22449, 22451, 22464],
        [960, 1979, 2725, 2849, 2993, 2995, 3008],
        ["Redeem", null, null, null, "Drop"],
    ),
} as const;
