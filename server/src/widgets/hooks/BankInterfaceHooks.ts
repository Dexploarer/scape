/**
 * BankInterfaceHooks - Bank interface lifecycle hooks
 *
 * Based on RSMod's bank plugin pattern.
 * Registers on_interface_open and on_interface_close hooks for the bank interface.
 *
 * Flow:
 * 1. Bank opens (12) -> Open bank side panel (15) in sidemodal/tab area (type 3)
 * 2. Bank closes (12) -> Close bank side panel, restore normal inventory (149)
 *
 * Usage:
 * ```ts
 * const interfaceService = new InterfaceService(dispatcher);
 * registerBankInterfaceHooks(interfaceService);
 *
 * // Now when you open a bank, the hooks handle everything:
 * interfaceService.openModal(player, BANK_INTERFACE_ID, { bankData });
 * ```
 */
import { BankLimits, BankMainChild, BankSideChild, WidgetGroup } from "../../constants/bank";
import type { PlayerState } from "../../game/player";
import type { InterfaceHookContext, InterfaceService } from "../InterfaceService";

// NOTE: GameframeTab import kept for reference - OSRS doesn't call focusTab for bank
// import { GameframeTab } from "../InterfaceService";

// =============== BANK INTERFACE CONSTANTS ===============
// Re-exported from constants/bank.ts for convenience

/** Bank main interface (group 12) */
export const BANK_INTERFACE_ID = WidgetGroup.BANK_MAIN;

/** Bank side inventory panel (group 15) */
export const BANK_SIDE_INTERFACE_ID = WidgetGroup.BANK_SIDE;

/** Bank side items component (15:3) */
export const BANK_SIDE_ITEMS_COMPONENT = BankSideChild.ITEMS;

/**
 * Flags for bank side inventory widget (15:3)
 * Enables deposit operations (ops 2-8), examine
 * Based on IF_SETEVENTS from OSRS
 */
export const BANK_SIDE_FLAGS = 1181694;

/**
 * Flags for bank main content widget (12:12)
 * Enables withdraw operations (ops 1-8):
 * - op1: Withdraw-<default qty>
 * - op2: Withdraw-1
 * - op3: Withdraw-5
 * - op4: Withdraw-10
 * - op5: Withdraw-<custom>
 * - op6: Withdraw-X
 * - op7: Withdraw-All
 * - op8: Withdraw-All-but-1
 *
 * Flag bits:
 * - Bits 1-8: enable ops 1-8 = 510
 * - Bit 20: drop target for drag reordering = 1048576
 */
export const BANK_CONTENT_FLAGS = 510 | (1 << 20); // = 1048576 + 510 = 1049086

/**
 * Flags for bank tab interaction widget (12:10) dynamic children.
 *
 * OSRS parity (matches RSMod bank plugin):
 * - slot 10 ("All items" tab): 1048578
 * - slots 11-19 (tab buttons/new tab): 1179714
 */
export const BANK_TAB_ALL_FLAGS = 1048578;
export const BANK_TAB_BUTTON_FLAGS = 1179714;
const BANK_TAB_ALL_SLOT = 10;
const BANK_TAB_SLOT_START = 11;
const BANK_TAB_SLOT_END = 19;

// =============== BANK VARPS/VARBITS ===============
// These are re-exported from bank.ts for convenience

/** Varp that indicates bank modal is open (script 900 checks this) */
export const BANK_MODAL_INDICATOR_VARP = 548;

// =============== SCRIPT IDS ===============

/**
 * Script 6009 - Bank side inventory initialization
 * Similar to script 149 (interface_inv_init) but for bank deposit mode.
 *
 * OSRS args: [component, slot_count, mode, scrollbar]
 * Example: [9764864, 28, 1, -1]
 *   - 9764864 = int32(149 << 16) = inventory widget UID
 *   - 28 = inventory slot count
 *   - 1 = bank deposit mode
 *   - -1 = no scrollbar
 */
export const SCRIPT_BANK_SIDE_INVENTORY_INIT = 6009;

// NOTE: Script 2208 (deposit amount labels) is NOT server-sent in OSRS.
// It's triggered client-side by onLoad handlers after WIDGET_LOAD.
// Keeping reference here for documentation:
// export const SCRIPT_DEPOSIT_AMOUNT_LABEL = 2208;
// export const DEPOSIT_AMOUNT_LABELS = ["1", "10", "50", "X", "All"] as const;

