import assert from "assert";

import { DynamicLocStateStore } from "../src/world/DynamicLocStateStore";

function testTracksMovedDoorStateUntilItReturnsToBase(): void {
    const store = new DynamicLocStateStore();

    store.observeLocChange({
        oldId: 1552,
        newId: 1553,
        level: 0,
        oldTile: { x: 3200, y: 3200 },
        newTile: { x: 3199, y: 3200 },
        oldRotation: 0,
        newRotation: 3,
    });

    assert.deepStrictEqual(store.queryScene(3152, 3152, 0), [
        {
            oldId: 1552,
            newId: 1553,
            level: 0,
            oldTile: { x: 3200, y: 3200 },
            newTile: { x: 3199, y: 3200 },
            oldRotation: 0,
            newRotation: 3,
        },
    ]);

    store.observeLocChange({
        oldId: 1553,
        newId: 1552,
        level: 0,
        oldTile: { x: 3199, y: 3200 },
        newTile: { x: 3200, y: 3200 },
        oldRotation: 3,
        newRotation: 0,
    });

    assert.deepStrictEqual(store.queryScene(3152, 3152, 0), []);
    assert.strictEqual(store.getActiveCount(), 0);
}

function testCollapsesChainedSameTileTransformsIntoBaseToCurrentState(): void {
    const store = new DynamicLocStateStore();

    store.observeLocChange({
        oldId: 1276,
        newId: 1341,
        level: 0,
        oldTile: { x: 3220, y: 3220 },
        newTile: { x: 3220, y: 3220 },
    });
    store.observeLocChange({
        oldId: 1341,
        newId: 10000,
        level: 0,
        oldTile: { x: 3220, y: 3220 },
        newTile: { x: 3220, y: 3220 },
    });

    assert.deepStrictEqual(store.queryScene(3176, 3176, 0), [
        {
            oldId: 1276,
            newId: 10000,
            level: 0,
            oldTile: { x: 3220, y: 3220 },
            newTile: { x: 3220, y: 3220 },
            oldRotation: undefined,
            newRotation: undefined,
        },
    ]);

    store.observeLocChange({
        oldId: 10000,
        newId: 1276,
        level: 0,
        oldTile: { x: 3220, y: 3220 },
        newTile: { x: 3220, y: 3220 },
    });

    assert.deepStrictEqual(store.queryScene(3176, 3176, 0), []);
}

function testIncludesMovedLocsWhenEitherOldOrNewTileIntersectsScene(): void {
    const store = new DynamicLocStateStore();

    store.observeLocChange({
        oldId: 50,
        newId: 51,
        level: 0,
        oldTile: { x: 3299, y: 3250 },
        newTile: { x: 3300, y: 3250 },
    });

    assert.strictEqual(store.queryScene(3200, 3200, 0).length, 1);
    assert.strictEqual(store.queryScene(3300, 3200, 0).length, 1);
}

function main(): void {
    testTracksMovedDoorStateUntilItReturnsToBase();
    testCollapsesChainedSameTileTransformsIntoBaseToCurrentState();
    testIncludesMovedLocsWhenEitherOldOrNewTileIntersectsScene();
}

main();
