import assert from "assert";

import { PlayerState } from "../src/game/player";

function createPlayer(): PlayerState {
    return new PlayerState(1, 3200, 3200, 0);
}

function testStaminaEffectExtendsDuration(): void {
    const player = createPlayer();
    player.applyStaminaEffect(0, 200, 0.3);
    player.applyStaminaEffect(100, 200, 0.3);
    assert.strictEqual(
        player.getRunEnergyDrainMultiplier(399),
        0.3,
        "stamina effect should still apply before the extended expiry",
    );
    assert.strictEqual(
        player.getRunEnergyDrainMultiplier(401),
        1,
        "stamina effect should expire once the combined duration elapses",
    );
}

function testStaminaEffectTickingClearsState(): void {
    const player = createPlayer();
    player.applyStaminaEffect(0, 50, 0.3);
    player.tickStaminaEffect(60);
    assert.strictEqual(
        player.getRunEnergyDrainMultiplier(60),
        1,
        "tickStaminaEffect should reset the modifier when past expiry",
    );
}

function testRemainingTicksReporting(): void {
    const player = createPlayer();
    player.applyStaminaEffect(10, 40, 0.3);
    assert.strictEqual(
        player.getStaminaEffectRemainingTicks(20),
        30,
        "remaining ticks should reflect pending duration",
    );
    player.tickStaminaEffect(60);
    assert.strictEqual(
        player.getStaminaEffectRemainingTicks(60),
        0,
        "remaining ticks should be zero once expired",
    );
}

testStaminaEffectExtendsDuration();
testStaminaEffectTickingClearsState();
testRemainingTicksReporting();

console.log("Stamina effect tests passed.");
