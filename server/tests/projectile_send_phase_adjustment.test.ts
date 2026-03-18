import assert from "assert";

import type { ProjectileLaunch } from "../../src/shared/projectiles/ProjectileLaunch";
import {
    adjustProjectileLaunchForElapsedCycles,
    adjustProjectileLaunchesForElapsedCycles,
} from "../../src/shared/projectiles/projectileDelivery";

function createLaunch(): ProjectileLaunch {
    return {
        projectileId: 91,
        source: {
            tileX: 3262,
            tileY: 3272,
            plane: 0,
            actor: { kind: "player", serverId: 3 },
        },
        target: {
            tileX: 3261,
            tileY: 3273,
            plane: 0,
            actor: { kind: "npc", serverId: 8235 },
        },
        sourceHeight: 172,
        endHeight: 124,
        slope: 16,
        startPos: 64,
        startCycleOffset: 51,
        endCycleOffset: 87,
    };
}

function testProjectileSendPhaseAdjustmentMatchesObservedTrace(): void {
    const adjusted = adjustProjectileLaunchForElapsedCycles(createLaunch(), 27);

    assert.strictEqual(adjusted.startCycleOffset, 24);
    assert.strictEqual(adjusted.endCycleOffset, 60);
}

function testProjectileSendPhaseAdjustmentKeepsActiveProjectileAliveOnlyForRemainingCycles(): void {
    const adjusted = adjustProjectileLaunchForElapsedCycles(createLaunch(), 60);

    assert.strictEqual(adjusted.startCycleOffset, 0);
    assert.strictEqual(adjusted.endCycleOffset, 27);
}

function testProjectileSendPhaseAdjustmentClampsExpiredProjectileToImmediateLifetime(): void {
    const adjusted = adjustProjectileLaunchForElapsedCycles(createLaunch(), 120);

    assert.strictEqual(adjusted.startCycleOffset, 0);
    assert.strictEqual(adjusted.endCycleOffset, 1);
}

function testProjectileSendPhaseAdjustmentArrayHelperReusesInputWhenNoAdjustmentNeeded(): void {
    const launches = [createLaunch()];
    const adjusted = adjustProjectileLaunchesForElapsedCycles(launches, 0);

    assert.strictEqual(adjusted, launches);
}

testProjectileSendPhaseAdjustmentMatchesObservedTrace();
testProjectileSendPhaseAdjustmentKeepsActiveProjectileAliveOnlyForRemainingCycles();
testProjectileSendPhaseAdjustmentClampsExpiredProjectileToImmediateLifetime();
testProjectileSendPhaseAdjustmentArrayHelperReusesInputWhenNoAdjustmentNeeded();

console.log("Projectile send phase adjustment test passed.");
