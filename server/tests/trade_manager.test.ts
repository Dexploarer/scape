import assert from "assert";

import { getItemDefinition } from "../src/data/items";
import { PlayerState } from "../src/game/player";
import { TradeManager } from "../src/game/trade/TradeManager";

type TestEvents = { [playerId: number]: import("../src/network/messages").TradeServerPayload[] };

function createTradeManagerHarness(players: PlayerState[]): {
    manager: TradeManager;
    events: TestEvents;
} {
    const events: TestEvents = {};
    const lookup = new Map<number, PlayerState>();
    for (const p of players) lookup.set(p.id, p);
    const manager = new TradeManager({
        getPlayerById: (id) => lookup.get(id),
        queueTradeMessage: (playerId, payload) => {
            const list = (events[playerId] = events[playerId] || []);
            list.push(payload);
        },
        queueInventorySnapshot: () => {},
        sendGameMessage: () => {},
        openTradeWidget: () => {},
        closeTradeWidget: () => {},
        getInventory: (player) => player.getInventoryEntries(),
        setInventorySlot: (player, slot, itemId, quantity) => {
            const inv = player.getInventoryEntries();
            inv[Math.max(0, Math.min(inv.length - 1, slot))] = {
                itemId: itemId,
                quantity: quantity,
            };
        },
        addItemToInventory: (player, itemId, qty) => {
            const inv = player.getInventoryEntries();
            const def = getItemDefinition(itemId);
            const stackable = !!def?.stackable;
            if (stackable) {
                const existing = inv.findIndex((slot) => slot.itemId === itemId);
                if (existing >= 0) {
                    inv[existing].quantity += qty;
                    return { slot: existing, added: qty };
                }
            }
            const empty = inv.findIndex((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (empty === -1) return { slot: -1, added: 0 };
            inv[empty].itemId = itemId;
            inv[empty].quantity = qty;
            return { slot: empty, added: qty };
        },
        getItemDefinition: (itemId) => getItemDefinition(itemId),
    });
    return { manager, events };
}

(function testTradeOfferMovesItems() {
    const playerA = new PlayerState(1, 3200, 3200, 0);
    const playerB = new PlayerState(2, 3201, 3200, 0);
    playerA.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 1000 }]);
    playerB.loadInventorySnapshot([{ slot: 0, itemId: 554, quantity: 50 }]);
    const { manager, events } = createTradeManagerHarness([playerA, playerB]);

    manager.requestTrade(playerA, playerB, 1);
    manager.requestTrade(playerB, playerA, 2);

    manager.handleAction(playerA, { action: "offer", slot: 0, quantity: 200, itemId: 995 }, 3);

    assert.strictEqual(
        playerA.getInventoryEntries()[0]?.quantity,
        800,
        "Coins should be removed from inventory",
    );
    const payloads = events[playerA.id] ?? [];
    const last = payloads[payloads.length - 1];
    assert.ok(last && last.kind === "update", "Trade update should be queued");
    assert.strictEqual(last.self?.offers?.[0]?.quantity, 200);
})();

(function testTradeFinalizeSwapsItems() {
    const playerA = new PlayerState(11, 3200, 3200, 0);
    const playerB = new PlayerState(22, 3201, 3200, 0);
    playerA.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 500 }]);
    playerB.loadInventorySnapshot([{ slot: 0, itemId: 556, quantity: 75 }]);
    const { manager, events } = createTradeManagerHarness([playerA, playerB]);

    manager.requestTrade(playerA, playerB, 5);
    manager.requestTrade(playerB, playerA, 6);

    manager.handleAction(playerA, { action: "offer", slot: 0, quantity: 200 }, 7);
    manager.handleAction(playerB, { action: "offer", slot: 0, quantity: 50 }, 8);

    manager.handleAction(playerA, { action: "accept" }, 9);
    manager.handleAction(playerB, { action: "accept" }, 10);
    manager.handleAction(playerA, { action: "confirm_accept" }, 11);
    manager.handleAction(playerB, { action: "confirm_accept" }, 12);

    assert.strictEqual(playerA.getInventoryEntries()[0]?.quantity, 300);
    const bCoins = playerB.getInventoryEntries().find((slot) => slot.itemId === 995)?.quantity;
    assert.strictEqual(bCoins, 200, "Other player should receive coins");
    const aRunes = playerA
        .getInventoryEntries()
        .filter((slot) => slot.itemId === 556)
        .reduce((sum, slot) => sum + slot.quantity, 0);
    assert.strictEqual(aRunes, 50, "Player A should receive runes");
    const lastEvent = (events[playerA.id] || []).find((evt) => evt.kind === "close");
    assert.ok(lastEvent, "Trade close payload should be emitted");
})();
