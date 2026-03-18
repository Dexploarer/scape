import assert from "assert";

import {
    WoodcuttingNodeTracker,
    buildWoodcuttingTileKey,
    resolveTreeByName,
    selectHatchetByLevel,
} from "../src/game/skills/woodcutting";

function testNodeTrackerRespawn(): void {
    const tracker = new WoodcuttingNodeTracker();
    const tile = { x: 3200, y: 3200 };
    const key = buildWoodcuttingTileKey(tile, 0);
    tracker.markDepleted(
        {
            key,
            locId: 1276,
            stumpId: 1342,
            tile,
            level: 0,
            treeId: "normal",
            respawnTicks: { min: 3, max: 3 },
        },
        10,
    );
    assert.ok(tracker.isDepleted(key), "tracker should record depleted node");
    const events: Array<{ oldId: number; newId: number }> = [];
    tracker.processRespawns(12, (oldId, newId) => {
        events.push({ oldId, newId });
    });
    assert.strictEqual(events.length, 0, "node should not respawn before timer");
    tracker.processRespawns(13, (oldId, newId) => {
        events.push({ oldId, newId });
    });
    assert.strictEqual(events.length, 1, "node should respawn when timer elapses");
    assert.deepStrictEqual(events[0], { oldId: 1342, newId: 1276 });
    assert.ok(!tracker.isDepleted(key), "node should be removed after respawn");
}

function testHatchetSelection(): void {
    const available = [1351, 1357, 1349];
    const highLevel = selectHatchetByLevel(available, 35);
    assert.strictEqual(highLevel?.itemId, 1357, "level 35 should use adamant axe");
    const lowLevel = selectHatchetByLevel(available, 5);
    assert.strictEqual(lowLevel?.itemId, 1349, "level 5 should fall back to iron axe");

    const crystalAvailable = [6739, 23673];
    const crystal = selectHatchetByLevel(crystalAvailable, 71);
    assert.strictEqual(crystal?.itemId, 23673, "level 71 should use crystal axe when available");
    const echoLowLevel = selectHatchetByLevel([25110], 1);
    assert.strictEqual(
        echoLowLevel?.itemId,
        25110,
        "echo axe should be selectable with no woodcutting requirement",
    );
    const echoPreferred = selectHatchetByLevel([6739, 25110], 70);
    assert.strictEqual(
        echoPreferred?.itemId,
        25110,
        "echo axe should be preferred over dragon when both are carried",
    );
    assert.strictEqual(
        echoPreferred?.animation,
        12025,
        "echo axe should use the league axe woodcutting animation",
    );

    const none = selectHatchetByLevel([], 99);
    assert.strictEqual(none, undefined, "no hatchet should be selected when none available");
}

function testTreeNameResolution(): void {
    const oak = resolveTreeByName("Oak tree");
    assert.ok(oak, "oak tree should resolve");
    assert.strictEqual(oak?.id, "oak");
    const unknown = resolveTreeByName("Crystal tree");
    assert.strictEqual(unknown, undefined, "unsupported tree names should be undefined");
}

testNodeTrackerRespawn();
testHatchetSelection();
testTreeNameResolution();

console.log("Woodcutting tests passed.");
