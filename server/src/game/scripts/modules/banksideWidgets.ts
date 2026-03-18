import { BankSideChild, WidgetGroup } from "../../../constants/bank";
import type { PlayerState } from "../../player";
import { type ScriptModule, type WidgetActionEvent } from "../types";

const BANKSIDE_GROUP_ID = WidgetGroup.BANK_SIDE;
const widgetId = (childId: number) => ((BANKSIDE_GROUP_ID & 0xffff) << 16) | (childId & 0xffff);

// Current cache parity: bankside item grid is group 15 child 3.
const BANKSIDE_ITEMS = widgetId(BankSideChild.ITEMS);

const requestedQuantityOrZero = (player: PlayerState): number => {
    const requested = Math.trunc(player.getBankCustomQuantity());
    return requested > 0 ? requested : 0;
};

const quantityForDefaultMode = (player: PlayerState, available: number): number => {
    const total = Math.max(0, available);
    switch (player.getBankQuantityMode()) {
        case 0:
            return total > 0 ? 1 : 0;
        case 1:
            return Math.min(5, Math.max(1, total));
        case 2:
            return Math.min(10, Math.max(1, total));
        case 3: {
            const desired = Math.max(1, requestedQuantityOrZero(player));
            return Math.min(total, desired);
        }
        case 4:
            return total;
        default:
            return total > 0 ? 1 : 0;
    }
};

const quantityForDepositOp = (player: PlayerState, opId: number, available: number): number => {
    const total = Math.max(0, available);
    const requested = requestedQuantityOrZero(player);
    switch (opId) {
        case 2:
            return quantityForDefaultMode(player, total);
        case 3:
            return total > 0 ? 1 : 0;
        case 4:
            return Math.min(5, Math.max(1, total));
        case 5:
            return Math.min(10, Math.max(1, total));
        case 6:
        case 7:
            return requested > 0 ? Math.min(total, requested) : 0;
        case 8:
            return total;
        default:
            return 0;
    }
};

export const banksideWidgetActionsModule: ScriptModule = {
    id: "content.bankside-widgets",
    register(registry) {
        const handleDeposit = (event: WidgetActionEvent) => {
            if (event.groupId !== BANKSIDE_GROUP_ID) return;
            if (event.widgetId !== BANKSIDE_ITEMS) return;

            const slot = event.slot;
            if (slot === undefined || slot < 0) return;

            const inv = event.player.getInventoryEntries();
            const entry = inv[slot];
            const available = entry && entry.quantity > 0 ? entry.quantity : 0;
            if (available <= 0) return;

            const opId = event.opId;
            const desired =
                opId !== undefined ? quantityForDepositOp(event.player, opId, available) : 0;

            if (!desired || desired <= 0) return;

            const result = event.services?.depositInventoryItemToBank?.(
                event.player,
                slot,
                desired,
                {
                    itemIdHint: event.itemId,
                },
            );

            if (result && result.ok === false && result.message) {
                event.services.sendGameMessage(event.player, String(result.message));
            }
        };

        for (const opId of [2, 3, 4, 5, 6, 7, 8]) {
            registry.registerWidgetAction({
                widgetId: BANKSIDE_ITEMS,
                opId,
                handler: handleDeposit,
            });
        }
    },
};
