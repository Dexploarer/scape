import assert from "assert";

import {
    MiningNodeTracker,
    PICKAXES,
    buildMiningLocMap,
    buildMiningTileKey,
    getMiningRockFromMap,
    resolveMiningRockByName,
    selectPickaxeByLevel,
} from "../src/game/skills/mining";

function testMiningNodeTrackerRespawn(): void {
    const tracker = new MiningNodeTracker();
    const tile = { x: 3222, y: 3222 };
    const key = buildMiningTileKey(tile, 0);
    tracker.markDepleted(
        {
            key,
            locId: 2090,
            depletedLocId: 450,
            tile,
            level: 0,
            rockId: "copper",
            respawnTicks: { min: 5, max: 5 },
        },
        100,
    );
    assert.ok(tracker.isDepleted(key), "rock should be marked depleted");
    const events: Array<{ oldId: number; newId: number }> = [];
    tracker.processRespawns(104, (oldId, newId) => {
        events.push({ oldId, newId });
    });
    assert.strictEqual(events.length, 0, "rock should not respawn before timer");
    tracker.processRespawns(105, (oldId, newId) => {
        events.push({ oldId, newId });
    });
    assert.strictEqual(events.length, 1, "rock should respawn after timer");
    assert.deepStrictEqual(events[0], { oldId: 450, newId: 2090 });
    assert.ok(!tracker.isDepleted(key), "rock should be available after respawn");
}

function testPickaxeSelection(): void {
    const items = [1265, 1267, 1271, 11920];
    const highLevel = selectPickaxeByLevel(items, 70);
    assert.strictEqual(highLevel?.itemId, 11920, "level 70 should select dragon pickaxe");
    const midLevel = selectPickaxeByLevel(items, 35);
    assert.strictEqual(midLevel?.itemId, 1271, "level 35 should use adamant pickaxe");
    const lowLevel = selectPickaxeByLevel([1265], 1);
    assert.strictEqual(lowLevel?.itemId, 1265, "bronze pickaxe should be selected when available");
    const echoLowLevel = selectPickaxeByLevel([25112], 1);
    assert.strictEqual(
        echoLowLevel?.itemId,
        25112,
        "echo pickaxe should be selectable with no mining requirement",
    );
    const echoPreferred = selectPickaxeByLevel([11920, 25112], 70);
    assert.strictEqual(
        echoPreferred?.itemId,
        25112,
        "echo pickaxe should be preferred over dragon when both are carried",
    );
    const none = selectPickaxeByLevel([], 80);
    assert.strictEqual(none, undefined, "no pickaxe should be returned when none carried");
}

function testRockNameResolution(): void {
    const result = resolveMiningRockByName("Copper ore rocks");
    assert.ok(result, "copper rocks should resolve");
    assert.strictEqual(result?.id, "copper");
    const unknown = resolveMiningRockByName("Sandstone rocks");
    assert.strictEqual(unknown, undefined, "unsupported rocks should be undefined");
}

function testMiningLocMapDepletedResolution(): void {
    const defs = new Map<number, any>([
        [10, { name: "Tin rocks", actions: ["Mine"], models: [[1390]], recolorTo: [53] }],
        [11, { name: "Clay rocks", actions: ["Mine"], models: [[1391]], recolorTo: [6705] }],
        [20, { name: "Rocks", actions: ["Mine"], models: [[1390]] }],
        [21, { name: "Rocks", actions: ["Mine"], models: [[1391]] }],
        [90, { name: "Rocks", actions: ["Mine"], models: [[1390]] }],
        [30, { name: "Amethyst crystals", actions: ["Mine"], models: [[33166]] }],
    ]);

    const loader = {
        getCount: () => 100,
        load: (id: number) => defs.get(id) ?? { name: "null" },
    };

    const map = buildMiningLocMap(loader as any);
    assert.deepStrictEqual(map.map.get(10), { rockId: "tin", depletedLocId: 20 });
    assert.deepStrictEqual(map.map.get(11), { rockId: "clay", depletedLocId: 21 });
    assert.deepStrictEqual(map.map.get(30), { rockId: "amethyst", depletedLocId: 11389 });

    const tinRock = getMiningRockFromMap(10, map);
    assert.strictEqual(tinRock?.id, "tin");
    assert.strictEqual(
        tinRock?.depletedLocId,
        20,
        "loc-specific depleted mapping should override generic rock definition",
    );
}

function testAmethystDefinition(): void {
    const rock = resolveMiningRockByName("Amethyst crystals");
    assert.ok(rock, "amethyst crystals should resolve");
    assert.strictEqual(rock?.id, "amethyst");
    assert.strictEqual(rock?.level, 92);
    assert.strictEqual(rock?.xp, 240);
    assert.strictEqual(rock?.oreItemId, 21347);
}

function testEchoPickaxeAnimation(): void {
    const echo = PICKAXES.find((pick) => pick.itemId === 25112);
    assert.ok(echo, "echo pickaxe should exist in pickaxe definitions");
    assert.strictEqual(
        echo?.animation,
        8787,
        "echo pickaxe should use the league trailblazer mining animation",
    );
}

testMiningNodeTrackerRespawn();
testPickaxeSelection();
testRockNameResolution();
testMiningLocMapDepletedResolution();
testAmethystDefinition();
testEchoPickaxeAnimation();

console.log("Mining tests passed.");
