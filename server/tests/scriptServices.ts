import type { ScriptServices } from "../src/game/scripts/types";

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

export function createTestScriptServices(): ScriptServices {
    return {
        consumeItem: () => false,
        getInventoryItems: () => [],
        sendGameMessage: () => {},
        snapshotInventory: () => {},
        snapshotInventoryImmediate: () => {},
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        setInventorySlot: () => {},
        openBank: () => {},
        depositInventoryToBank: () => false,
        depositEquipmentToBank: () => false,
        withdrawFromBankSlot: () => ({ ok: false, message: "unimplemented" }),
        getBankEntryAtClientSlot: (player, clientSlot) => {
            const bank = player.getBankEntries();
            const entry = bank[clientSlot];
            if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
                return undefined;
            }
            return {
                itemId: entry.itemId,
                quantity: entry.quantity,
                tab: entry.tab,
            };
        },
        queueBankSnapshot: () => {},
        sendBankTabVarbits: () => {},
        requestAction: () => ({ ok: false, reason: "unimplemented" }),
        logger: silentLogger,
    };
}
