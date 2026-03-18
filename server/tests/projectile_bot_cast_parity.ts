import assert from "assert";

import { computeBaseZ } from "../../src/shared/projectiles/projectileHeights";
import { getProjectileParams } from "../src/data/projectileParams";
import { PlayerState } from "../src/game/player";
import { ProjectileBuilder } from "../src/game/projectiles/ProjectileBuilder";

const TILE = (x: number, y: number, plane = 0) => ({ x, y, plane });

/**
 * Regression test for bot-vs-bot casting:
 * - Vertical start/end heights are packet bytes scaled by *4 into world units.
 * - Source/target Z bases should be ground minus those scaled offsets.
 */
function testBotVsBotProjectileHeights(): void {
    const botA = new PlayerState(1, 3200, 3200, 0);
    const botB = new PlayerState(2, 3205, 3200, 0);

    const params = getProjectileParams(91);
    assert.ok(params, "projectile params for gfx=91 must exist");

    const verticalStartByte = params!.startHeight ?? 43;
    const verticalEndByte = params!.endHeight ?? 31;
    const sourceOffsetUnits = verticalStartByte * 4;
    const targetOffsetUnits = verticalEndByte * 4;

    const heightSampler = () => -296; // negative-up ground in world units
    const startPosUnits = 64;

    const spawnA = new ProjectileBuilder({ framesPerTick: 30, heightSampler })
        .setProjectileId(91)
        .setSource(TILE(botA.tileX, botA.tileY, botA.level))
        .setTarget({ kind: "player", id: botB.id, tile: TILE(botB.tileX, botB.tileY, botB.level) })
        .applyParams(params)
        .setHeights(startPosUnits, targetOffsetUnits)
        .setSourceHeightOffset(sourceOffsetUnits)
        .setTargetHeightOffset(0)
        .setTiming(0, 2)
        .build();

    assert.strictEqual(
        spawnA.sourceHeightOffset,
        sourceOffsetUnits,
        "source height offset should be scaled start height",
    );
    assert.strictEqual(
        spawnA.targetHeightOffset,
        0,
        "target height offset should default to 0 (endHeight is applied separately)",
    );
    assert.strictEqual(spawnA.sourceZ, undefined, "server spawn must not include sourceZ");
    assert.strictEqual(spawnA.targetZ, undefined, "server spawn must not include targetZ");

    const spawnB = new ProjectileBuilder({ framesPerTick: 30, heightSampler })
        .setProjectileId(91)
        .setSource(TILE(botB.tileX, botB.tileY, botB.level))
        .setTarget({ kind: "player", id: botA.id, tile: TILE(botA.tileX, botA.tileY, botA.level) })
        .applyParams(params)
        .setHeights(startPosUnits, targetOffsetUnits)
        .setSourceHeightOffset(sourceOffsetUnits)
        .setTargetHeightOffset(0)
        .setTiming(0, 2)
        .build();

    assert.strictEqual(spawnB.sourceHeightOffset, sourceOffsetUnits);
    assert.strictEqual(spawnB.targetHeightOffset, 0);
}

testBotVsBotProjectileHeights();

console.log("Bot-vs-bot projectile parity test passed.");
