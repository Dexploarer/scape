import { type ItemDefinition, getItemDefinition as baseGetItemDefinition } from "../../data/items";
import { ServerCustomItemRegistry } from "./ServerCustomItemRegistry";

/**
 * Enhanced getItemDefinition that checks custom items first.
 * Drop-in replacement for the base function.
 */
export function getCustomItemDefinition(itemId: number): ItemDefinition | undefined {
    // Check custom registry first
    if (ServerCustomItemRegistry.has(itemId)) {
        return ServerCustomItemRegistry.getItemDefinition(itemId, baseGetItemDefinition);
    }

    // Fall back to base loader
    return baseGetItemDefinition(itemId);
}
