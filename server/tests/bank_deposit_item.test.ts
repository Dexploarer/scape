import assert from "assert";

import { PlayerState } from "../src/game/player";
import { WSServer } from "../src/network/wsServer";

function createServerHarness() {
    const server = Object.create(WSServer.prototype) as WSServer & {
        players?: any;
        queueBankSnapshot: (player: PlayerState) => void;
        sendInventorySnapshot: (ws: any, player: PlayerState) => void;
    };
    server.players = {
        getSocketByPlayerId: () => undefined,
    } as any;
    server.queueBankSnapshot = () => {};
    server.sendInventorySnapshot = () => {};
    return server;
}

(function testDepositMovesRequestedQuantity() {
    const server = createServerHarness();
    const player = new PlayerState(1, 3200, 3200, 0);
    player.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 100 }]);
    const result = (server as any).processBankDepositItem(player, 0, 40);
    assert.ok(result.ok, "deposit should succeed");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.itemId, 995);
    assert.strictEqual(bank[0]?.quantity, 40);
    const inv = player.getInventoryEntries();
    assert.strictEqual(inv[0]?.quantity, 60);
})();

(function testDepositFailsWhenBankFull() {
    const server = createServerHarness();
    const player = new PlayerState(2, 3200, 3200, 0);
    player.setBankCapacity(1);
    player.loadBankSnapshot([{ slot: 0, itemId: 556, quantity: 500 }], 1);
    player.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 10 }]);
    const result = (server as any).processBankDepositItem(player, 0, 5);
    assert.strictEqual(result.ok, false, "deposit should fail when bank is full");
    assert.strictEqual(result.message, "Your bank is full.");
    const inv = player.getInventoryEntries();
    assert.strictEqual(inv[0]?.quantity, 10, "inventory should remain unchanged");
})();

(function testDepositRejectsMismatchedItem() {
    const server = createServerHarness();
    const player = new PlayerState(3, 3200, 3200, 0);
    player.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 10 }]);
    const result = (server as any).processBankDepositItem(player, 0, 5, undefined, 561);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.message, "That item is no longer in your inventory.");
})();
