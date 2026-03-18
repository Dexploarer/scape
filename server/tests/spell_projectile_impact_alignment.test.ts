import assert from "assert";

import { ProjectileSystem } from "../src/game/systems/ProjectileSystem";

function createProjectileSystem(): ProjectileSystem {
    return new ProjectileSystem({
        getCurrentTick: () => 0,
        getTickMs: () => 600,
        getActiveFrameTick: () => undefined,
        forEachPlayer: () => {},
    });
}

function testSpellProjectileLaunchClampsToScheduledImpactTick(): void {
    const projectileSystem = createProjectileSystem();
    const launch = projectileSystem.buildSpellProjectileLaunch({
        player: {
            id: 3,
            tileX: 3235,
            tileY: 3223,
            level: 0,
        } as any,
        targetNpc: {
            id: 19998,
            tileX: 3235,
            tileY: 3219,
            level: 0,
        } as any,
        spellData: {
            id: 3273,
            projectileId: 91,
            projectileSlope: 16,
        } as any,
        projectileDefaults: {
            startHeight: 43,
            endHeight: 31,
            slope: 16,
            steepness: 64,
        },
        timing: {
            startDelay: 51 / 30,
            travelTime: 1.167,
        },
        impactDelayTicks: 2,
        endHeight: 31,
    });

    assert.ok(launch, "spell projectile launch should be built");
    assert.strictEqual(launch!.startCycleOffset, 51);
    assert.strictEqual(
        launch!.endCycleOffset,
        60,
        "spell projectile should end on the scheduled impact tick instead of using a longer raw packet lifetime",
    );
}

function testSpellProjectileLaunchFallsBackToRawTimingWithoutScheduledImpactTick(): void {
    const projectileSystem = createProjectileSystem();
    const launch = projectileSystem.buildSpellProjectileLaunch({
        player: {
            id: 3,
            tileX: 3235,
            tileY: 3223,
            level: 0,
        } as any,
        targetNpc: {
            id: 19998,
            tileX: 3235,
            tileY: 3219,
            level: 0,
        } as any,
        spellData: {
            id: 3273,
            projectileId: 91,
            projectileSlope: 16,
        } as any,
        projectileDefaults: {
            startHeight: 43,
            endHeight: 31,
            slope: 16,
            steepness: 64,
        },
        timing: {
            startDelay: 51 / 30,
            travelTime: 1.167,
        },
        endHeight: 31,
    });

    assert.ok(launch, "spell projectile launch should be built");
    assert.strictEqual(launch!.startCycleOffset, 51);
    assert.strictEqual(launch!.endCycleOffset, 87);
}

testSpellProjectileLaunchClampsToScheduledImpactTick();
testSpellProjectileLaunchFallsBackToRawTimingWithoutScheduledImpactTick();

console.log("Spell projectile impact alignment test passed.");
