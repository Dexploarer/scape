import assert from "assert";

import {
    FIREMAKING_LOG_IDS,
    FiremakingTracker,
    buildFireTileKey,
    computeFireLightingDelayTicks,
    getFiremakingLogDefinition,
} from "../src/game/skills/firemaking";

function testDefinitions(): void {
    assert.ok(FIREMAKING_LOG_IDS.length > 0, "firemaking log registry should not be empty");
    const def = getFiremakingLogDefinition(1511);
    assert.ok(def, "normal logs definition should exist");
    assert.strictEqual(def?.xp, 40, "normal logs should grant 40 xp");
}

function testLightingDelayScaling(): void {
    const low = computeFireLightingDelayTicks(1);
    const mid = computeFireLightingDelayTicks(50);
    const high = computeFireLightingDelayTicks(90);
    assert.ok(low >= mid, "higher levels should not have longer delays");
    assert.ok(mid >= high, "delay should decrease (or clamp) as level rises");
    assert.ok(high >= 2, "delay should never drop below 2 ticks");
}

function testFireTrackerLifecycle(): void {
    const tracker = new FiremakingTracker();
    const tile = { x: 3200, y: 3200 };
    const key = buildFireTileKey(tile, 0);
    assert.ok(!tracker.isTileLit(tile, 0), "tile should not start lit");
    const fire = tracker.light({
        tile,
        level: 0,
        logItemId: 1511,
        currentTick: 10,
        burnTicks: { min: 3, max: 3 },
    });
    assert.ok(tracker.isTileLit(tile, 0), "tile should be marked lit after lighting");
    assert.strictEqual(fire.key, key);
    const expired: string[] = [];
    tracker.processExpirations(12, () => {
        throw new Error("fire should not expire early");
    });
    tracker.processExpirations(13, (node) => {
        expired.push(node.key);
    });
    assert.deepStrictEqual(expired, [key], "fire should expire once timer elapses");
    assert.ok(!tracker.isTileLit(tile, 0), "tile should no longer be lit after expiration");
}

function testAshLifecycle(): void {
    const tracker = new FiremakingTracker();
    const tile = { x: 3210, y: 3210 };
    tracker.light({
        tile,
        level: 0,
        logItemId: 1511,
        currentTick: 0,
        burnTicks: { min: 1, max: 1 },
        ownerId: 1,
    });
    tracker.processExpirations(2, (node) => {
        tracker.spawnAshFromFire(node, 2, 2);
    });
    const ash = tracker.getAshNode(tile, 0);
    assert.ok(ash, "ash node should exist after fire expires");
    tracker.processAshes(5, (node) => {
        assert.strictEqual(node.key, buildFireTileKey(tile, 0));
    });
    assert.strictEqual(
        tracker.getAshNode(tile, 0),
        undefined,
        "ash node should despawn after persistence window",
    );
}

testDefinitions();
testLightingDelayScaling();
testFireTrackerLifecycle();
testAshLifecycle();

console.log("Firemaking tests passed.");
