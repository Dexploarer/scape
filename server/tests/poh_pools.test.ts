import assert from "assert";

import { SkillId } from "../../src/rs/skill/skills";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { pohPoolModule } from "../src/game/scripts/modules/pohPools";
import { type LocInteractionEvent } from "../src/game/scripts/types";

type Harness = {
    registry: ScriptRegistry;
    services: any;
    messages: string[];
};

function createHarness(): Harness {
    const registry = new ScriptRegistry();
    const messages: string[] = [];
    const services = {
        sendGameMessage: (_player: PlayerState, text: string) => {
            messages.push(text);
        },
        logger: {
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
        },
    };
    pohPoolModule.register(registry, services);
    return { registry, services, messages };
}

function invokePool(
    registry: ScriptRegistry,
    services: any,
    locId: number,
    player: PlayerState,
    tick: number,
): void {
    const handler = registry.findLocInteraction(locId, "drink");
    assert.ok(handler, `expected handler for pool ${locId}`);
    handler({
        tick,
        player,
        locId,
        tile: { x: 0, y: 0 },
        level: 0,
        action: "drink",
        services,
    } as LocInteractionEvent);
}

function testPoolsRestoreRunEnergy(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setRunEnergyPercent(10);

    invokePool(harness.registry, harness.services, 20640, player, 10);

    assert.strictEqual(
        player.getRunEnergyPercent(),
        100,
        "POH pools should restore run energy to full",
    );
    assert.ok(
        harness.messages[harness.messages.length - 1]?.includes("restores"),
        "pool interaction should send flavour text",
    );
}

function testOrnatePoolAppliesStaminaEffect(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setRunEnergyPercent(25);

    invokePool(harness.registry, harness.services, 20643, player, 42);

    assert.strictEqual(player.getRunEnergyPercent(), 100);
    assert.ok(
        player.getStaminaEffectRemainingTicks(42) > 0,
        "Ornate pool should apply a stamina effect",
    );
}

function testRejuvenationPoolRestoresSpecialAndPrayer(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setRunEnergyPercent(0);
    player.setSpecialEnergyPercent(25);
    const prayer = player.getSkill(SkillId.Prayer);
    player.setSkillBoost(SkillId.Prayer, Math.max(0, prayer.baseLevel - 10));

    invokePool(harness.registry, harness.services, 20641, player, 5);

    assert.strictEqual(player.getSpecialEnergyPercent(), 100);
    assert.strictEqual(player.getSkill(SkillId.Prayer).boost, 0);
    assert.strictEqual(player.getHitpointsCurrent(), player.getHitpointsMax());
}

function testFancyPoolCuresStatus(): void {
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.inflictPoison(2, 0);
    player.inflictDisease(1, 0);
    player.inflictVenom(1, 0);

    invokePool(harness.registry, harness.services, 20642, player, 9);

    assert.strictEqual((player as any).poisonEffect, undefined);
    assert.strictEqual((player as any).diseaseEffect, undefined);
    assert.strictEqual((player as any).venomEffect, undefined);
}

testPoolsRestoreRunEnergy();
testOrnatePoolAppliesStaminaEffect();
testRejuvenationPoolRestoresSpecialAndPrayer();
testFancyPoolCuresStatus();

console.log("POH pool tests passed.");
