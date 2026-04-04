export type ShopStockDefinition = {
    itemId: number;
    quantity: number;
    price?: number;
    restockAmount?: number;
    restockTicks?: number;
};

export type ShopDefinition = {
    id: string;
    name: string;
    npcIds: number[];
    currencyItemId?: number;
    capacity?: number;
    buyPriceMultiplier?: number;
    sellPriceMultiplier?: number;
    restockTicks?: number;
    generalStore?: boolean;
    stock: ShopStockDefinition[];
};
