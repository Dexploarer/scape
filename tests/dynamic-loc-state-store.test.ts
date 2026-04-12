import { describe, expect, test } from "bun:test";

import { DynamicLocStateStore } from "../server/src/world/DynamicLocStateStore";

describe("DynamicLocStateStore", () => {
    test("retains newShape in scene queries for dynamic replacements", () => {
        const store = new DynamicLocStateStore();

        store.observeLocChange({
            oldId: 700,
            newId: 701,
            level: 0,
            oldTile: { x: 3200, y: 3200 },
            newTile: { x: 3200, y: 3200 },
            oldRotation: 1,
            newRotation: 3,
            newShape: 22,
        });

        expect(store.queryScene(3196, 3196, 0, 16)).toEqual([
            {
                oldId: 700,
                newId: 701,
                level: 0,
                oldTile: { x: 3200, y: 3200 },
                newTile: { x: 3200, y: 3200 },
                oldRotation: 1,
                newRotation: 3,
                newShape: 22,
            },
        ]);
    });

    test("carries newShape forward when chaining an observed replacement", () => {
        const store = new DynamicLocStateStore();

        store.observeLocChange({
            oldId: 700,
            newId: 701,
            level: 0,
            oldTile: { x: 3200, y: 3200 },
            newTile: { x: 3201, y: 3200 },
            newRotation: 1,
            newShape: 10,
        });
        store.observeLocChange({
            oldId: 701,
            newId: 702,
            level: 0,
            oldTile: { x: 3201, y: 3200 },
            newTile: { x: 3202, y: 3200 },
            newRotation: 2,
            newShape: 4,
        });

        expect(store.queryScene(3196, 3196, 0, 16)).toEqual([
            {
                oldId: 700,
                newId: 702,
                level: 0,
                oldTile: { x: 3200, y: 3200 },
                newTile: { x: 3202, y: 3200 },
                oldRotation: undefined,
                newRotation: 2,
                newShape: 4,
            },
        ]);
    });

    test("keeps shape-only changes even when id, tile, and rotation stay the same", () => {
        const store = new DynamicLocStateStore();

        store.observeLocChange({
            oldId: 500,
            newId: 500,
            level: 0,
            oldTile: { x: 3200, y: 3200 },
            newTile: { x: 3200, y: 3200 },
            oldRotation: 1,
            newRotation: 1,
            newShape: 22,
        });

        expect(store.queryScene(3196, 3196, 0, 16)).toEqual([
            {
                oldId: 500,
                newId: 500,
                level: 0,
                oldTile: { x: 3200, y: 3200 },
                newTile: { x: 3200, y: 3200 },
                oldRotation: 1,
                newRotation: 1,
                newShape: 22,
            },
        ]);
    });
});
