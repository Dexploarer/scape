// @ts-nocheck
import assert from "assert";

import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { bankLocationModule } from "../src/game/scripts/modules/bankLocations";

(function testBankLocActionOpensBank() {
    const registry = new ScriptRegistry();
    let openBankCalled = false;
    let openMode: string | undefined;
    const services: any = {
        openBank: (_player: PlayerState, opts?: any) => {
            openBankCalled = true;
            openMode = opts?.mode;
        },
        sendGameMessage: () => {},
        logger: { info: () => {} },
    };

    bankLocationModule.register(registry as any, services);

    const handler = registry.findLocInteraction(1234, "Bank");
    assert.ok(handler, "bank loc handler should be registered for action 'Bank'");

    const player = new PlayerState(301, 3200, 3200, 0);
    handler({
        player,
        locId: 1234,
        tile: { x: 3200, y: 3200 },
        level: 0,
        action: "Bank",
        tick: 0,
        services,
    });

    assert.ok(openBankCalled, "openBank should be invoked");
    assert.strictEqual(openMode, "bank", "bank mode should be 'bank'");
})();
