import assert from "assert";

import { shopInteractionsModule } from "../src/game/scripts/modules/shops";
import { ShopManager } from "../src/game/shops/ShopManager";

(function testVarrockShopAssistantOpensGeneralStore() {
    const manager = new ShopManager({
        getObjType: () => ({ isTradable: true }),
        addItemToInventory: () => ({ slot: 0, added: 1 }),
        snapshotInventory: () => {},
        sendGameMessage: () => {},
    });
    const player: any = {
        id: 42,
        activeShopId: undefined as string | undefined,
        setActiveShopId(shopId?: string) {
            this.activeShopId = shopId;
        },
        getShopBuyMode: () => 0,
        getShopSellMode: () => 0,
    };

    const snapshot = manager.openShopForNpc(player, 2816);
    assert.ok(snapshot, "Varrock shop assistant should have a shop snapshot");
    assert.strictEqual(snapshot?.shopId, "varrock_general_store");
    assert.ok((snapshot?.stock?.length ?? 0) > 0, "shop should expose stock items");
    assert.strictEqual(player.activeShopId, "varrock_general_store");
})();

(function testTradeActionInvokesOpenShopService() {
    let tradeHandler: ((event: any) => void) | undefined;
    const registry = {
        registerNpcAction(option: string, handler: (event: any) => void) {
            if (option === "trade") tradeHandler = handler;
            return { unregister() {} };
        },
    } as any;

    const calls: Array<{ npcTypeId?: number }> = [];
    const services = {
        openShop: (_player: any, opts?: { npcTypeId?: number }) => {
            calls.push({ npcTypeId: opts?.npcTypeId });
        },
        sendGameMessage: () => {},
        logger: { warn: () => {} },
    } as any;

    shopInteractionsModule.register(registry, services);
    assert.ok(tradeHandler, "trade handler should be registered");

    tradeHandler?.({
        tick: 0,
        player: { id: 1 },
        npc: { typeId: 2816 },
        option: "Trade",
        services,
    });

    assert.strictEqual(calls.length, 1, "trade action should invoke openShop once");
    assert.strictEqual(calls[0]?.npcTypeId, 2816);
})();
