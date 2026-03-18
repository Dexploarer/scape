import { CustomItemRegistry } from "../../../../src/custom/items/CustomItemRegistry";
import type { CustomItemDefProps } from "../../../../src/custom/items/CustomItemTypes";
import type { ItemDefinition } from "../../data/items";

/**
 * Server-side custom item registry.
 * Builds ItemDefinition objects from custom item definitions.
 */
class ServerCustomItemRegistryImpl {
    private readonly cache = new Map<number, ItemDefinition>();

    /**
     * Get custom item definition, merged with base if applicable.
     */
    getItemDefinition(
        id: number,
        baseLoader: (id: number) => ItemDefinition | undefined,
    ): ItemDefinition | undefined {
        // Check cache
        const cached = this.cache.get(id);
        if (cached) return cached;

        // Check if custom item exists
        const customItem = CustomItemRegistry.get(id);
        if (!customItem) return undefined;

        const { definition } = customItem;

        // Get base definition if applicable
        let baseDef: ItemDefinition | undefined;
        if (definition.baseItemId !== undefined) {
            baseDef = baseLoader(definition.baseItemId);
        }

        // Build merged definition
        const merged = this.buildItemDefinition(
            id,
            definition.objType.name,
            definition.itemDef,
            baseDef,
        );
        this.cache.set(id, merged);
        return merged;
    }

    private buildItemDefinition(
        id: number,
        name: string,
        props: CustomItemDefProps,
        base?: ItemDefinition,
    ): ItemDefinition {
        return {
            id,
            name,
            examine: "",
            equipmentType: props.equipmentType ?? base?.equipmentType,
            weaponInterface: props.weaponInterface ?? base?.weaponInterface,
            doubleHanded: props.doubleHanded ?? base?.doubleHanded ?? false,
            stackable: props.stackable ?? base?.stackable ?? false,
            tradeable: props.tradeable ?? base?.tradeable ?? false,
            dropable: props.dropable ?? base?.dropable ?? true,
            sellable: props.sellable ?? base?.sellable ?? false,
            noted: false,
            value: props.value ?? base?.value ?? 0,
            bloodMoneyValue: props.bloodMoneyValue ?? base?.bloodMoneyValue,
            highAlch: props.highAlch ?? base?.highAlch ?? 0,
            lowAlch: props.lowAlch ?? base?.lowAlch ?? 0,
            dropValue: props.dropValue ?? base?.dropValue ?? 0,
            noteId: -1,
            blockAnim: props.blockAnim ?? base?.blockAnim ?? 0,
            standAnim: props.standAnim ?? base?.standAnim ?? 0,
            walkAnim: props.walkAnim ?? base?.walkAnim ?? 0,
            runAnim: props.runAnim ?? base?.runAnim ?? 0,
            standTurnAnim: props.standTurnAnim ?? base?.standTurnAnim ?? 0,
            turn180Anim: props.turn180Anim ?? base?.turn180Anim ?? 0,
            turn90CWAnim: props.turn90CWAnim ?? base?.turn90CWAnim ?? 0,
            turn90CCWAnim: props.turn90CCWAnim ?? base?.turn90CCWAnim ?? 0,
            weight: 0,
            bonuses: props.bonuses ?? base?.bonuses,
            requirements: props.requirements ?? base?.requirements,
        };
    }

    /**
     * Check if an ID has a custom item definition.
     */
    has(id: number): boolean {
        return CustomItemRegistry.has(id);
    }

    /**
     * Clear cache (for hot reload).
     */
    clearCache(): void {
        this.cache.clear();
    }
}

export const ServerCustomItemRegistry = new ServerCustomItemRegistryImpl();
