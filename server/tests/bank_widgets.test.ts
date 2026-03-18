import assert from "assert";

import { BankMainChild, BankSideChild, WidgetGroup } from "../src/constants/bank";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { bankWidgetActionsModule } from "../src/game/scripts/modules/bankWidgets";
import { banksideWidgetActionsModule } from "../src/game/scripts/modules/banksideWidgets";
import { type ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { createTestScriptServices } from "./scriptServices";

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

type Harness = {
    runtime: ScriptRuntime;
    scheduler: ScriptScheduler;
    calls: number[];
    stats: {
        depositInventoryCalls: number;
        depositEquipmentCalls: number;
    };
    depositItemCalls: Array<{ slot: number; quantity: number; itemIdHint?: number }>;
};

function createHarness(): Harness {
    const registry = new ScriptRegistry();
    const scheduler = new ScriptScheduler();
    const calls: number[] = [];
    const stats = {
        depositInventoryCalls: 0,
        depositEquipmentCalls: 0,
    };
    const depositItemCalls: Array<{ slot: number; quantity: number; itemIdHint?: number }> = [];
    const services: ScriptServices = createTestScriptServices();
    services.logger = silentLogger;
    services.depositInventoryToBank = () => {
        stats.depositInventoryCalls++;
        return true;
    };
    services.depositEquipmentToBank = () => {
        stats.depositEquipmentCalls++;
        return true;
    };
    (
        services as ScriptServices & {
            depositInventoryItemToBank: (
                player: PlayerState,
                slot: number,
                quantity: number,
                opts?: { itemIdHint?: number },
            ) => { ok: boolean };
        }
    ).depositInventoryItemToBank = (_player, slot, quantity, opts) => {
        depositItemCalls.push({ slot, quantity, itemIdHint: opts?.itemIdHint });
        return { ok: true };
    };
    services.withdrawFromBankSlot = (_player, _slot, quantity) => {
        calls.push(quantity);
        return { ok: true };
    };
    const runtime = new ScriptRuntime({ registry, scheduler, services });
    runtime.loadModule(bankWidgetActionsModule);
    runtime.loadModule(banksideWidgetActionsModule);
    return {
        runtime,
        scheduler,
        calls,
        stats,
        depositItemCalls,
    };
}

function queueWithdrawX(harness: Harness, player: PlayerState, slot: number = 0): void {
    harness.runtime.queueWidgetAction({
        tick: 1,
        player,
        widgetId: (WidgetGroup.BANK_MAIN << 16) | BankMainChild.ITEMS,
        groupId: WidgetGroup.BANK_MAIN,
        childId: BankMainChild.ITEMS,
        opId: 6,
        slot,
    });
    harness.scheduler.process(1);
}

function queueWidgetAction(
    harness: Harness,
    player: PlayerState,
    widgetId: number,
    groupId: number,
    childId: number,
    extra: Partial<{
        option: string;
        opId: number;
        slot: number;
        itemId: number;
    }> = {},
): void {
    harness.runtime.queueWidgetAction({
        tick: 1,
        player,
        widgetId,
        groupId,
        childId,
        option: extra.option,
        opId: extra.opId,
        slot: extra.slot,
        itemId: extra.itemId,
    });
    harness.scheduler.process(1);
}

(function testBankCacheComponentIdsMatchCurrentRevision() {
    assert.strictEqual(BankMainChild.CAPACITY, 5);
    assert.strictEqual(BankMainChild.TABS, 10);
    assert.strictEqual(BankMainChild.ITEMS, 12);
    assert.strictEqual(BankMainChild.DEPOSIT_INVENTORY, 41);
    assert.strictEqual(BankMainChild.DEPOSIT_WORN, 43);
    assert.strictEqual(BankSideChild.ITEMS, 3);
})();

(function testWithdrawUsesCustomQuantity() {
    const harness = createHarness();
    const player = new PlayerState(1, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 995, quantity: 500 }]);
    player.setBankCustomQuantity(42);
    queueWithdrawX(harness, player, 0);
    assert.strictEqual(harness.calls.length, 1);
    assert.strictEqual(harness.calls[0], 42);
})();

