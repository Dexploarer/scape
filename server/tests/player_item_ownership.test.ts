import assert from "assert";

import { findOwnedItemLocation } from "../src/game/items/playerItemOwnership";

function testFindOwnedItemLocation(): void {
    const inventoryFirst = findOwnedItemLocation(25110, {
        inventory: [{ itemId: 25110, quantity: 1 }],
        equipment: [25110],
        bank: [{ itemId: 25110, quantity: 1 }],
    });
    assert.strictEqual(
        inventoryFirst,
        "inventory",
        "inventory should take precedence for duplicate-protection messaging",
    );

    const equipped = findOwnedItemLocation(25110, {
        inventory: [{ itemId: 1511, quantity: 1 }],
        equipment: [-1, -1, -1, 25110],
        bank: [{ itemId: 25110, quantity: 1 }],
    });
    assert.strictEqual(equipped, "equipment", "equipped item should be detected");

    const banked = findOwnedItemLocation(25110, {
        inventory: [{ itemId: 1511, quantity: 1 }],
        equipment: [-1, -1, -1, -1],
        bank: [{ itemId: 25110, quantity: 1 }],
    });
    assert.strictEqual(banked, "bank", "banked item should be detected");

    const placeholderOnly = findOwnedItemLocation(25110, {
        bank: [{ itemId: 25110, quantity: 0 }],
    });
    assert.strictEqual(
        placeholderOnly,
        undefined,
        "bank placeholders (quantity 0) should not count as owned items",
    );

    const missing = findOwnedItemLocation(25110, {
        inventory: [{ itemId: 1511, quantity: 1 }],
        equipment: [-1, -1, -1, -1],
        bank: [{ itemId: 1511, quantity: 999 }],
    });
    assert.strictEqual(missing, undefined, "missing item should return undefined");
}

testFindOwnedItemLocation();

console.log("Player item ownership tests passed.");
