// @ts-nocheck

/**
 * Tests for bank slot ordering - OSRS parity verification.
 *
 * OSRS stores bank items contiguously by tab:
 *   - Tab 1 items: slots 0 to (tab1_size - 1)
 *   - Tab 2 items: slots tab1_size to (tab1_size + tab2_size - 1)
 *   - ...
 *   - Tab 0 (untabbed): slots after all tabbed items
 *
 * Our server stores items in a flat array with `tab` property.
 * buildBankPayload() reorganizes items by tab when sending to client.
 * This test verifies that reorganization is correct.
 */
import assert from "assert";

import { BankingManager } from "../src/game/banking/BankingManager";
import { PlayerState } from "../src/game/player";

// Minimal services mock for BankingManager
function createBankingManagerMock() {
    const services = {
        getInventory: (player: PlayerState) => player.getInventoryEntries(),
        getEquipArray: (player: PlayerState) => player.getEquipmentArray?.() ?? [],
        getEquipQtyArray: (player: PlayerState) => player.getEquipmentQtyArray?.() ?? [],
        addItemToInventory: () => ({ slot: -1, added: 0 }),
        sendInventorySnapshot: () => {},
        sendAppearanceUpdate: () => {},
        refreshAppearance: () => {},
        refreshCombatWeapon: () => ({ categoryChanged: false, weaponItemChanged: false }),
        queueChatMessage: () => {},
        queueBankSnapshot: () => {},
        queueVarbit: () => {},
        queueCombatSnapshot: () => {},
        getObjType: () => undefined,
        logger: { info: () => {}, debug: () => {}, warn: () => {} },
    };
    return new BankingManager(services as any);
}

// Test: Items are reorganized by tab in payload
(function testBuildBankPayloadReorganizesByTab() {
    const manager = createBankingManagerMock();
    const player = new PlayerState(1, 3200, 3200, 0);
    player.setBankCapacity(20);

    // Set up bank with items in non-contiguous tab order
    // Server array: [tab0, tab2, tab1, tab1, tab0]
    player.loadBankSnapshot([
        { slot: 0, itemId: 100, quantity: 1, tab: 0 }, // untabbed
        { slot: 1, itemId: 200, quantity: 2, tab: 2 }, // tab 2
        { slot: 2, itemId: 300, quantity: 3, tab: 1 }, // tab 1
        { slot: 3, itemId: 400, quantity: 4, tab: 1 }, // tab 1
        { slot: 4, itemId: 500, quantity: 5, tab: 0 }, // untabbed
    ]);

    const payload = manager.buildBankPayload(player);
    assert.ok(payload, "payload should be defined");
    assert.strictEqual(payload.kind, "snapshot");

    // Expected order: Tab 1 items first (300, 400), then Tab 2 (200), then Tab 0 (100, 500)
    const itemSlots = payload.slots.filter((s: any) => s.itemId > 0);

    assert.strictEqual(itemSlots[0].slot, 0, "First slot should be 0");
    assert.strictEqual(itemSlots[0].itemId, 300, "First item should be tab 1 item (300)");
    assert.strictEqual(itemSlots[0].tab, 1);

    assert.strictEqual(itemSlots[1].slot, 1, "Second slot should be 1");
    assert.strictEqual(itemSlots[1].itemId, 400, "Second item should be tab 1 item (400)");
    assert.strictEqual(itemSlots[1].tab, 1);

    assert.strictEqual(itemSlots[2].slot, 2, "Third slot should be 2");
    assert.strictEqual(itemSlots[2].itemId, 200, "Third item should be tab 2 item (200)");
    assert.strictEqual(itemSlots[2].tab, 2);

    assert.strictEqual(itemSlots[3].slot, 3, "Fourth slot should be 3");
    assert.strictEqual(itemSlots[3].itemId, 100, "Fourth item should be tab 0 item (100)");
    assert.strictEqual(itemSlots[3].tab, 0);

    assert.strictEqual(itemSlots[4].slot, 4, "Fifth slot should be 4");
    assert.strictEqual(itemSlots[4].itemId, 500, "Fifth item should be tab 0 item (500)");
    assert.strictEqual(itemSlots[4].tab, 0);

    console.log("[PASS] testBuildBankPayloadReorganizesByTab");
})();

// Test: Slot mapping correctly translates client to server indices
(function testClientSlotToServerIndex() {
    const manager = createBankingManagerMock();
    const player = new PlayerState(2, 3200, 3200, 0);
    player.setBankCapacity(20);

    // Server array: [tab0@0, tab2@1, tab1@2, tab1@3, tab0@4]
    player.loadBankSnapshot([
        { slot: 0, itemId: 100, quantity: 1, tab: 0 },
        { slot: 1, itemId: 200, quantity: 2, tab: 2 },
        { slot: 2, itemId: 300, quantity: 3, tab: 1 },
        { slot: 3, itemId: 400, quantity: 4, tab: 1 },
        { slot: 4, itemId: 500, quantity: 5, tab: 0 },
    ]);

    // Client sees: [tab1@0, tab1@1, tab2@2, tab0@3, tab0@4]
    // Client slot 0 (item 300) -> server slot 2
    // Client slot 1 (item 400) -> server slot 3
    // Client slot 2 (item 200) -> server slot 1
    // Client slot 3 (item 100) -> server slot 0
    // Client slot 4 (item 500) -> server slot 4

    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 0),
        2,
        "Client slot 0 should map to server slot 2",
    );
    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 1),
        3,
        "Client slot 1 should map to server slot 3",
    );
    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 2),
        1,
        "Client slot 2 should map to server slot 1",
    );
    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 3),
        0,
        "Client slot 3 should map to server slot 0",
    );
    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 4),
        4,
        "Client slot 4 should map to server slot 4",
    );

    // Empty client slots should return -1
    assert.strictEqual(
        manager.clientSlotToServerIndex(player, 5),
        -1,
        "Client slot 5 (empty) should return -1",
    );

    console.log("[PASS] testClientSlotToServerIndex");
})();

