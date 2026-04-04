import { BankLimits, BankMainChild, BankSideChild, WidgetGroup } from "./bankConstants";
import type { PlayerState } from "../../../src/game/player";
import type { InterfaceHookContext, InterfaceService } from "../../../src/widgets/InterfaceService";

export const BANK_INTERFACE_ID = WidgetGroup.BANK_MAIN;
export const BANK_SIDE_INTERFACE_ID = WidgetGroup.BANK_SIDE;
export const BANK_SIDE_ITEMS_COMPONENT = BankSideChild.ITEMS;

export const BANK_SIDE_FLAGS = 1181694;
export const BANK_CONTENT_FLAGS = 510 | (1 << 20); // = 1049086

export const BANK_TAB_ALL_FLAGS = 1048578;
export const BANK_TAB_BUTTON_FLAGS = 1179714;
const BANK_TAB_ALL_SLOT = 10;
const BANK_TAB_SLOT_START = 11;
const BANK_TAB_SLOT_END = 19;

export const BANK_MODAL_INDICATOR_VARP = 548;

export const SCRIPT_BANK_SIDE_INVENTORY_INIT = 6009;

const INVENTORY_INTERFACE_ID = 149;

export interface BankOpenData {
    varps: Record<number, number>;
    varbits: Record<number, number>;
}

export function registerBankInterfaceHooks(interfaceService: InterfaceService): void {
    interfaceService.onInterfaceOpen(BANK_INTERFACE_ID, (player, ctx) => {
        const bankData = ctx.data as BankOpenData | undefined;

        const bankContentWidgetUid = (BANK_INTERFACE_ID << 16) | BankMainChild.ITEMS;
        ctx.service.setWidgetFlags(
            player,
            bankContentWidgetUid,
            0,
            BankLimits.MAX_SLOTS - 1,
            BANK_CONTENT_FLAGS,
        );

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

        const bankSideWidgetUid = (BANK_SIDE_INTERFACE_ID << 16) | BANK_SIDE_ITEMS_COMPONENT;

        ctx.service.openInventorySidePanel(player, {
            interfaceId: BANK_SIDE_INTERFACE_ID,
            varps: bankData?.varps,
            varbits: bankData?.varbits,
            setFlags: {
                uid: bankSideWidgetUid,
                fromSlot: 0,
                toSlot: 27,
                flags: BANK_SIDE_FLAGS,
            },
        });

        const inventoryWidgetUid = INVENTORY_INTERFACE_ID << 16;
        ctx.service.runScript(player, SCRIPT_BANK_SIDE_INVENTORY_INIT, [
            inventoryWidgetUid,
            28,
            1,
            -1,
        ]);
    });

    interfaceService.onInterfaceClose(BANK_INTERFACE_ID, (player, ctx) => {
        ctx.service.restoreNormalInventory(player);
    });
}
