import assert from "assert";

import { ProjectileSpawnBuilder } from "../../src/client/webgl/projectiles/ProjectileSpawnBuilder";
import { computeBaseZ } from "../../src/shared/projectiles/projectileHeights";
import { ProjectileBuilder } from "../src/game/projectiles/ProjectileBuilder";

const TILE = (x: number, y: number, plane = 0) => ({ x, y, plane });

function testServerClientProjectileSync(): void {
    const heightSampler = () => 256;
    const spawn = new ProjectileBuilder({ framesPerTick: 30, heightSampler })
        .setProjectileId(91)
        .setSource(TILE(3200, 3200, 0))
        .setTarget({ kind: "tile", tile: TILE(3205, 3202, 0) })
        .setHeights(40, 36)
        .setTiming(2.5, 4)
        .setCasterId(321)
        .build();

    const startCycleOffset = spawn.startCycleOffset;
    const lifetimeCycles = spawn.lifetimeCycles;
    const endCycleOffset = spawn.endCycleOffset;
    const cyclesPerTick = spawn.cyclesPerTick;

    assert.ok(
        Number.isFinite(startCycleOffset ?? NaN),
        "server spawn must publish startCycleOffset",
    );
    assert.ok(Number.isFinite(lifetimeCycles ?? NaN), "server spawn must publish lifetimeCycles");
    assert.ok(Number.isFinite(endCycleOffset ?? NaN), "server spawn must publish endCycleOffset");
    assert.ok(Number.isFinite(cyclesPerTick ?? NaN), "server spawn must publish cyclesPerTick");

    const ctx = {
        sampleHeight: heightSampler,
        currentTick: 12,
        clientCycle: 91,
        cyclesPerTick: 30,
    };

    const result = new ProjectileSpawnBuilder(spawn, ctx).build();
    assert.ok(result, "client builder should resolve the same spawn");

    const { params, meta } = result;
    const clientBase = ctx.clientCycle;
    const effectiveStartCycle = clientBase + startCycleOffset!;
    const effectiveEndCycle = clientBase + endCycleOffset!;

    assert.strictEqual(meta.startCycleOffset, startCycleOffset);
    assert.strictEqual(meta.lifetimeCycles, lifetimeCycles);
    assert.strictEqual(meta.cyclesPerTick, cyclesPerTick);
    assert.strictEqual(params.cyclesPerTick, cyclesPerTick);
    assert.strictEqual(meta.startCycle, effectiveStartCycle);
    assert.strictEqual(params.startCycle, effectiveStartCycle);
    assert.strictEqual(meta.endCycle, effectiveEndCycle);
    assert.strictEqual(params.endCycle, effectiveEndCycle);

    // Height parity: client must not add extra offsets.
    assert.strictEqual(params.startHorizontalOffset, spawn.startHeight);
    assert.strictEqual(params.sourceHeightOffset, spawn.sourceHeightOffset);
    assert.strictEqual(params.targetHeightOffset, spawn.targetHeightOffset);
    assert.strictEqual(spawn.sourceZ, undefined);
    assert.strictEqual(spawn.targetZ, undefined);
    assert.strictEqual(params.sourceZ, computeBaseZ(256, params.sourceHeightOffset ?? 0));
    assert.strictEqual(params.targetZ, computeBaseZ(256, params.targetHeightOffset ?? 0));
}

testServerClientProjectileSync();

console.log("Projectile server/client sync test passed.");
