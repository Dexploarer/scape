import assert from "assert";

import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { equipmentActionsModule } from "../src/game/scripts/modules/equipment";
import { type EquipmentActionEvent } from "../src/game/scripts/types";

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
    equipmentActionsModule.register(registry, services);
    return { registry, services, messages };
}

function invokeEquipmentAction(
    registry: ScriptRegistry,
    services: any,
    opts: Partial<EquipmentActionEvent> & { itemId: number; option: string; player: PlayerState },
): void {
    const handler = registry.findEquipmentAction(opts.itemId, opts.option);
    assert.ok(handler, `expected handler for item ${opts.itemId} option ${opts.option}`);
    handler({
        tick: opts.tick ?? 0,
        player: opts.player,
        itemId: opts.itemId,
        slot: opts.slot ?? 0,
        option: opts.option,
        rawOption: opts.rawOption ?? opts.option,
        services,
    } as EquipmentActionEvent);
}

function withMockedNow<T>(value: number, fn: () => T): T {
    const original = Date.now;
    Date.now = () => value;
    try {
        return fn();
    } finally {
        Date.now = original;
    }
}

function testExplorerRingOperateRestoresEnergy(): void {
    withMockedNow(1_700_000_000_000, () => {
        const harness = createHarness();
        const player = new PlayerState(1, 3222, 3222, 0);
        player.setRunEnergyPercent(0);

        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13125,
            option: "operate",
            player,
        });
        assert.strictEqual(
            player.getRunEnergyPercent(),
            50,
            "first Explorer's ring operate should restore 50% run energy",
        );
        assert.ok(
            harness.messages.some((msg) => msg.includes("1 charge") || msg.includes("charges")),
            "operate message should mention remaining charges",
        );
        harness.messages.length = 0;

        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13125,
            option: "operate",
            player,
        });
        assert.strictEqual(
            player.getRunEnergyPercent(),
            100,
            "second Explorer's ring operate should reach 100%",
        );

        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13125,
            option: "operate",
            player,
        });
        assert.ok(
            harness.messages[harness.messages.length - 1]?.includes("no remaining"),
            "third use should be blocked after charges are consumed",
        );
    });
}

function testExplorerRingCheckReportsCharges(): void {
    withMockedNow(1_700_000_000_000, () => {
        const harness = createHarness();
        const player = new PlayerState(1, 3222, 3222, 0);
        player.setRunEnergyPercent(0);

        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13126,
            option: "check",
            player,
        });
        assert.ok(
            harness.messages.pop()?.includes("Explorer's ring restores"),
            "check option should display remaining charges",
        );
    });
}

function testExplorerRingChargesResetDaily(): void {
    const dayMs = 24 * 60 * 60 * 1000;
    const base = 1_700_000_000_000;
    const harness = createHarness();
    const player = new PlayerState(1, 3222, 3222, 0);
    player.setRunEnergyPercent(0);

    withMockedNow(base, () => {
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        assert.ok(
            harness.messages[harness.messages.length - 1]?.includes("no remaining"),
            "ring4 should block after using daily charges",
        );
        harness.messages.length = 0;
    });

    withMockedNow(base + dayMs + 1, () => {
        player.setRunEnergyPercent(0);
        invokeEquipmentAction(harness.registry, harness.services, {
            itemId: 13128,
            option: "operate",
            player,
        });
        assert.strictEqual(player.getRunEnergyPercent(), 50, "charges should reset on a new day");
    });
}

testExplorerRingOperateRestoresEnergy();
testExplorerRingCheckReportsCharges();
testExplorerRingChargesResetDaily();

console.log("Explorer's ring tests passed.");
