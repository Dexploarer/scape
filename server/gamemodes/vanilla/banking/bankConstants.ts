/**
 * Bank interface constants - .
 *
 * Child ids here are confirmed against the current cache revision's bank CS2:
 * - script 274: [clientscript,bankmain_init]
 * - script 294: [clientscript,bankside_init]
 */

// Widget Group IDs
export const WidgetGroup = {
    BANK_MAIN: 12,
    BANK_SIDE: 15,
} as const;

// Widget Child IDs within Bank Main (group 12)
export const BankMainChild = {
    CLOSE_BUTTON: 2,
    TITLE: 3,
    BANK_TUTORIAL: 4,
    CAPACITY: 5, // Occupied slots / capacity text (for example "352/800")
    ITEMS_CONTAINER: 9,
    TABS: 10, // Tab interaction target used for tab clicks and drag-to-tab.
    ITEMS: 12,
    SCROLLBAR: 13,
    BOTTOM: 16,
    SWAP_INSERT_BUTTON: 17,
    SWAP_INSERT_GRAPHIC: 18,
    NOTE_BUTTON: 19,
    QUANTITY_LAYER: 22,
    QUANTITY_ONE_BUTTON: 23,
    QUANTITY_FIVE_BUTTON: 25,
    QUANTITY_TEN_BUTTON: 27,
    QUANTITY_X_BUTTON: 29,
    QUANTITY_ALL_BUTTON: 31,
    PLACEHOLDER_BUTTON: 34,
    SEARCH: 36,
    DEPOSIT_CONTAINERS: 39,
    DEPOSIT_CONTAINERS_GRAPHIC: 40,
    DEPOSIT_INVENTORY: 41,
    DEPOSIT_INVENTORY_GRAPHIC: 42,
    DEPOSIT_WORN: 43,
    DEPOSIT_WORN_GRAPHIC: 44,
    INCINERATOR_TARGET: 48,
    INCINERATOR_CONFIRM: 49,
    MENU_CONTAINER: 53,
    WORN_ITEMS_CONTAINER: 54,
    MENU_BUTTON: 99,
    WORN_ITEMS_BUTTON: 100,
    TOOLTIP: 104,
    GIM_STORAGE: 118,
} as const;

// Widget Child IDs within Bank Side (group 15)
export const BankSideChild = {
    ITEMS_CONTAINER: 1,
    ITEMS_BACKGROUND: 2,
    ITEMS: 3,
    WORN_OPS: 4,
    LOOTING_BAG_CONTAINER: 5,
    LOOTING_BAG_ITEMS: 11,
    LEAGUE_SECOND_INV_CONTAINER: 12,
    LEAGUE_SECOND_INV_DISMISS: 15,
    LEAGUE_SECOND_INV_ITEMS: 18,
    RUNE_POUCH_CONTAINER: 19,
    RUNE_POUCH_DISMISS: 22,
    RUNE_POUCH_SELECT_CONTAINER: 35,
    PREPOT_DEVICE_CONTAINER: 59,
    PREPOT_DEVICE_DISMISS: 63,
} as const;

// Varbit IDs for bank settings
export const BankVarbit = {
    CURRENT_TAB: 4150,
    TAB_DISPLAY: 4170,
    TAB_1: 4171,
    TAB_2: 4172,
    TAB_3: 4173,
    TAB_4: 4174,
    TAB_5: 4175,
    TAB_6: 4176,
    TAB_7: 4177,
    TAB_8: 4178,
    TAB_9: 4179,
    LEAVE_PLACEHOLDERS: 3755,
    WITHDRAW_NOTES: 3958,
    INSERT_MODE: 3959,
    REQUESTED_QUANTITY: 3960,
    QUANTITY_TYPE: 6590,
    // Bank side inventory slot lock varbits (varp 4611 shared with LOCKED_SLOTS)
    SLOT_LOCK_OVERVIEW: 5422, // Bitmask of locked inventory slots (bits 0-27)
    SLOT_LOCK_IGNORE: 5450, // Set to 1 to hide slot lock indicators
} as const;

// Varp IDs for bank settings
export const BankVarp = {
    LOCKED_SLOTS: 4611,
    /**
     * Modal interface indicator varp.
     * Script 900 checks this to identify when bank is open.
     * Set to 1 when bank is open, 0 when closed.
     */
    MODAL_INDICATOR: 548,
} as const;

// Bank limits
export const BankLimits = {
    MAX_SLOTS: 1410,
    MAX_TABS: 9,
    DEFAULT_CAPACITY: 800,
} as const;

// Tab slot indices (child index within tabs container)
// Tab 0 (All items) = slot 10, Tab 1 = slot 11, etc.
export const TAB_SLOT_OFFSET = 10;

/**
 * Convert a widget slot to a tab index
 */
export function slotToTabIndex(slot: number): number {
    return slot - TAB_SLOT_OFFSET;
}

/**
 * Extract group ID from widget UID
 */
export function getWidgetGroup(uid: number): number {
    return (uid >>> 16) & 0xffff;
}

/**
 * Extract child ID from widget UID
 */
export function getWidgetChild(uid: number): number {
    return uid & 0xffff;
}
