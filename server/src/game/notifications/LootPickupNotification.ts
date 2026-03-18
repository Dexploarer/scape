import { formatNotificationStackLabel } from "./ItemNotificationText";

export type LootPickupNotification = {
    kind: "loot";
    title: string;
    message: string;
    itemId: number;
    quantity: number;
    durationMs: number;
};

export function createLootPickupNotification(
    itemId: number,
    itemName: string,
    quantity: number,
): LootPickupNotification {
    const label = formatNotificationStackLabel(itemId, itemName, quantity);
    return {
        kind: "loot",
        title: "Loot",
        message: `New item:<br><br><col=ffffff>${label}</col>`,
        itemId,
        quantity,
        durationMs: 3000,
    };
}
