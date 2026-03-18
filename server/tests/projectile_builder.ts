import assert from "assert";

import { ProjectileParams } from "../src/data/projectileParams";
import { ProjectileBuilder } from "../src/game/projectiles/ProjectileBuilder";

const TILE = (x: number, y: number, plane = 0) => ({ x, y, plane });

function testTileToWorldConversion(): void {
    const builder = new ProjectileBuilder({ framesPerTick: 30 })
        .setProjectileId(91)
        .setSource(TILE(3222, 3222, 0))
        .setTarget({ kind: "tile", tile: TILE(3225, 3223, 0) })
        .setHeights(40, 36)
        .setSlope(16, 0)
        .setTiming(2, 5);

    const spawn = builder.build();
    assert.strictEqual(
        spawn.sourceX,
        (3222 << 7) + 64,
        "source tile should convert to world units",
    );
    assert.strictEqual(
        spawn.sourceY,
        (3222 << 7) + 64,
        "source tile should convert to world units",
    );
    assert.strictEqual(
        spawn.targetX,
        (3225 << 7) + 64,
        "target tile should convert to world units",
    );
    assert.strictEqual(
        spawn.targetY,
        (3223 << 7) + 64,
        "target tile should convert to world units",
    );
    assert.ok(spawn.travelTime > 0, "builder should estimate travel time when not provided");
}

function testNpcTargetOffsetsAndParams(): void {
    const params: ProjectileParams = {
        startHeight: 50,
        endHeight: 20,
        slope: 35,
        steepness: 11,
        startDelay: 3,
        travelTime: 4,
    };

    const spawn = new ProjectileBuilder({ framesPerTick: 30 })
        .applyParams(params)
        .setProjectileId(200)
        .setSource(TILE(3200, 3200, 0))
        .setTarget({
            kind: "npc",
            id: 7,
            tile: TILE(3201, 3202, 0),
            size: 3,
        })
        .setCasterId(99)
        .build();

    const expectedSource = (3200 << 7) + 64;
    assert.strictEqual(spawn.sourceX, expectedSource, "source X should map to tile center");
    assert.strictEqual(spawn.sourceY, expectedSource, "source Y should map to tile center");

    const expectedTargetX = (3201 << 7) + 64 + 2 * 64;
    const expectedTargetY = (3202 << 7) + 64 + 2 * 64;
    assert.strictEqual(spawn.targetX, expectedTargetX, "npc size should offset target center");
    assert.strictEqual(spawn.targetY, expectedTargetY, "npc size should offset target center");

    // Note: startHeight/endHeight in ProjectileParams are cache vertical bytes, but ProjectileSpawn
    // uses startHeight for horizontal startPos and endHeight for destination vertical offset.
    // Those must be explicitly set via setHeights() when needed.
    assert.strictEqual(spawn.slope, 35, "applyParams should propagate slope");
    assert.strictEqual(spawn.steepness, 11, "applyParams should propagate steepness");
    assert.strictEqual(spawn.startDelay, 3, "applyParams should propagate startDelay");
    assert.strictEqual(spawn.travelTime, 4, "applyParams should propagate travelTime");
    assert.strictEqual(spawn.casterId, 99, "caster id should be preserved");
    assert.strictEqual(spawn.targetType, "npc", "builder should encode npc target type");
    assert.strictEqual(spawn.targetId, 7, "builder should encode npc target id");
}

function testHeightSamplerNormalization(): void {
    const samples = [-320, -512, -768, -640, -704, -960];
    let idx = 0;
    const sampler = () => samples[idx++ % samples.length];

    const scenarios = [
        { source: TILE(3200, 3200, 0), target: TILE(3202, 3202, 0) },
        { source: TILE(2995, 3310, 1), target: TILE(2997, 3315, 1) },
        { source: TILE(2450, 3300, 2), target: TILE(2453, 3298, 2) },
    ];

    scenarios.forEach(({ source, target }, sIdx) => {
        const spawn = new ProjectileBuilder({ framesPerTick: 30, heightSampler: sampler })
            .setProjectileId(91 + sIdx)
            .setSource(source)
            .setTarget({ kind: "tile", tile: target })
            .setTiming(0, 3)
            .build();

        // Server does not send absolute Z; client resolves using its height map.
        assert.strictEqual(spawn.sourceZ, undefined, "server spawn must not include sourceZ");
        assert.strictEqual(spawn.targetZ, undefined, "server spawn must not include targetZ");
    });

    assert.strictEqual(idx, 0, "height sampler should not be invoked for server spawns");
}

function testSourceVerticalOffsetSemantics(): void {
    const ground = -300;
    const sampler = () => ground;

    const spawnNoOffset = new ProjectileBuilder({ framesPerTick: 30, heightSampler: sampler })
        .setProjectileId(91)
        .setSource(TILE(3200, 3200, 0))
        .setTarget({ kind: "tile", tile: TILE(3201, 3200, 0) })
        .setHeights(172, 124) // startHeight is horizontal only
        .setTiming(0, 3)
        .build();

    assert.strictEqual(spawnNoOffset.sourceZ, undefined, "server spawn must not include sourceZ");
    assert.strictEqual(
        spawnNoOffset.sourceHeightOffset,
        0,
        "without sourceHeightOffset, server should default offset to 0",
    );

    const spawnWithOffset = new ProjectileBuilder({ framesPerTick: 30, heightSampler: sampler })
        .setProjectileId(91)
        .setSource(TILE(3200, 3200, 0))
        .setTarget({ kind: "tile", tile: TILE(3201, 3200, 0) })
        .setHeights(172, 124)
        .setSourceHeightOffset(200)
        .setTiming(0, 3)
        .build();

    assert.strictEqual(
        spawnWithOffset.sourceZ,
        undefined,
        "server spawn must not include sourceZ even when offsets are set",
    );
    assert.strictEqual(
        spawnWithOffset.sourceHeightOffset,
        200,
        "sourceHeightOffset should be preserved",
    );
}

testTileToWorldConversion();
testNpcTargetOffsetsAndParams();
testHeightSamplerNormalization();
testSourceVerticalOffsetSemantics();

console.log("Projectile builder tests passed.");
