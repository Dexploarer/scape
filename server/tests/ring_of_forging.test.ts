import assert from "assert";

import { EquipmentSlot } from "../../src/rs/config/player/Equipment";
import type { ActionEffect } from "../src/game/actions";
import { PlayerState } from "../src/game/player";
import { RING_OF_FORGING_ITEM_ID } from "../src/game/skills/smithingBonuses";
import { WSServer } from "../src/network/wsServer";

function createServerHarness() {
    const server = Object.create(WSServer.prototype) as WSServer & {
        ensureEquipArray: (player: PlayerState) => number[];
        refreshAppearanceKits: (player: PlayerState) => void;
        queueAppearanceSnapshot: () => void;
        queueChatMessage: () => void;
    };
    server.ensureEquipArray = (player: PlayerState) => {
        const appearance: any =
            (player as any).appearance ||
            ((player as any).appearance = {
                gender: 0,
                headIcons: { prayer: -1 },
                equip: new Array<number>(14).fill(-1),
            });
        if (!Array.isArray(appearance.equip)) {
            appearance.equip = new Array<number>(14).fill(-1);
        }
        return appearance.equip;
    };
    server.refreshAppearanceKits = () => {};
    server.queueAppearanceSnapshot = () => {};
    server.queueChatMessage = () => {};
    return server;
}

function equipRing(player: PlayerState): void {
    const appearance: any =
        (player as any).appearance ||
        ((player as any).appearance = {
            gender: 0,
            headIcons: { prayer: -1 },
            equip: new Array<number>(14).fill(-1),
        });
    if (!Array.isArray(appearance.equip)) {
        appearance.equip = new Array<number>(14).fill(-1);
    }
    appearance.equip[EquipmentSlot.RING] = RING_OF_FORGING_ITEM_ID;
}

(function testRingWarnsAtTwentyCharges() {
    const server = createServerHarness();
    const player = new PlayerState(1, 3200, 3200, 0);
    equipRing(player);
    player.setRingOfForgingCharges(21);
    const effects: ActionEffect[] = [];
    (server as any).consumeRingOfForgingCharge(player, effects);
    assert.strictEqual(player.getRingOfForgingCharges(), 20);
    const warning = effects.find(
        (effect) => effect.type === "message" && effect.message?.includes("20 more pieces"),
    );
    assert.ok(warning, "warning message should be emitted at 20 charges");
})();

(function testRingMeltsAtZero() {
    const server = createServerHarness();
    const player = new PlayerState(2, 3200, 3200, 0);
    equipRing(player);
    player.setRingOfForgingCharges(1);
    const effects: ActionEffect[] = [];
    (server as any).consumeRingOfForgingCharge(player, effects);
    assert.strictEqual(player.getRingOfForgingCharges(), 0);
    const equip = server.ensureEquipArray(player);
    assert.strictEqual(equip[EquipmentSlot.RING], -1, "ring slot should be cleared after melting");
    const meltedMessage = effects.find(
        (effect) => effect.type === "message" && effect.message?.includes("melted"),
    );
    assert.ok(meltedMessage, "melting should emit a chat message");
    const appearanceUpdate = effects.find((effect) => effect.type === "appearanceUpdate");
    assert.ok(appearanceUpdate, "melting should trigger an appearance update");
})();

console.log("Ring of forging tests passed.");
