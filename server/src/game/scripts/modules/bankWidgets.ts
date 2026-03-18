import { BankMainChild, BankVarbit, WidgetGroup } from "../../../constants/bank";
import { type PlayerState } from "../../player";
import { type ScriptModule, type WidgetActionEvent } from "../types";

const BANK_GROUP_ID = WidgetGroup.BANK_MAIN;
const widgetId = (childId: number) => ((BANK_GROUP_ID & 0xffff) << 16) | (childId & 0xffff);

const BANK_WIDGET_ITEMS = widgetId(BankMainChild.ITEMS);
const BANK_WIDGET_DEPOSIT_INV = widgetId(BankMainChild.DEPOSIT_INVENTORY);
const BANK_WIDGET_DEPOSIT_WORN = widgetId(BankMainChild.DEPOSIT_WORN);
const BANK_FILLER_ITEM_ID = 20594; // Runelite: ItemID.BANK_FILLER

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
            return Math.min(total, Math.max(1, desired));
        }
        case 4:
            return total;
        default:
            return total > 0 ? 1 : 0;
    }
};

const quantityForWithdrawOp = (player: PlayerState, opId: number, available: number): number => {
    const total = Math.max(0, available);
    const requested = requestedQuantityOrZero(player);
    switch (opId) {
        case 1:
            return quantityForDefaultMode(player, total);
        case 2:
            return total > 0 ? 1 : 0;
        case 3:
            return Math.min(5, Math.max(1, total));
        case 4:
            return Math.min(10, Math.max(1, total));
        case 5:
        case 6:
            return requested > 0 ? Math.min(total, requested) : 0;
        case 7:
            return total;
        case 8:
            return total > 0 ? Math.max(0, total - 1) : 0;
        default:
            return 0;
    }
};

const handleWithdrawOp = (event: WidgetActionEvent, opId: number): void => {
    if (event.groupId !== BANK_GROUP_ID) return;
    if (event.slot === undefined) return;

    const { player, services } = event;

    // OSRS PARITY: Use getBankEntryAtClientSlot to translate client slot to server entry.
    // Client sees items reorganized by tab (tabs 1-9 first, then tab 0).
    const entry = services.getBankEntryAtClientSlot(player, event.slot);
    if (!entry || entry.itemId <= 0 || entry.quantity <= 0) return;

    // OSRS parity/safety: client supplies itemId with widget ops; validate it matches the current slot.
    // This avoids desync edge cases where UI mapping differs from server state.
    if (event.itemId !== undefined && event.itemId > 0 && event.itemId !== entry.itemId) {
        services.logger?.debug?.(
            `[script:bank-widgets] withdraw ignored (item mismatch) player=${player.id} slot=${event.slot} clientItem=${event.itemId} serverItem=${entry.itemId}`,
        );
        return;
    }

    const quantity = quantityForWithdrawOp(player, opId, entry.quantity);
    if (!(quantity > 0)) return;

    const noted = player.getBankWithdrawNotes?.() ?? false;
    const result = services.withdrawFromBankSlot(player, event.slot, quantity, { noted });
    if (!result.ok && result.message) {
        services.sendGameMessage(player, result.message);
    }
};

