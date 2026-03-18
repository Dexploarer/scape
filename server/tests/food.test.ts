import assert from "assert";

import { SkillId, getXpForLevel } from "../../src/rs/skill/skills";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { foodModule } from "../src/game/scripts/modules/items/food";
import { type ScriptServices } from "../src/game/scripts/types";
import { createTestScriptServices } from "./scriptServices";

type Harness = {
    registry: ScriptRegistry;
    services: ScriptServices;
    calls: {
        consumedSlots: number[];
        messages: string[];
        snapshots: number;
        seqs: number[];
        getObjRequests: number[];
        slotUpdates: Array<{ slot: number; itemId: number; qty: number }>;
    };
    getLastRequest: () =>
        | {
              groups: string[];
              cooldownTicks?: number;
          }
        | undefined;
};

const EAT_SEQ = 829;

function createHarness(opts?: { withScheduler?: boolean }): Harness {
    const registry = new ScriptRegistry();
    const calls = {
        consumedSlots: [] as number[],
        messages: [] as string[],
        snapshots: 0,
        seqs: [] as number[],
        getObjRequests: [] as number[],
        slotUpdates: [] as Array<{ slot: number; itemId: number; qty: number }>,
    };
    let lastRequest: { groups: string[]; cooldownTicks?: number } | undefined;
    const services: ScriptServices = createTestScriptServices();
    services.consumeItem = (_player, slot) => {
        calls.consumedSlots.push(slot);
        return true;
    };
    services.sendGameMessage = (_player, text) => {
        calls.messages.push(text);
    };
    services.snapshotInventoryImmediate = () => {
        calls.snapshots++;
    };
    services.playPlayerSeq = (_player, seq) => {
        calls.seqs.push(seq);
    };
    services.getObjType = (itemId) => {
        calls.getObjRequests.push(itemId);
        return { name: `Item-${itemId}` };
    };
    services.setInventorySlot = (_player, slot, itemId, qty) => {
        calls.slotUpdates.push({ slot, itemId, qty });
    };
    services.requestAction = (_player, req) => {
        if (opts?.withScheduler) {
            lastRequest = { groups: req.groups ?? [], cooldownTicks: req.cooldownTicks };
        }
        const apply = (req.data as { apply?: () => void } | undefined)?.apply;
        if (apply) {
            apply();
        }
        return { ok: true, actionId: 1 };
    };
    foodModule.register(registry, services);
    return { registry, services, calls, getLastRequest: () => lastRequest };
}

function createPlayer(): PlayerState {
    return new PlayerState(42, 3222, 3222, 0);
}

function invokeEat(
    registry: ScriptRegistry,
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    slot: number,
    option: string = "eat",
): void {
    const handler = registry.findItemOnItem(itemId, -1, option);
    assert.ok(handler, `expected handler for item ${itemId}`);
    handler({
        tick: 0,
        option,
        player,
        source: { slot, itemId },
        target: { slot: -1, itemId: -1 },
        services,
    } as any);
}

function setHitpointsLevel(player: PlayerState, level: number): void {
    player.setSkillXp(SkillId.Hitpoints, getXpForLevel(level));
    player.setHitpointsCurrent(level);
}

function testBasicFoodHealsAndMessages(): void {
    const harness = createHarness();
    const player = createPlayer();
    setHitpointsLevel(player, 50);
    player.applyHitpointsDamage(20);
    const before = player.getHitpointsCurrent();

    invokeEat(harness.registry, harness.services, player, 379, 5); // Lobster

    assert.strictEqual(player.getHitpointsCurrent(), before + 12, "lobster should heal 12");
    assert.deepStrictEqual(harness.calls.consumedSlots, [5]);
    assert.deepStrictEqual(harness.calls.seqs, [EAT_SEQ]);
    assert.strictEqual(harness.calls.snapshots, 1, "inventory snapshot should fire once");
    assert.deepStrictEqual(harness.calls.messages, [
        "You eat the item-379.",
        "It heals some health.",
    ]);
}

function testAnglerfishUsesDynamicFormula(): void {
    const harness = createHarness();
    harness.services.getObjType = () => ({ name: "Anglerfish" });
    const player = createPlayer();
    setHitpointsLevel(player, 99);
    player.applyHitpointsDamage(30);
    const before = player.getHitpointsCurrent();

    invokeEat(harness.registry, harness.services, player, 13441, 2);

    const expectedHeal = Math.floor(99 / 10) + 13;
    assert.strictEqual(
        player.getHitpointsCurrent(),
        before + expectedHeal,
        "anglerfish should apply level-based heal",
    );
    assert.deepStrictEqual(harness.calls.messages, [
        "You eat the anglerfish.",
        "It heals some health.",
    ]);
}

function testPieTransitions(): void {
    const harness = createHarness();
    const player = createPlayer();
    setHitpointsLevel(player, 60);
    player.applyHitpointsDamage(20);

    invokeEat(harness.registry, harness.services, player, 2323, 3); // Apple pie
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 3, itemId: 2335, qty: 1 }]);
    harness.calls.slotUpdates.length = 0;

    invokeEat(harness.registry, harness.services, player, 2335, 3); // Half apple pie
    assert.deepStrictEqual(harness.calls.slotUpdates, [{ slot: 3, itemId: 2313, qty: 1 }]);
}

function testKarambwanProfileUsesComboGroup(): void {
    const harness = createHarness({ withScheduler: true });
    const player = createPlayer();
    invokeEat(harness.registry, harness.services, player, 3144, 1);
    const request = harness.getLastRequest();
    assert.ok(request, "expected consume action to be scheduled");
    assert.deepStrictEqual(request?.groups, ["inventory.combo_food"]);
    assert.strictEqual(request?.cooldownTicks, 2);
}

testBasicFoodHealsAndMessages();
testAnglerfishUsesDynamicFormula();
testPieTransitions();
testKarambwanProfileUsesComboGroup();
