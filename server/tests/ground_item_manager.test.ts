import assert from "assert";

import { getItemDefinition } from "../src/data/items";
import {
    GROUND_ITEM_PRIVATE_TICKS,
    GROUND_ITEM_TRADEABLE_TOTAL_TICKS,
    GroundItemManager,
    type GroundItemStack,
} from "../src/game/items/GroundItemManager";

// Ensure items are loaded
try {
    getItemDefinition(1);
} catch (e) {
    console.warn("Failed to load items.json, test might fail if env is not setup.");
}

export function testGroundItemTimers() {
    console.log("Running GroundItemManager Timer Tests...");

    // OSRS timings (docs/ground-items.md):
    // - 60s private (100 ticks)
    // - Tradeable: 180s total (300 ticks)
    // - Untradeable: 180s total (300 ticks)
    const manager = new GroundItemManager();

    const tile = { x: 3200, y: 3200, level: 0 };
    const ownerId = 1;
    const otherId = 2;
    let currentTick = 0;

    // 1. Spawn item (ID 1, Qty 1)
    // We need a valid item ID. 1 is usually valid.
    let itemId = 1;
    if (!getItemDefinition(itemId)) {
        // Try a few common ones if 1 is missing
        const alternates = [4151, 11802, 995];
        for (const id of alternates) {
            if (getItemDefinition(id)) {
                itemId = id;
                break;
            }
        }
    }

    if (!getItemDefinition(itemId)) {
        console.warn("Skipping GroundItem test: No valid item definition found.");
        return;
    }

    const stack = manager.spawn(itemId, 1, tile, currentTick, { ownerId });

    if (!stack) {
        throw new Error("Failed to spawn ground item stack");
    }

    console.log(
        `Spawned item ${itemId} at tick ${currentTick}. Private until ${stack.privateUntilTick}, expires ${stack.expiresTick}`,
    );

    // 2. Check Initial Visibility
    // Owner should see it
    let visibleToOwner = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, ownerId);
    assert.ok(
        visibleToOwner.find((s) => s.id === stack.id),
        "Owner should see private item",
    );

    // Other should NOT see it
    let visibleToOther = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, otherId);
    assert.strictEqual(
        visibleToOther.find((s) => s.id === stack.id),
        undefined,
        "Other should NOT see private item",
    );

    // 3. Advance to Private Expiry
    // OSRS: privateTicks = 100. created at 0. privateUntilTick = 100.
    // Logic: if (privateUntilTick > currentTick) continue;
    // So at 99: 100 > 99 (True) -> Hidden.
    // At 100: 100 > 100 (False) -> Visible.

    currentTick = GROUND_ITEM_PRIVATE_TICKS - 1; // 99
    visibleToOther = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, otherId);
    assert.strictEqual(
        visibleToOther.find((s) => s.id === stack.id),
        undefined,
        `Other should NOT see private item at tick ${currentTick}`,
    );

    currentTick = GROUND_ITEM_PRIVATE_TICKS; // 100
    visibleToOther = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, otherId);
    assert.ok(
        visibleToOther.find((s) => s.id === stack.id),
        `Other SHOULD see public item at tick ${currentTick}`,
    );

    // 4. Advance to Despawn
    // OSRS: Tradeable items despawn after 300 ticks (180 seconds)
    // expiresTick = 300. tick() checks: if (stack.expiresTick <= currentTick) remove.

    currentTick = GROUND_ITEM_TRADEABLE_TOTAL_TICKS - 1; // 299
    manager.tick(currentTick);
    let allStacks = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, ownerId);
    assert.ok(
        allStacks.find((s) => s.id === stack.id),
        `Item should exist at tick ${currentTick}`,
    );

    currentTick = GROUND_ITEM_TRADEABLE_TOTAL_TICKS; // 300
    manager.tick(currentTick);
    allStacks = manager.queryArea(tile.x, tile.y, tile.level, 10, currentTick, ownerId);
    assert.strictEqual(
        allStacks.find((s) => s.id === stack.id),
        undefined,
        `Item should despawn at tick ${currentTick}`,
    );

    console.log("GroundItemManager Timer tests passed.");
}

export function testGroundItemStackLimit() {
    console.log("Running GroundItemManager Stack Limit Tests...");

    const manager = new GroundItemManager();
    const tile = { x: 3200, y: 3200, level: 0 };
    const currentTick = 0;

    // OSRS: Max 128 unique item stacks per tile
    // Spawn 128 different items (non-stackable to create individual stacks)
    let spawned = 0;
    for (let i = 1; i <= 200; i++) {
        const def = getItemDefinition(i);
        if (!def) continue;
        // Skip stackable items to ensure each creates a separate stack
        if (def.stackable) continue;

        const stack = manager.spawn(i, 1, tile, currentTick, { ownerId: 1 });
        if (stack) {
            spawned++;
        }
        if (spawned >= 128) break;
    }

    // If we couldn't get 128 different items, skip the test
    if (spawned < 128) {
        console.warn(`Skipping stack limit test: Only found ${spawned} non-stackable items`);
        return;
    }

    // Now try to add item 129 - should fail
    let extraItem: GroundItemStack | undefined;
    for (let i = 201; i <= 1000; i++) {
        const def = getItemDefinition(i);
        if (!def || def.stackable) continue;
        extraItem = manager.spawn(i, 1, tile, currentTick, { ownerId: 1 });
        break;
    }

    assert.strictEqual(extraItem, undefined, "Should not be able to add 129th item stack to tile");

    console.log("GroundItemManager Stack Limit tests passed.");
}