// Test: getBankEntryAtClientSlot returns correct entry
(function testGetBankEntryAtClientSlot() {
    const manager = createBankingManagerMock();
    const player = new PlayerState(3, 3200, 3200, 0);
    player.setBankCapacity(20);

    player.loadBankSnapshot([
        { slot: 0, itemId: 100, quantity: 1, tab: 0 },
        { slot: 1, itemId: 200, quantity: 2, tab: 2 },
        { slot: 2, itemId: 300, quantity: 3, tab: 1 },
    ]);

    // Client slot 0 = tab 1 item (300)
    const entry0 = manager.getBankEntryAtClientSlot(player, 0);
    assert.ok(entry0, "Entry at client slot 0 should exist");
    assert.strictEqual(entry0.itemId, 300, "Client slot 0 should have item 300 (tab 1)");

    // Client slot 1 = tab 2 item (200)
    const entry1 = manager.getBankEntryAtClientSlot(player, 1);
    assert.ok(entry1, "Entry at client slot 1 should exist");
    assert.strictEqual(entry1.itemId, 200, "Client slot 1 should have item 200 (tab 2)");

    // Client slot 2 = tab 0 item (100)
    const entry2 = manager.getBankEntryAtClientSlot(player, 2);
    assert.ok(entry2, "Entry at client slot 2 should exist");
    assert.strictEqual(entry2.itemId, 100, "Client slot 2 should have item 100 (tab 0)");

    // Empty slot returns undefined
    const entry3 = manager.getBankEntryAtClientSlot(player, 3);
    assert.strictEqual(entry3, undefined, "Client slot 3 should be undefined (empty)");

    console.log("[PASS] testGetBankEntryAtClientSlot");
})();

// Test: Tab sizes match the reordered slot ranges
(function testTabSizesMatchSlotRanges() {
    const manager = createBankingManagerMock();
    const player = new PlayerState(4, 3200, 3200, 0);
    player.setBankCapacity(20);

    // Tab 1: 3 items, Tab 2: 2 items, Tab 3: 1 item, Tab 0: 2 items
    player.loadBankSnapshot([
        { slot: 0, itemId: 100, quantity: 1, tab: 1 },
        { slot: 1, itemId: 200, quantity: 1, tab: 1 },
        { slot: 2, itemId: 300, quantity: 1, tab: 1 },
        { slot: 3, itemId: 400, quantity: 1, tab: 2 },
        { slot: 4, itemId: 500, quantity: 1, tab: 2 },
        { slot: 5, itemId: 600, quantity: 1, tab: 3 },
        { slot: 6, itemId: 700, quantity: 1, tab: 0 },
        { slot: 7, itemId: 800, quantity: 1, tab: 0 },
    ]);

    const tabSizes = manager.calculateBankTabSizes(player);
    // tabSizes is [tab1_size, tab2_size, ..., tab9_size]
    assert.strictEqual(tabSizes[0], 3, "Tab 1 should have 3 items");
    assert.strictEqual(tabSizes[1], 2, "Tab 2 should have 2 items");
    assert.strictEqual(tabSizes[2], 1, "Tab 3 should have 1 item");
    for (let i = 3; i < 9; i++) {
        assert.strictEqual(tabSizes[i], 0, `Tab ${i + 1} should have 0 items`);
    }

    // Verify payload slots match expected ranges:
    // Tab 1: slots 0-2, Tab 2: slots 3-4, Tab 3: slot 5, Tab 0: slots 6-7
    const payload = manager.buildBankPayload(player);
    const itemSlots = payload.slots.filter((s: any) => s.itemId > 0);

    // Tab 1 items at slots 0, 1, 2
    assert.strictEqual(itemSlots[0].tab, 1);
    assert.strictEqual(itemSlots[1].tab, 1);
    assert.strictEqual(itemSlots[2].tab, 1);

    // Tab 2 items at slots 3, 4
    assert.strictEqual(itemSlots[3].tab, 2);
    assert.strictEqual(itemSlots[4].tab, 2);

    // Tab 3 item at slot 5
    assert.strictEqual(itemSlots[5].tab, 3);

    // Tab 0 items at slots 6, 7
    assert.strictEqual(itemSlots[6].tab, 0);
    assert.strictEqual(itemSlots[7].tab, 0);

    console.log("[PASS] testTabSizesMatchSlotRanges");
})();

console.log("\n=== All bank slot ordering tests passed ===");
