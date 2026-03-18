// @ts-nocheck
import assert from "assert";

import { PlayerState } from "../src/game/player";
import { WSServer } from "../src/network/wsServer";

function createServerHarness() {
    const server = Object.create(WSServer.prototype) as WSServer & {
        players?: any;
        queueBankSnapshot: (player: PlayerState) => void;
        sendInventorySnapshot: (ws: any, player: PlayerState) => void;
        sendAppearanceUpdate?: (ws: any, player: PlayerState) => void;
        refreshAppearanceKits?: (player: PlayerState) => void;
        refreshCombatWeaponCategory?: (player: PlayerState) => {
            categoryChanged: boolean;
            weaponItemChanged: boolean;
        };
    };
    server.players = {
        getSocketByPlayerId: () => undefined,
    } as any;
    server.queueBankSnapshot = () => {};
    server.sendInventorySnapshot = () => {};
    server.sendAppearanceUpdate = () => {};
    server.refreshAppearanceKits = () => {};
    server.refreshCombatWeaponCategory = () => ({
        categoryChanged: false,
        weaponItemChanged: false,
    });
    return server;
}

(function testDepositInventorySetsSelectedTab() {
    const server = createServerHarness();
    const player = new PlayerState(201, 3200, 3200, 0);
    player.setBankCapacity(10);
    const inv = player.getInventoryEntries();
    inv[0].itemId = 556; // Air rune
    inv[0].quantity = 50;
    const moved = (server as any).processBankDepositInventory(player, undefined, 3);
    assert.ok(moved, "deposit should succeed");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.itemId, 556);
    assert.strictEqual(bank[0]?.quantity, 50);
    assert.strictEqual(bank[0]?.tab, 3, "deposit should honor selected tab");
})();

(function testDepositItemRespectsTab() {
    const server = createServerHarness();
    const player = new PlayerState(202, 3200, 3200, 0);
    player.setBankCapacity(10);
    const inv = player.getInventoryEntries();
    inv[0].itemId = 995; // coins
    inv[0].quantity = 1000;
    const res = (server as any).processBankDepositItem(player, 0, 500, undefined, undefined, 4);
    assert.ok(res.ok, "deposit item should succeed");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.itemId, 995);
    assert.strictEqual(bank[0]?.quantity, 500);
    assert.strictEqual(bank[0]?.tab, 4, "deposit item should set requested tab");
})();

(function testMoveBankSlotRetagsTabInPlace() {
    const server = createServerHarness();
    const player = new PlayerState(203, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 562, quantity: 25, tab: 1 }]);
    const moved = (server as any).moveBankSlot(player, 0, 0, { tab: 2 });
    assert.ok(moved, "move should return true");
    const bank = player.getBankEntries();
    assert.strictEqual(bank[0]?.tab, 2, "tab should update even when slot does not change");
})();