export function testGroundItemMonsterDrop() {
    console.log("Running GroundItemManager Monster Drop Tests...");

    const manager = new GroundItemManager();
    const tile = { x: 3200, y: 3200, level: 0 };
    const currentTick = 0;

    // Find a valid item
    let itemId = 1;
    if (!getItemDefinition(itemId)) {
        const alternates = [4151, 11802, 995];
        for (const id of alternates) {
            if (getItemDefinition(id)) {
                itemId = id;
                break;
            }
        }
    }

    if (!getItemDefinition(itemId)) {
        console.warn("Skipping Monster Drop test: No valid item definition found.");
        return;
    }

    // Spawn monster drop - should use 200 tick duration
    const stack = manager.spawn(itemId, 1, tile, currentTick, {
        ownerId: 1,
        isMonsterDrop: true,
    });

    assert.ok(stack, "Should spawn monster drop");
    assert.strictEqual(stack!.expiresTick, 200, "Monster drop should expire at 200 ticks");
    assert.strictEqual(
        stack!.privateUntilTick,
        100,
        "Monster drop should be private for 100 ticks",
    );

    console.log("GroundItemManager Monster Drop tests passed.");
}

export function testGroundItemWilderness() {
    console.log("Running GroundItemManager Wilderness Tests...");

    const manager = new GroundItemManager();
    const tile = { x: 3200, y: 3200, level: 0 };
    const currentTick = 0;

    // Find a valid item
    let itemId = 1;
    if (!getItemDefinition(itemId)) {
        const alternates = [4151, 11802, 995];
        for (const id of alternates) {
            if (getItemDefinition(id)) {
                itemId = id;
                break;
            }
        }
    }

    if (!getItemDefinition(itemId)) {
        console.warn("Skipping Wilderness test: No valid item definition found.");
        return;
    }

    // Test wilderness non-consumable - immediate visibility
    const wildStack = manager.spawn(itemId, 1, tile, currentTick, {
        ownerId: 1,
        isWilderness: true,
        isConsumable: false,
    });

    assert.ok(wildStack, "Should spawn wilderness item");
    assert.strictEqual(
        wildStack!.privateUntilTick,
        undefined,
        "Wilderness non-consumable should be immediately visible (no private tick)",
    );

    // Test wilderness consumable - fast despawn
    const consumableTile = { x: 3201, y: 3200, level: 0 };
    const consumableStack = manager.spawn(itemId, 1, consumableTile, currentTick, {
        ownerId: 1,
        isWilderness: true,
        isConsumable: true,
    });

    assert.ok(consumableStack, "Should spawn wilderness consumable");
    assert.strictEqual(
        consumableStack!.expiresTick,
        25,
        "Wilderness consumable should expire at 25 ticks (15 seconds)",
    );

    console.log("GroundItemManager Wilderness tests passed.");
}

export function testPrivateStackableOwnershipIsolation() {
    console.log("Running GroundItemManager Private Stackable Ownership Tests...");

    const manager = new GroundItemManager();
    const tile = { x: 3200, y: 3200, level: 0 };
    const currentTick = 0;
    const itemId = 995; // Coins

    const first = manager.spawn(itemId, 10, tile, currentTick, { ownerId: 1 });
    const second = manager.spawn(itemId, 20, tile, currentTick, { ownerId: 2 });

    assert.ok(first, "First private stackable drop should spawn");
    assert.ok(second, "Second private stackable drop should spawn");
    assert.notStrictEqual(
        first!.id,
        second!.id,
        "Private stackable drops for different owners must not merge",
    );

    const ownerOneView = manager.queryArea(tile.x, tile.y, tile.level, 0, currentTick, 1);
    const ownerTwoView = manager.queryArea(tile.x, tile.y, tile.level, 0, currentTick, 2);
    const otherView = manager.queryArea(tile.x, tile.y, tile.level, 0, currentTick, 3);

    assert.strictEqual(ownerOneView.length, 1, "Owner one should only see their own private stack");
    assert.strictEqual(ownerOneView[0].quantity, 10, "Owner one stack quantity should stay intact");
    assert.strictEqual(ownerTwoView.length, 1, "Owner two should only see their own private stack");
    assert.strictEqual(ownerTwoView[0].quantity, 20, "Owner two stack quantity should stay intact");
    assert.strictEqual(otherView.length, 0, "Other players must not see either private stack");

    console.log("GroundItemManager Private Stackable Ownership tests passed.");
}

export function testPublicStackableMergeAfterPrivacyExpires() {
    console.log("Running GroundItemManager Public Stackable Merge Tests...");

    const manager = new GroundItemManager();
    const tile = { x: 3200, y: 3200, level: 0 };
    const itemId = 995; // Coins

    const first = manager.spawn(itemId, 10, tile, 0, { ownerId: 1 });
    assert.ok(first, "Initial private stackable drop should spawn");

    const merged = manager.spawn(itemId, 20, tile, GROUND_ITEM_PRIVATE_TICKS, {
        ownerId: 2,
        privateTicks: 0,
    });
    assert.ok(merged, "Public stackable drop should spawn");
    assert.strictEqual(
        merged!.id,
        first!.id,
        "Public stackable drop should merge into an existing public stack",
    );
    assert.strictEqual(merged!.quantity, 30, "Merged public stack quantity should increase");
    assert.strictEqual(
        merged!.ownerId,
        undefined,
        "Merged public stacks should not retain a single-owner tag",
    );

    console.log("GroundItemManager Public Stackable Merge tests passed.");
}

testGroundItemTimers();
testGroundItemStackLimit();
testGroundItemMonsterDrop();
testGroundItemWilderness();
testPrivateStackableOwnershipIsolation();
testPublicStackableMergeAfterPrivacyExpires();