(function testWithdrawCapsToAvailableWhenCustomTooHigh() {
    const harness = createHarness();
    const player = new PlayerState(2, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 995, quantity: 30 }]);
    player.setBankCustomQuantity(200);
    queueWithdrawX(harness, player, 0);
    assert.strictEqual(harness.calls.length, 1);
    assert.strictEqual(harness.calls[0], 30);
})();

(function testDepositInventoryButtonUsesCacheComponentId() {
    const harness = createHarness();
    const player = new PlayerState(3, 3200, 3200, 0);
    queueWidgetAction(
        harness,
        player,
        (WidgetGroup.BANK_MAIN << 16) | BankMainChild.DEPOSIT_INVENTORY,
        WidgetGroup.BANK_MAIN,
        BankMainChild.DEPOSIT_INVENTORY,
    );
    assert.strictEqual(harness.stats.depositInventoryCalls, 1);
    assert.strictEqual(harness.stats.depositEquipmentCalls, 0);
})();

(function testDepositWornButtonUsesCacheComponentId() {
    const harness = createHarness();
    const player = new PlayerState(4, 3200, 3200, 0);
    queueWidgetAction(
        harness,
        player,
        (WidgetGroup.BANK_MAIN << 16) | BankMainChild.DEPOSIT_WORN,
        WidgetGroup.BANK_MAIN,
        BankMainChild.DEPOSIT_WORN,
    );
    assert.strictEqual(harness.stats.depositInventoryCalls, 0);
    assert.strictEqual(harness.stats.depositEquipmentCalls, 1);
})();

(function testBanksideDepositUsesCacheItemsComponentId() {
    const harness = createHarness();
    const player = new PlayerState(5, 3200, 3200, 0);
    player.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 100 }]);
    player.setBankQuantityMode(0);
    queueWidgetAction(
        harness,
        player,
        (WidgetGroup.BANK_SIDE << 16) | BankSideChild.ITEMS,
        WidgetGroup.BANK_SIDE,
        BankSideChild.ITEMS,
        {
            opId: 8,
            slot: 0,
            itemId: 995,
        },
    );
    assert.deepStrictEqual(harness.depositItemCalls, [{ slot: 0, quantity: 100, itemIdHint: 995 }]);
})();

(function testBanksideDefaultDepositOneUsesOpIdWithoutOptionText() {
    const harness = createHarness();
    const player = new PlayerState(6, 3200, 3200, 0);
    player.loadInventorySnapshot([{ slot: 0, itemId: 995, quantity: 100 }]);
    player.setBankQuantityMode(0);
    queueWidgetAction(
        harness,
        player,
        (WidgetGroup.BANK_SIDE << 16) | BankSideChild.ITEMS,
        WidgetGroup.BANK_SIDE,
        BankSideChild.ITEMS,
        {
            opId: 2,
            slot: 0,
            itemId: 995,
        },
    );
    assert.deepStrictEqual(harness.depositItemCalls, [{ slot: 0, quantity: 1, itemIdHint: 995 }]);
})();

(function testWithdrawDefaultUsesOpIdWithoutOptionText() {
    const harness = createHarness();
    const player = new PlayerState(7, 3200, 3200, 0);
    player.loadBankSnapshot([{ slot: 0, itemId: 995, quantity: 500 }]);
    player.setBankQuantityMode(0);
    queueWidgetAction(
        harness,
        player,
        (WidgetGroup.BANK_MAIN << 16) | BankMainChild.ITEMS,
        WidgetGroup.BANK_MAIN,
        BankMainChild.ITEMS,
        {
            opId: 1,
            slot: 0,
            itemId: 995,
        },
    );
    assert.deepStrictEqual(harness.calls, [1]);
})();
