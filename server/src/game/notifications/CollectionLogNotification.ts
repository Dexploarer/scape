import { formatNotificationItemName } from "./ItemNotificationText";

export type CollectionLogNotification = {
    kind: "collection_log";
    title: string;
    message: string;
    itemId: number;
    quantity: number;
    durationMs: number;
};

export function createCollectionLogNotification(
    itemId: number,
    itemName: string,
): CollectionLogNotification {
    const safeName = formatNotificationItemName(itemId, itemName);
    return {
        kind: "collection_log",
        title: "Collection log",
        message: `New item:<br><br><col=ffffff>${safeName}</col>`,
        itemId,
        quantity: 1,
        durationMs: 3000,
    };
}

export function createCollectionLogChatMessage(itemId: number, itemName: string): string {
    const safeName = formatNotificationItemName(itemId, itemName);
    return `New item added to your collection log: <col=ef1020>${safeName}</col>`;
}
