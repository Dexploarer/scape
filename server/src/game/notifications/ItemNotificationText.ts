export function formatNotificationItemName(itemId: number, itemName: string): string {
    const normalizedName = itemName.trim();
    return normalizedName.length > 0 ? normalizedName : `Item ${itemId}`;
}

export function formatNotificationStackLabel(
    itemId: number,
    itemName: string,
    quantity: number,
): string {
    const safeName = formatNotificationItemName(itemId, itemName);
    if (quantity <= 1) {
        return safeName;
    }
    return `${quantity} x ${safeName}`;
}
