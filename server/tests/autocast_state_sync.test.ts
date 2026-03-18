import assert from "assert";

import {
    VARBIT_AUTOCAST_DEFMODE,
    VARBIT_AUTOCAST_SET,
    VARBIT_AUTOCAST_SPELL,
} from "../../src/shared/vars";
import {
    applyAutocastState,
    clearAutocastState,
    restoreAutocastState,
} from "../src/game/combat/AutocastState";
import { PlayerState } from "../src/game/player";

type SentVarbit = { varbitId: number; value: number };

function createHarness() {
    const player = new PlayerState(1, 3200, 3200, 0);
    const sentVarbits: SentVarbit[] = [];
    let combatStateCalls = 0;
    const callbacks = {
        sendVarbit: (_player: PlayerState, varbitId: number, value: number) => {
            sentVarbits.push({ varbitId, value });
        },
        queueCombatState: () => {
            combatStateCalls++;
        },
    };
    return {
        player,
        sentVarbits,
        callbacks,
        get combatStateCalls() {
            return combatStateCalls;
        },
    };
}

(function testApplyAutocastStateSyncsPlayerAndVarbits() {
    const harness = createHarness();

    applyAutocastState(harness.player, 3273, 1, true, harness.callbacks);

    assert.strictEqual(harness.player.combatSpellId, 3273);
    assert.strictEqual(harness.player.autocastEnabled, true);
    assert.strictEqual(harness.player.autocastMode, "defensive_autocast");
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SET), 1);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 1);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 1);
    assert.deepStrictEqual(harness.sentVarbits, [
        { varbitId: VARBIT_AUTOCAST_SET, value: 1 },
        { varbitId: VARBIT_AUTOCAST_SPELL, value: 1 },
        { varbitId: VARBIT_AUTOCAST_DEFMODE, value: 1 },
    ]);
    assert.strictEqual(harness.combatStateCalls, 1);
})();

(function testClearAutocastStateResetsPlayerAndVarbits() {
    const harness = createHarness();
    applyAutocastState(harness.player, 3273, 1, false, harness.callbacks);
    harness.sentVarbits.length = 0;

    clearAutocastState(harness.player, harness.callbacks);

    assert.strictEqual(harness.player.combatSpellId, -1);
    assert.strictEqual(harness.player.autocastEnabled, false);
    assert.strictEqual(harness.player.autocastMode, null);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SET), 0);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 0);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 0);
    assert.deepStrictEqual(harness.sentVarbits, [
        { varbitId: VARBIT_AUTOCAST_SET, value: 0 },
        { varbitId: VARBIT_AUTOCAST_SPELL, value: 0 },
        { varbitId: VARBIT_AUTOCAST_DEFMODE, value: 0 },
    ]);
    assert.strictEqual(harness.combatStateCalls, 2);
})();

(function testRestoreAutocastStateRebuildsVarbitsFromCombatState() {
    const harness = createHarness();
    harness.player.setCombatSpell(3273);
    harness.player.autocastEnabled = true;
    harness.player.autocastMode = "defensive_autocast";

    restoreAutocastState(harness.player, 1381, harness.callbacks);

    assert.strictEqual(harness.player.combatSpellId, 3273);
    assert.strictEqual(harness.player.autocastEnabled, true);
    assert.strictEqual(harness.player.autocastMode, "defensive_autocast");
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SET), 1);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 1);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 1);
    assert.deepStrictEqual(harness.sentVarbits, [
        { varbitId: VARBIT_AUTOCAST_SET, value: 1 },
        { varbitId: VARBIT_AUTOCAST_SPELL, value: 1 },
        { varbitId: VARBIT_AUTOCAST_DEFMODE, value: 1 },
    ]);
    assert.strictEqual(harness.combatStateCalls, 1);
})();

(function testRestoreAutocastStateClearsIncompatibleWeaponState() {
    const harness = createHarness();
    harness.player.setCombatSpell(3273);
    harness.player.autocastEnabled = true;
    harness.player.autocastMode = "autocast";
    harness.player.setVarbitValue(VARBIT_AUTOCAST_SET, 1);
    harness.player.setVarbitValue(VARBIT_AUTOCAST_SPELL, 1);
    harness.player.setVarbitValue(VARBIT_AUTOCAST_DEFMODE, 0);

    restoreAutocastState(harness.player, 4587, harness.callbacks);

    assert.strictEqual(harness.player.combatSpellId, -1);
    assert.strictEqual(harness.player.autocastEnabled, false);
    assert.strictEqual(harness.player.autocastMode, null);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SET), 0);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 0);
    assert.strictEqual(harness.player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 0);
    assert.deepStrictEqual(harness.sentVarbits, [
        { varbitId: VARBIT_AUTOCAST_SET, value: 0 },
        { varbitId: VARBIT_AUTOCAST_SPELL, value: 0 },
        { varbitId: VARBIT_AUTOCAST_DEFMODE, value: 0 },
    ]);
    assert.strictEqual(harness.combatStateCalls, 1);
})();

console.log("Autocast state sync test passed.");
