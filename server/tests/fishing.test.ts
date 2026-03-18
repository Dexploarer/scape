import assert from "assert";

import {
    buildFishingSpotMap,
    getFishingSpotById,
    pickFishingCatch,
    selectFishingTool,
} from "../src/game/skills/fishing";

type FakeNpc = { id: number; name: string; category: number; actions: string[] };

type FakeLoader = {
    getCount: () => number;
    load: (id: number) => FakeNpc;
};

function testFishingSpotMap(): void {
    const npcs: FakeNpc[] = [
        { id: 1525, name: "Fishing spot", category: 283, actions: ["Small Net", "Bait"] },
        { id: 1507, name: "Rod Fishing spot", category: 280, actions: ["Lure", "Bait"] },
        { id: 4316, name: "Fishing spot", category: 590, actions: ["Net", "Harpoon"] },
        { id: 4710, name: "Fishing spot", category: 632, actions: ["Net"] },
        { id: 4712, name: "Fishing spot", category: 633, actions: ["Fish"] },
        { id: 1542, name: "Fishing spot", category: 1174, actions: ["Use-rod"] },
        { id: 7730, name: "Fishing spot", category: 1137, actions: ["Small Net"] },
    ];
    const loader: FakeLoader = {
        getCount: () => npcs.length,
        load: (id: number) => npcs[id]!,
    };
    const map = buildFishingSpotMap(loader);
    assert.strictEqual(map.map.get(1525), "sea_small_net", "small net spots should map correctly");
    assert.strictEqual(map.map.get(1507), "river_lure_bait", "lure spots should map correctly");
    assert.strictEqual(map.map.get(4316), "monkfish", "monkfish spots should map correctly");
    assert.strictEqual(map.map.get(4710), "karambwanji", "karambwanji spots should map correctly");
    assert.strictEqual(map.map.get(4712), "karambwan", "karambwan spots should map correctly");
    assert.strictEqual(
        map.map.get(1542),
        "barbarian_heavy_rod",
        "heavy rod spots should map correctly",
    );
    assert.strictEqual(map.map.get(7730), "minnow", "minnow spots should map correctly");
}

function testFishingToolSelection(): void {
    const harpoon = selectFishingTool("harpoon", [21028, 995]);
    assert.ok(harpoon, "dragon harpoon should satisfy harpoon requirement");
    const echoHarpoon = selectFishingTool("harpoon", [25114]);
    assert.ok(echoHarpoon, "echo harpoon should satisfy harpoon requirement");
    assert.strictEqual(
        echoHarpoon?.animation,
        8784,
        "echo harpoon should use the league trailblazer harpoon animation",
    );
    const reloadedHarpoon = selectFishingTool("harpoon", [30342]);
    assert.strictEqual(
        reloadedHarpoon?.animation,
        11867,
        "reloaded echo harpoon should use the reloaded trailblazer harpoon animation",
    );
    const missing = selectFishingTool("harpoon", [303, 305]);
    assert.strictEqual(missing, undefined, "non-harpoon items should fail tool check");
    const heavyRod = selectFishingTool("heavy_rod", [11323]);
    assert.ok(heavyRod, "barbarian rod should satisfy heavy rod requirement");
    const vessel = selectFishingTool("karambwan_vessel", [3157]);
    assert.ok(vessel, "karambwan vessel should satisfy vessel requirement");
}

function testFishingCatchSelection(): void {
    const originalRandom = Math.random;
    try {
        const spot = getFishingSpotById("sea_small_net");
        assert.ok(spot, "sea_small_net spot should exist");
        const method = spot?.methods.find((m) => m.id === "small-net");
        assert.ok(method, "small-net method should exist");
        Math.random = () => 0; // force first eligible catch
        const noviceCatch = pickFishingCatch(method!, 1);
        assert.strictEqual(noviceCatch?.itemId, 317, "level 1 should yield shrimp");
        Math.random = () => 0.99;
        const midCatch = pickFishingCatch(method!, 25);
        assert.ok(midCatch, "higher level should still yield a catch");
        const tooLow = pickFishingCatch(method!, 0);
        assert.strictEqual(tooLow, undefined, "levels below requirement should fail");
        const barbarianSpot = getFishingSpotById("barbarian_heavy_rod");
        assert.ok(barbarianSpot, "barbarian spot should exist");
        const barbarianMethod = barbarianSpot?.methods.find((m) => m.id === "barbarian-use-rod");
        assert.ok(barbarianMethod, "barbarian method should exist");
        Math.random = () => 0.4;
        const barbarianCatch = pickFishingCatch(barbarianMethod!, 70);
        assert.ok(barbarianCatch, "high level barbarian fishing should yield a catch");
    } finally {
        Math.random = originalRandom;
    }
}

testFishingSpotMap();
testFishingToolSelection();
testFishingCatchSelection();

console.log("Fishing tests passed.");
