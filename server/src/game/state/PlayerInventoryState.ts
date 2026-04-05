/**
 * Inventory, bank, shop, and crafting UI fields for a player.
 * Composed into PlayerState to co-locate item storage data.
 *
 * Methods that perform item operations (addItem, removeItem, bank CRUD)
 * remain on PlayerState since they depend on stackability resolution
 * and dirty flag management.
 */
export class PlayerInventoryState {
    // Inventory (28 slots)
    inventory: Array<{ itemId: number; quantity: number }> = [];
    inventoryInitialized: boolean = false;

    // Bank
    bank: Array<{
        itemId: number;
        quantity: number;
        placeholder?: boolean;
        tab?: number;
        filler?: boolean;
    }> = [];
    bankCapacity: number = 800;
    bankWithdrawNoteMode: boolean = false;
    bankInsertMode: boolean = false;
    bankQuantityMode: number = 0;
    bankPlaceholderMode: boolean = false;
    bankCustomQuantity: number = 0;
    bankClientSlotMapping: number[] = [];

    // Shop interface
    activeShopId?: string;
    shopBuyMode: number = 0;
    shopSellMode: number = 0;

    // Smithing UI quantity
    smithingQuantityMode: number = 0;
    smithingCustomQuantity: number = 0;

    // Dirty flags
    inventoryDirty: boolean = false;
    bankDirty: boolean = false;
}
