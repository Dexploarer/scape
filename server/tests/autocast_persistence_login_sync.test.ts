import assert from "assert";

import { decodeBatchedServerPackets } from "../../src/network/packet/ServerBinaryDecoder";
import { EquipmentSlot } from "../../src/rs/config/player/Equipment";
import {
    VARBIT_AUTOCAST_DEFMODE,
    VARBIT_AUTOCAST_SET,
    VARBIT_AUTOCAST_SPELL,
} from "../../src/shared/vars";
import { applyAutocastState } from "../src/game/combat/AutocastState";
import { PlayerState } from "../src/game/player";
import { WSServer } from "../src/network/wsServer";

(function testPersistentAutocastRebuildsSavedVarbits() {
    const player = new PlayerState(1, 3200, 3200, 0);

    player.applyPersistentVars({
        equipment: [{ slot: EquipmentSlot.WEAPON, itemId: 1381 }],
        combatSpellId: 3273,
        autocastEnabled: true,
        autocastMode: "defensive_autocast",
        varbits: {
            [VARBIT_AUTOCAST_SET]: 0,
            [VARBIT_AUTOCAST_SPELL]: 0,
            [VARBIT_AUTOCAST_DEFMODE]: 0,
        },
    });

    assert.strictEqual(player.combatSpellId, 3273);
    assert.strictEqual(player.autocastEnabled, true);
    assert.strictEqual(player.autocastMode, "defensive_autocast");
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_SET), 1);
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 1);
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 1);
})();

(function testPersistentInvalidAutocastStateIsCleared() {
    const player = new PlayerState(2, 3200, 3200, 0);

    player.applyPersistentVars({
        equipment: [{ slot: EquipmentSlot.WEAPON, itemId: 4587 }],
        combatSpellId: 3273,
        autocastEnabled: true,
        autocastMode: "autocast",
        varbits: {
            [VARBIT_AUTOCAST_SET]: 1,
            [VARBIT_AUTOCAST_SPELL]: 1,
            [VARBIT_AUTOCAST_DEFMODE]: 0,
        },
    });

    assert.strictEqual(player.combatSpellId, -1);
    assert.strictEqual(player.autocastEnabled, false);
    assert.strictEqual(player.autocastMode, null);
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_SET), 0);
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_SPELL), 0);
    assert.strictEqual(player.getVarbitValue(VARBIT_AUTOCAST_DEFMODE), 0);
})();

(function testLoginReplaysAutocastTransmitVarbits() {
    const player = new PlayerState(3, 3200, 3200, 0);
    applyAutocastState(player, 3273, 1, true);

    const packets: Uint8Array[] = [];
    const server = Object.create(WSServer.prototype) as WSServer & {
        withDirectSendBypass: <T>(tag: string, fn: () => T) => T;
        sendWithGuard: (_sock: unknown, data: Uint8Array, _tag: string) => void;
    };
    server.withDirectSendBypass = (_tag, fn) => fn();
    server.sendWithGuard = (_sock, data) => {
        packets.push(data);
    };

    (server as any).sendSavedAutocastTransmitVarbits({} as any, player);

    const decoded = packets.flatMap((packet) => decodeBatchedServerPackets(packet));
    assert.deepStrictEqual(decoded, [
        { type: "varbit", payload: { varbitId: VARBIT_AUTOCAST_SET, value: 1 } },
        { type: "varbit", payload: { varbitId: VARBIT_AUTOCAST_SPELL, value: 1 } },
        { type: "varbit", payload: { varbitId: VARBIT_AUTOCAST_DEFMODE, value: 1 } },
    ]);
})();

console.log("Autocast persistence/login sync test passed.");