export const bankWidgetActionsModule: ScriptModule = {
    id: "content.bank-widgets",
    register(registry) {
        const guard = (
            option: string,
            handler: (args: { player: any; services: any; event: any }) => void,
        ) =>
            registry.registerWidgetAction({
                option,
                handler: (event) => {
                    if (event.groupId !== BANK_GROUP_ID) return;
                    handler({ player: event.player, services: event.services, event });
                },
            });

        registry.registerWidgetAction({
            widgetId: BANK_WIDGET_DEPOSIT_INV,
            handler: ({ player, services, groupId }) => {
                if (groupId !== BANK_GROUP_ID) return;
                const moved = services.depositInventoryToBank(player);
                services.logger?.debug?.(
                    `[script:bank-widgets] deposit inventory player=${player.id} moved=${moved}`,
                );
            },
        });

        registry.registerWidgetAction({
            widgetId: BANK_WIDGET_DEPOSIT_WORN,
            handler: ({ player, services, groupId }) => {
                if (groupId !== BANK_GROUP_ID) return;
                const moved = services.depositEquipmentToBank(player);
                services.logger?.debug?.(
                    `[script:bank-widgets] deposit equipment player=${player.id} moved=${moved}`,
                );
            },
        });

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.SWAP_INSERT_BUTTON,
            ({ player, services }) => {
                const next = !(player.getBankInsertMode?.() ?? false);
                player.setBankInsertMode(next);
                services.sendVarbit?.(player, BankVarbit.INSERT_MODE, next ? 1 : 0);
                services.logger?.debug?.(
                    `[script:bank-widgets] insert mode=${next} player=${player.id}`,
                );
            },
        );

        registry.onButton(BANK_GROUP_ID, BankMainChild.NOTE_BUTTON, ({ player, services }) => {
            const next = !(player.getBankWithdrawNotes?.() ?? false);
            player.setBankWithdrawNotes(next);
            services.sendVarbit?.(player, BankVarbit.WITHDRAW_NOTES, next ? 1 : 0);
            services.logger?.debug?.(
                `[script:bank-widgets] withdraw notes=${next} player=${player.id}`,
            );
        });

        const setQuantityMode = (player: PlayerState, services: any, mode: number) => {
            player.setBankQuantityMode(mode);
            services.sendVarbit?.(player, BankVarbit.QUANTITY_TYPE, mode);
            services.logger?.debug?.(
                `[script:bank-widgets] quantity mode=${mode} player=${player.id}`,
            );
        };

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.QUANTITY_ONE_BUTTON,
            ({ player, services }) => {
                setQuantityMode(player, services, 0);
            },
        );

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.QUANTITY_FIVE_BUTTON,
            ({ player, services }) => {
                setQuantityMode(player, services, 1);
            },
        );

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.QUANTITY_TEN_BUTTON,
            ({ player, services }) => {
                setQuantityMode(player, services, 2);
            },
        );

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.QUANTITY_X_BUTTON,
            ({ player, services }) => {
                setQuantityMode(player, services, 3);
            },
        );

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.QUANTITY_ALL_BUTTON,
            ({ player, services }) => {
                setQuantityMode(player, services, 4);
            },
        );

        registry.onButton(
            BANK_GROUP_ID,
            BankMainChild.PLACEHOLDER_BUTTON,
            ({ player, services }) => {
                const next = !(player.getBankPlaceholderMode?.() ?? false);
                player.setBankPlaceholderMode?.(next);
                services.sendVarbit?.(player, BankVarbit.LEAVE_PLACEHOLDERS, next ? 1 : 0);
                services.logger?.debug?.(
                    `[script:bank-widgets] placeholders=${next} player=${player.id}`,
                );
            },
        );

        guard("Placeholders", ({ player, services }) => {
            const next = !(player.getBankPlaceholderMode?.() ?? false);
            player.setBankPlaceholderMode?.(next);
            services.sendVarbit?.(player, BankVarbit.LEAVE_PLACEHOLDERS, next ? 1 : 0);
            services.logger?.debug?.(
                `[script:bank-widgets] placeholders=${next} player=${player.id}`,
            );
        });

        guard("Release placeholders", ({ player, services }) => {
            const cleared = player.releaseBankPlaceholders?.() ?? 0;
            services.logger?.debug?.(
                `[script:bank-widgets] release placeholders player=${player.id} cleared=${cleared}`,
            );
            if (cleared > 0) {
                services.queueBankSnapshot(player);
                // Update tab varbits - releasing placeholders may empty tabs and cause them to hide
                services.sendBankTabVarbits(player);
            }
        });

        guard("Search", ({ services }) => {
            services.logger?.debug?.("[script:bank-widgets] toggled search");
        });

        registry.onButton(BANK_GROUP_ID, BankMainChild.SEARCH, ({ services }) => {
            services.logger?.debug?.("[script:bank-widgets] toggled search");
        });

        // Close button handler (component 2 of interface 12)
        // Uses onButton since option names aren't sent to server - only component IDs
        // This triggers closeModal which fires onInterfaceClose hook -> restoreNormalInventory
        registry.onButton(BANK_GROUP_ID, BankMainChild.CLOSE_BUTTON, ({ player, services }) => {
            services.logger?.debug?.(`[script:bank-widgets] close button player=${player.id}`);
            // closeModal triggers the onInterfaceClose hook which calls restoreNormalInventory
            services.closeModal?.(player);
        });

        guard("Fillers", ({ player, services }) => {
            if (!player?.getBankEntries) return;
            const bank = player.getBankEntries();
            let filled = 0;
            for (const entry of bank) {
                if (!entry) continue;
                if (entry.itemId <= 0 && !entry.filler) {
                    entry.itemId = BANK_FILLER_ITEM_ID;
                    entry.quantity = 0;
                    entry.placeholder = false;
                    entry.filler = true;
                    filled++;
                }
            }
            if (filled > 0) {
                services.queueBankSnapshot(player);
                services.logger?.debug?.(
                    `[script:bank-widgets] fillers enabled player=${player.id} count=${filled}`,
                );
            }
        });

        guard("Release fillers", ({ player, services }) => {
            if (!player?.getBankEntries) return;
            const bank = player.getBankEntries();
            let cleared = 0;
            for (const entry of bank) {
                if (!entry) continue;
                if (entry.filler) {
                    entry.itemId = -1;
                    entry.quantity = 0;
                    entry.placeholder = false;
                    entry.filler = false;
                    cleared++;
                }
            }
            if (cleared > 0) {
                services.queueBankSnapshot(player);
                services.logger?.debug?.(
                    `[script:bank-widgets] fillers released player=${player.id} cleared=${cleared}`,
                );
            }
        });

        for (const opId of [1, 2, 3, 4, 5, 6, 7, 8]) {
            registry.registerWidgetAction({
                widgetId: BANK_WIDGET_ITEMS,
                opId,
                handler: (event) => handleWithdrawOp(event, opId),
            });
        }

        guard("Withdraw-1", ({ event }) => handleWithdrawOp(event, 2));

        for (const [option, opId] of Object.entries({
            "Withdraw-5": 3,
            "Withdraw-10": 4,
            "Withdraw-X": 6,
            "Withdraw-All": 7,
            "Withdraw-All-but-1": 8,
        })) {
            guard(option, ({ event }) => handleWithdrawOp(event, opId));
        }
    },
};
