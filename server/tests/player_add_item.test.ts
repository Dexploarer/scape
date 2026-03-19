import assert from "assert";

import { getItemDefinition } from "../src/data/items";
import { PlayerState } from "../src/game/player";

function createPlayer(): PlayerState {
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setItemDefResolver((id) => getItemDefinition(id));
    return player;
}

function testAddItemMergesRepeatedStackableGrants() {
    const player = createPlayer();

    let tx = player.addItem(995, 10, { assureFullInsertion: true });
    assert.strictEqual(tx.completed, 10);

    tx = player.addItem(995, 10, { assureFullInsertion: true });
    assert.strictEqual(tx.completed, 10);

    const inventory = player.getInventoryEntries().filter((entry) => entry.itemId > 0);
    assert.strictEqual(inventory.length, 1, "coins should stay in a single stack");
    assert.strictEqual(inventory[0]?.itemId, 995);
    assert.strictEqual(inventory[0]?.quantity, 20);
}

function testAddItemKeepsNonStackablesSeparated() {
    const player = createPlayer();

    const tx = player.addItem(4151, 2, { assureFullInsertion: true });
    assert.strictEqual(tx.completed, 2);
    assert.strictEqual(tx.slots.length, 2);

    const inventory = player.getInventoryEntries().filter((entry) => entry.itemId > 0);
    assert.strictEqual(inventory.length, 2, "non-stackable items should occupy separate slots");
    assert.ok(inventory.every((entry) => entry.itemId === 4151 && entry.quantity === 1));
}

function main() {
    testAddItemMergesRepeatedStackableGrants();
    testAddItemKeepsNonStackablesSeparated();
    console.log("Player addItem tests passed.");
}

main();
