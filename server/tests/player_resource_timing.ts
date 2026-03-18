import assert from "assert";

import type { PrayerName } from "../../src/rs/prayer/prayers";
import { SkillId } from "../../src/rs/skill/skills";
import { RUN_ENERGY_MAX } from "../src/game/actor";
import { PlayerState } from "../src/game/player";

function createPlayer(): PlayerState {
    const player = new PlayerState(1, 3222, 3222, 0);
    return player;
}

function testRunEnergyIntegrator(): void {
    const player = createPlayer();
    player.setRunEnergyUnits(0);
    player.adjustRunEnergyUnits(0.5);
    player.adjustRunEnergyUnits(0.5);
    assert.strictEqual(
        player.getRunEnergyUnits(),
        1,
        "fractional run-energy gains should accumulate into whole units",
    );
    player.adjustRunEnergyUnits(-0.5);
    player.adjustRunEnergyUnits(-0.5);
    assert.strictEqual(
        player.getRunEnergyUnits(),
        0,
        "fractional run-energy drains should accumulate consistently",
    );
    player.setRunEnergyPercent(50);
    assert.strictEqual(
        player.getRunEnergyPercent(),
        50,
        "percent setter/getter should round consistently",
    );
    const expectedUnits = Math.round(RUN_ENERGY_MAX * 0.5);
    assert.ok(
        Math.abs(player.getRunEnergyUnits() - expectedUnits) <= 1,
        "percent setter should map to approximately half the available units",
    );
}

function drainTicks(player: PlayerState, ticks: number): void {
    for (let t = 0; t <= ticks; t++) {
        player.tickSkillRestoration(t);
    }
}

function testSkillRestorationIntervals(): void {
    const player = createPlayer();
    const attack = player.getSkill(SkillId.Attack);
    attack.boost = -2;
    drainTicks(player, 100);
    assert.strictEqual(
        attack.boost,
        -1,
        "drained skills should restore by one level after the default interval",
    );
}

function testRapidRestoreAcceleratesRecovery(): void {
    const player = createPlayer();
    player.setActivePrayers(["rapid_restore" as PrayerName]);
    const defence = player.getSkill(SkillId.Defence);
    defence.boost = -2;
    drainTicks(player, 50);
    assert.strictEqual(
        defence.boost,
        -1,
        "Rapid Restore should halve the time to recover drained stats",
    );
}

function testPreserveDelaysPositiveDecay(): void {
    const withoutPreserve = createPlayer();
    const strength = withoutPreserve.getSkill(SkillId.Strength);
    strength.boost = 2;
    drainTicks(withoutPreserve, 100);
    assert.strictEqual(
        strength.boost,
        1,
        "positive boosts should decay after the default window without Preserve",
    );

    const withPreserve = createPlayer();
    withPreserve.setActivePrayers(["preserve" as PrayerName]);
    const boosted = withPreserve.getSkill(SkillId.Strength);
    boosted.boost = 2;
    drainTicks(withPreserve, 120);
    assert.strictEqual(
        boosted.boost,
        2,
        "Preserve should delay positive boost decay beyond the base interval",
    );
}

testRunEnergyIntegrator();
testSkillRestorationIntervals();
testRapidRestoreAcceleratesRecovery();
testPreserveDelaysPositiveDecay();

console.log("Player resource timing tests passed.");