/** Normal inventory interface ID */
const INVENTORY_INTERFACE_ID = 149;

// =============== TYPES ===============

/**
 * Bank open data passed when opening a bank.
 * This is the data attached to the modal via interfaceService.openModal().
 */
export interface BankOpenData {
    /** Varps to set when opening bank */
    varps: Record<number, number>;
    /** Varbits to set when opening bank */
    varbits: Record<number, number>;
}

// =============== HOOK REGISTRATION ===============

/**
 * Register bank interface hooks with the InterfaceService.
 * Should be called once at server startup.
 *
 * @param interfaceService The InterfaceService to register hooks with
 */
export function registerBankInterfaceHooks(interfaceService: InterfaceService): void {
    // =============== ON BANK OPEN ===============
    interfaceService.onInterfaceOpen(BANK_INTERFACE_ID, (player, ctx) => {
        const bankData = ctx.data as BankOpenData | undefined;

        // OSRS parity: Set IF_SETEVENTS for bank content items (12:12)
        // This enables withdraw operations (ops 1-8) on bank items.
        // Without this, bank items won't show menu options or register click targets.
        const bankContentWidgetUid = (BANK_INTERFACE_ID << 16) | BankMainChild.ITEMS;
        ctx.service.setWidgetFlags(
            player,
            bankContentWidgetUid,
            0,
            BankLimits.MAX_SLOTS - 1, // 0 to 1409
            BANK_CONTENT_FLAGS,
        );

        // OSRS parity: Set IF_SETEVENTS for bank tab interaction widget (12:10).
        // This enables tab click/drag interactions (including drag-to-create-tab).
        const bankTabsWidgetUid = (BANK_INTERFACE_ID << 16) | BankMainChild.TABS;
        ctx.service.setWidgetFlags(
            player,
            bankTabsWidgetUid,
            BANK_TAB_ALL_SLOT,
            BANK_TAB_ALL_SLOT,
            BANK_TAB_ALL_FLAGS,
        );
        ctx.service.setWidgetFlags(
            player,
            bankTabsWidgetUid,
            BANK_TAB_SLOT_START,
            BANK_TAB_SLOT_END,
            BANK_TAB_BUTTON_FLAGS,
        );

        // Open bank side panel (15) - replaces normal inventory
        const bankSideWidgetUid = (BANK_SIDE_INTERFACE_ID << 16) | BANK_SIDE_ITEMS_COMPONENT;

        ctx.service.openInventorySidePanel(player, {
            interfaceId: BANK_SIDE_INTERFACE_ID,
            // Bank side panel needs the same varps/varbits as main modal
            varps: bankData?.varps,
            varbits: bankData?.varbits,
            setFlags: {
                uid: bankSideWidgetUid,
                fromSlot: 0,
                toSlot: 27,
                flags: BANK_SIDE_FLAGS,
            },
        });

        // OSRS parity: Run script 6009 to initialize bank-side inventory
        // This is analogous to script 149 (interface_inv_init) for shops
        // Args: [component_uid, slot_count, mode, scrollbar]
        const inventoryWidgetUid = INVENTORY_INTERFACE_ID << 16;
        ctx.service.runScript(player, SCRIPT_BANK_SIDE_INVENTORY_INIT, [
            inventoryWidgetUid, // component (149:0)
            28, // slot_count
            1, // mode (1 = bank deposit mode)
            -1, // scrollbar (-1 = none)
        ]);

        // NOTE: Script 2208 (deposit labels) is NOT server-sent in OSRS.
        // It's triggered client-side by onLoad handlers after WIDGET_LOAD.
        // We don't need to call it here.

        // NOTE: Script 915 (focusTab) is also NOT called by OSRS for bank opening.
        // The client handles tab focus automatically when the bank side panel opens.
        // Keeping this commented out for now - enable if needed for better UX:
        // ctx.service.focusTab(player, GameframeTab.INVENTORY);
    });

    // =============== ON BANK CLOSE ===============
    interfaceService.onInterfaceClose(BANK_INTERFACE_ID, (player, ctx) => {
        // OSRS parity: Restore normal inventory when bank closes
        // This runs inventory_init script (6007) to recreate inventory slots
        ctx.service.restoreNormalInventory(player);
    });
}
