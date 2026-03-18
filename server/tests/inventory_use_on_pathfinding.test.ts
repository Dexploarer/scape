import assert from "assert";

import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import { PlayerState } from "../src/game/player";
import { RectAdjacentRouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";

function main(): void {
    const scheduled: unknown[] = [];
    const player = new PlayerState(1, 0, 0, 0);

    const handler = new InventoryActionHandler({
        getCurrentTick: () => 0,
        getNpc: () => undefined,
        getPlayer: () => undefined,
        getInventory: () => [{ itemId: 100, quantity: 1 }],
        addItemToInventory: () => ({ slot: 0, added: 0, remaining: 0 }),
        consumeItem: () => false,
        countInventoryItem: () => 0,
        markInventoryDirty: () => {},
        resolveEquipSlot: () => undefined,
        equipItem: () => ({ ok: false, reason: "unused" }),
        unequipItem: () => ({ ok: false, reason: "unused" }),
        ensureEquipArray: () => [],
        refreshCombatWeaponCategory: () => ({
            categoryChanged: false,
            weaponItemChanged: false,
        }),
        refreshAppearanceKits: () => {},
        resetAutocast: () => {},
        pickEquipSound: () => 0,
        getObjType: () => undefined,
        isConsumable: () => false,
        isSinewSourceItem: () => false,
        isSpinningWheelLocId: () => false,
        isRangeLoc: () => false,
        createRectAdjacentStrategy: (x, y, sizeX, sizeY) =>
            new RectAdjacentRouteStrategy(x, y, sizeX, sizeY),
        findPathSteps: () => ({
            ok: true,
            steps: [{ x: 1, y: 0 }],
            end: { x: 1, y: 0 },
        }),
        scheduleAction: (_playerId, request) => {
            scheduled.push(request);
            return { ok: true };
        },
        queueChatMessage: () => {},
        buildSkillFailure: (_player, message, reason) => ({ ok: false, reason, effects: [] }),
        playLocSound: () => {},
        getCookingRecipeByRawItemId: () => undefined,
        getFireNode: () => undefined,
        isSmithingLoc: () => false,
        getSmithingBarTypeByItem: () => undefined,
        setSmithingBarType: () => {},
        queueLocInteraction: () => false,
        queueItemOnLoc: () => false,
        queueItemOnItem: () => false,
        executeScriptedConsume: () => ({ handled: false }),
        log: () => {},
    });

    const result = handler.executeInventoryUseOnAction(
        player,
        {
            slot: 0,
            itemId: 100,
            target: {
                kind: "loc",
                id: 1,
                tile: { x: 5, y: 5 },
                plane: 0,
            },
        },
        0,
    );

    assert.strictEqual(result.ok, false, "Expected invalid fallback path to be rejected");
    assert.strictEqual(
        result.reason,
        "no_path",
        "Expected no_path for a strategy-invalid route end",
    );
    assert.deepStrictEqual(player.getPathQueue(), [], "Expected no movement path to be applied");
    assert.deepStrictEqual(scheduled, [], "Expected no retry schedule when no valid route exists");

    console.log("Inventory use-on pathfinding test passed.");
}

main();
