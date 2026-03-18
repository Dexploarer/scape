import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

import {
    COLLECTION_OVERVIEW_LATEST_ITEM_VARPS,
    VARBIT_CURRENT_RUNEDAY,
    VARP_COLLECTION_COUNT,
    buildCollectionDisplayVarps,
    buildCollectionOverviewOpenState,
    getCollectionLogItems,
} from "../src/game/collectionlog";
import { PlayerState } from "../src/game/player";
import { PlayerPersistence } from "../src/game/state/PlayerPersistence";
import { getRuneDay } from "../src/game/time/RuneDay";

function writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function getTrackableItems(count: number): number[] {
    const items = Array.from(getCollectionLogItems()).slice(0, count);
    assert.ok(
        items.length >= count,
        `expected at least ${count} collection-log items, got ${items.length}`,
    );
    return items;
}

(function testRuneDayMatchesOfficialEpochOffset() {
    assert.strictEqual(getRuneDay(Date.UTC(2002, 1, 27, 0, 0, 0)), 0);
    assert.strictEqual(getRuneDay(Date.UTC(2002, 1, 28, 0, 0, 0)), 1);
})();

(function testCollectionOverviewLatestItemsAreDerivedFromFullUnlockSet() {
    const player = new PlayerState(1, 3200, 3200, 0);
    const items = getTrackableItems(13);

    items.forEach((itemId, index) => {
        player.addCollectionItem(itemId, 1);
        player.recordCollectionItemUnlock(itemId, 500 + index);
    });

    const varps = buildCollectionDisplayVarps(player);

    assert.strictEqual(varps[VARP_COLLECTION_COUNT], 13);
    assert.strictEqual(player.getCollectionItemUnlocks().length, 13);
    assert.strictEqual(varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[0].itemVarp], items[12]);
    assert.strictEqual(varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[0].dateVarp], 512);
    assert.strictEqual(varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[11].itemVarp], items[1]);
    assert.strictEqual(varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[11].dateVarp], 501);
})();

(function testCollectionOverviewOpenStateSeedsCurrentRuneDayAndLatestItems() {
    const player = new PlayerState(2, 3200, 3200, 0);
    const [firstItem, secondItem] = getTrackableItems(2);
    player.addCollectionItem(firstItem, 1);
    player.recordCollectionItemUnlock(firstItem, 700);
    player.addCollectionItem(secondItem, 1);
    player.recordCollectionItemUnlock(secondItem, 701);

    const openState = buildCollectionOverviewOpenState(player, Date.UTC(2002, 1, 28, 12, 0, 0));

    assert.strictEqual(openState.varbits[VARBIT_CURRENT_RUNEDAY], 1);
    assert.strictEqual(
        openState.varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[0].itemVarp],
        secondItem,
    );
    assert.strictEqual(openState.varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[0].dateVarp], 701);
    assert.strictEqual(
        openState.varps[COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[1].itemVarp],
        firstItem,
    );
    assert.strictEqual(
        player.getVarpValue(COLLECTION_OVERVIEW_LATEST_ITEM_VARPS[0].itemVarp),
        secondItem,
    );
})();

(function testCollectionLogItemUnlocksPersistOnlyOwnedValidEntries() {
    const [firstItem, secondItem, missingItem] = getTrackableItems(3);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "collection-log-recent-"));

    try {
        const defaultsPath = path.join(tempDir, "player-defaults.json");
        const storePath = path.join(tempDir, "player-state.json");
        writeJson(defaultsPath, {});
        writeJson(storePath, {
            recent_player: {
                collectionLog: {
                    items: [
                        { itemId: firstItem, quantity: 1 },
                        { itemId: secondItem, quantity: 2 },
                    ],
                    itemUnlocks: [
                        { itemId: secondItem, runeDay: 902, sequence: 2 },
                        { itemId: -1, runeDay: 999, sequence: 9 },
                        { itemId: missingItem, runeDay: 901, sequence: 1 },
                        { itemId: firstItem, runeDay: 900, sequence: 1 },
                    ],
                },
            },
        });

        const persistence = new PlayerPersistence({ defaultsPath, storePath });
        const player = new PlayerState(3, 3200, 3200, 0);
        persistence.applyToPlayer(player, "recent_player");

        assert.deepStrictEqual(player.getCollectionItemUnlocks(), [
            { itemId: firstItem, runeDay: 900, sequence: 1 },
            { itemId: secondItem, runeDay: 902, sequence: 2 },
        ]);
        assert.deepStrictEqual(player.exportCollectionLogSnapshot()?.itemUnlocks, [
            { itemId: firstItem, runeDay: 900, sequence: 1 },
            { itemId: secondItem, runeDay: 902, sequence: 2 },
        ]);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
})();

console.log("Collection log item unlock tests passed.");
