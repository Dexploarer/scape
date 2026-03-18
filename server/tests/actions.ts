import assert from "assert";

import { ActionRequest, ActionScheduler } from "../src/game/actions";
import { PlayerState } from "../src/game/player";

interface ExecutedAction {
    tick: number;
    id: number;
    kind: string;
    data: any;
}

function createHarness() {
    const executed: ExecutedAction[] = [];
    const scheduler = new ActionScheduler((player, action, tick) => {
        executed.push({ tick, id: action.id, kind: action.kind, data: action.data });
        return { ok: true, cooldownTicks: 1 };
    });
    const player = new PlayerState(1, 3200, 3200, 0);
    scheduler.registerPlayer(player);
    return { scheduler, player, executed };
}

function makeRequest(data: any = {}): ActionRequest {
    return {
        kind: "inventory.equip",
        data,
        delayTicks: 1,
        groups: ["inventory"],
        cooldownTicks: 1,
    };
}

function testSingleActionTiming() {
    const { scheduler, player, executed } = createHarness();
    const req = makeRequest({ label: "first" });
    const res = scheduler.requestAction(player.id, req, 0);
    assert.ok(res.ok, "first request should succeed");

    scheduler.processTick(0); // not ready yet
    assert.strictEqual(executed.length, 0, "action should not execute before delay");

    scheduler.processTick(1);
    assert.strictEqual(executed.length, 1, "action should execute after delay");
    assert.strictEqual(executed[0]?.tick, 1);

    const res2 = scheduler.requestAction(player.id, makeRequest({ label: "second" }), 1);
    assert.ok(res2.ok, "second request should succeed");

    scheduler.processTick(1);
    assert.strictEqual(
        executed.length,
        1,
        "cooldown should prevent immediate execution in same tick",
    );

    scheduler.processTick(2);
    assert.strictEqual(executed.length, 2);
    assert.strictEqual(executed[1]?.tick, 2, "second action should execute next tick");
}

function testCancelRemovesPendingActions() {
    const { scheduler, player, executed } = createHarness();
    const req = makeRequest({ label: "cancel" });
    scheduler.requestAction(player.id, req, 5);

    const removed = scheduler.cancelActions(player.id, () => true);
    assert.strictEqual(removed, 1, "cancel should remove queued action");

    scheduler.processTick(6);
    assert.strictEqual(executed.length, 0, "removed action must not execute");

    const res = scheduler.requestAction(player.id, makeRequest({ label: "after-cancel" }), 6);
    assert.ok(res.ok, "new request after cancel should succeed");

    scheduler.processTick(7);
    assert.strictEqual(executed.length, 1, "new action should execute normally");
    assert.strictEqual(executed[0]?.data?.label, "after-cancel");
}

function testCancelActionsRemovesSpecificKind() {
    const { scheduler, player, executed } = createHarness();
    scheduler.requestAction(player.id, makeRequest({ label: "first" }), 10);
    const removed = scheduler.cancelActions(
        player.id,
        (action) => action.kind === "inventory.equip",
    );
    assert.strictEqual(removed, 1, "cancelActions should remove matching action");

    scheduler.requestAction(player.id, makeRequest({ label: "second" }), 10);

    scheduler.processTick(10);
    assert.strictEqual(executed.length, 0, "action should respect delay");

    scheduler.processTick(11);
    assert.strictEqual(executed.length, 1, "only remaining action should execute");
    assert.strictEqual(executed[0]?.data?.label, "second");
    assert.strictEqual(executed[0]?.tick, 11);
}

// OSRS parity: Multiple equip actions should all process (not cancelled)
function testMultipleEquipsAllProcess() {
    const { scheduler, player, executed } = createHarness();
    // Queue multiple equip actions without cancelling
    scheduler.requestAction(
        player.id,
        {
            kind: "inventory.equip",
            data: { label: "sword" },
            delayTicks: 0,
            groups: ["inventory"],
            cooldownTicks: 0,
        },
        10,
    );
    scheduler.requestAction(
        player.id,
        {
            kind: "inventory.equip",
            data: { label: "shield" },
            delayTicks: 0,
            groups: ["inventory"],
            cooldownTicks: 0,
        },
        10,
    );
    scheduler.requestAction(
        player.id,
        {
            kind: "inventory.equip",
            data: { label: "helmet" },
            delayTicks: 0,
            groups: ["inventory"],
            cooldownTicks: 0,
        },
        10,
    );

    scheduler.processTick(10);
    assert.strictEqual(executed.length, 3, "all equip actions should process");
    assert.strictEqual(executed[0]?.data?.label, "sword");
    assert.strictEqual(executed[1]?.data?.label, "shield");
    assert.strictEqual(executed[2]?.data?.label, "helmet");
}

function testClearActionsInGroupClearsLocks() {
    const { scheduler, player, executed } = createHarness();
    scheduler.requestAction(
        player.id,
        {
            kind: "skill.woodcut",
            data: { label: "stale" },
            delayTicks: 5,
            cooldownTicks: 10,
            groups: ["skill.woodcut"],
        },
        0,
    );

    const removed = scheduler.clearActionsInGroup(player.id, "skill.woodcut");
    assert.strictEqual(removed, 1, "group clear should remove queued actions");

    const res = scheduler.requestAction(
        player.id,
        {
            kind: "skill.woodcut",
            data: { label: "fresh" },
            delayTicks: 0,
            cooldownTicks: 1,
            groups: ["skill.woodcut"],
        },
        0,
    );
    assert.ok(res.ok, "new request should succeed after group clear");

    scheduler.processTick(0);
    assert.strictEqual(executed.length, 1, "fresh action should execute immediately");
    assert.strictEqual(executed[0]?.data?.label, "fresh");
}

function main() {
    testSingleActionTiming();
    testCancelRemovesPendingActions();
    testCancelActionsRemovesSpecificKind();
    testMultipleEquipsAllProcess();
    testClearActionsInGroupClearsLocks();
    // eslint-disable-next-line no-console
    console.log("Action scheduler tests passed.");
}

main();
