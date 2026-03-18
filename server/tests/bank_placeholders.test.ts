// @ts-nocheck
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

(function testWithdrawLeavesPlaceholderWhenEnabled() {
    const server = createServerHarness();
    const player = new PlayerState(101, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 995, quantity: 500 }]);
    player.setBankPlaceholderMode(true);
    const res = (server as any).processBankWithdraw(player, 0, 500);
    assert.ok(res.ok, "withdraw should succeed");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.itemId, 995, "placeholder should keep item id");
    assert.strictEqual(bank[0]?.quantity, 0, "placeholder quantity should be zero");
    assert.strictEqual(bank[0]?.placeholder, true, "placeholder flag should be set");
})();

(function testReleasePlaceholdersClearsEmptySlots() {
    const player = new PlayerState(102, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 556, quantity: 0, placeholder: true }]);
    const cleared = player.releaseBankPlaceholders();
    assert.strictEqual(cleared, 1);
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.itemId, -1);
    assert.strictEqual(bank[0]?.placeholder, false);
})();

(function testBankMoveInsertModeShiftsSlots() {
    const server = createServerHarness();
    const player = new PlayerState(103, 3200, 3200, 0);
    player.loadBankSnapshot([
        { slot: 0, itemId: 556, quantity: 100 },
        { slot: 1, itemId: 557, quantity: 100 },
    ]);
    player.setBankInsertMode(true);
    const moved = (server as any).moveBankSlot(player, 0, 1, { insert: true });
    assert.ok(moved, "move should succeed");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[1]?.itemId, 556, "item should be inserted into target");
    assert.strictEqual(bank[0]?.itemId, 557, "previous target should shift left");
})();
