import assert from "assert";

import {
    PlayerInteractionSystem,
    type PlayerRepository,
} from "../src/game/interactions/PlayerInteractionSystem";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { bootstrapScripts } from "../src/game/scripts/bootstrap";
import { type LocInteractionEvent, type NpcInteractionEvent } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

type WS = Record<string, never>;

const silentLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
};

class StubDoorManager {
    toggles: Array<{
        x: number;
        y: number;
        level: number;
        currentId: number;
        action?: string;
    }> = [];

    toggleDoor(params: {
        x: number;
        y: number;
        level: number;
        currentId: number;
        action?: string;
    }): number | undefined {
        this.toggles.push(params);
        return params.currentId + 1;
    }

    resolveDoorInteractionTile(
        _x: number,
        _y: number,
        _level: number,
        _locId: number,
    ): { x: number; y: number } | undefined {
        return undefined;
    }

    getDoorBlockedDirections(
        _x: number,
        _y: number,
        _level: number,
        _locId: number,
    ): number[] | undefined {
        return undefined;
    }

    isDoorAction(action?: string): boolean {
        if (!action) return false;
        const lower = action.toLowerCase();
        return ["open", "close", "unlock", "lock"].includes(lower);
    }
}

class StubRepository implements PlayerRepository {
    private readonly sockets = new Map<WS, PlayerState>();

    constructor(entries: Array<{ ws: WS; player: PlayerState }>) {
        for (const { ws, player } of entries) {
            this.sockets.set(ws, player);
        }
    }

    get(ws: WS): PlayerState | undefined {
        return this.sockets.get(ws);
    }

    getById(id: number): PlayerState | undefined {
        for (const player of this.sockets.values()) {
            if (player.id === id) return player;
        }
        return undefined;
    }

    getSocketByPlayerId(id: number): WS | undefined {
        for (const [ws, player] of this.sockets.entries()) {
            if (player.id === id) return ws;
        }
        return undefined;
    }

    forEach(cb: (ws: WS, player: PlayerState) => void): void {
        for (const [ws, player] of this.sockets.entries()) {
            cb(ws, player);
        }
    }

    forEachBot(_cb: (player: PlayerState) => void): void {
        // no-op: tests do not use bots
    }
}

function createHarness() {
    const scheduler = new ScriptScheduler();
    const registry = new ScriptRegistry();
    const doorManager = new StubDoorManager();
    const locChanges: Array<{
        oldId: number;
        newId: number;
        tile: { x: number; y: number };
        level: number;
    }> = [];
    const runtime = new ScriptRuntime({
        registry,
        scheduler,
        logger: silentLogger,
        services: {
            sendGameMessage: () => {},
            doorManager,
            emitLocChange: (oldId, newId, tile, level) => {
                locChanges.push({ oldId, newId, tile, level });
            },
        },
    });
    bootstrapScripts(runtime);
    const player = new PlayerState(1, 3200, 3200, 0);
    player.setVarbitValue(10037, 12);
    const ws: WS = {};
    const repo = new StubRepository([{ ws, player }]);
    const pathService = {
        findPath: () => ({ ok: false, waypoints: [] as { x: number; y: number }[] }),
        getCollisionFlagAt: () => 0,
    } as any;
    const interactionSystem = new PlayerInteractionSystem(
        repo,
        pathService,
        undefined,
        doorManager,
        runtime,
    );
    return {
        scheduler,
        registry,
        runtime,
        player,
        ws,
        repo,
        interactionSystem,
        doorManager,
        locChanges,
    };
}

function testNpcInteractionRoutesThroughScripts(): void {
    const { scheduler, registry, interactionSystem, player, ws } = createHarness();
    const events: NpcInteractionEvent[] = [];
    registry.registerNpcInteraction(
        42,
        (event) => {
            events.push(event);
        },
        "Talk-to",
    );

    const npc = new NpcState(42, 42, 1, -1, -1, 1, { x: 3201, y: 3200, level: 0 });

    const start = interactionSystem.startNpcInteraction(ws, npc, "Talk-to");
    assert.ok(start.ok, "NPC interaction should start successfully");

    interactionSystem.updateNpcInteractions(10, (npcId) => (npcId === npc.id ? npc : undefined));
    assert.strictEqual(events.length, 0, "handler should run after scheduler processes tick");

    scheduler.process(10);
    assert.strictEqual(events.length, 1, "script handler should execute once when scheduled");
    assert.strictEqual(events[0]?.tick, 10, "handler should receive current tick");
    assert.strictEqual(events[0]?.player, player, "handler should receive interacting player");
    assert.strictEqual(events[0]?.npc, npc, "handler should receive target NPC");
    assert.strictEqual(events[0]?.option, "Talk-to");

    interactionSystem.updateNpcInteractions(11, (npcId) => (npcId === npc.id ? npc : undefined));
    scheduler.process(11);
    assert.strictEqual(events.length, 1, "interaction should not fire twice after cleanup");
    assert.strictEqual(
        interactionSystem.getStateForSocket(ws),
        undefined,
        "interaction state should be cleared after completion",
    );
}

function testLocInteractionRoutesThroughScripts(): void {
    const { scheduler, registry, interactionSystem, player, ws } = createHarness();
    const events: LocInteractionEvent[] = [];
    registry.registerLocInteraction(
        1000,
        (event) => {
            events.push(event);
        },
        "Open",
    );

    interactionSystem.startLocInteract(ws, {
        id: 1000,
        tile: { x: player.tileX + 1, y: player.tileY },
        level: player.level,
        action: "Open",
    });

    interactionSystem.updateLocInteractions(20);
    scheduler.process(20);

    assert.strictEqual(events.length, 1, "loc script should execute once");
    assert.strictEqual(events[0]?.tick, 20);
    assert.strictEqual(events[0]?.player, player);
    assert.strictEqual(events[0]?.locId, 1000);
    assert.strictEqual(events[0]?.action, "Open");

    interactionSystem.updateLocInteractions(21);
    scheduler.process(21);
    assert.strictEqual(events.length, 1, "loc interaction should not repeat after removal");
}

function testAdjacentLocInteractionExecutesImmediately(): void {
    const { registry, interactionSystem, player, ws } = createHarness();
    const events: LocInteractionEvent[] = [];
    registry.registerLocInteraction(
        1001,
        (event) => {
            events.push(event);
        },
        "Chop down",
    );

    interactionSystem.startLocInteractAtTick(
        ws,
        {
            id: 1001,
            tile: { x: player.tileX + 1, y: player.tileY },
            level: player.level,
            action: "Chop down",
        },
        30,
    );

    assert.strictEqual(events.length, 1, "adjacent loc clicks should execute immediately");
    assert.strictEqual(events[0]?.tick, 30, "immediate loc execution should preserve tick");
    assert.strictEqual(events[0]?.player, player, "handler should receive interacting player");
    assert.strictEqual(events[0]?.locId, 1001, "handler should receive target loc id");
    assert.strictEqual(events[0]?.action, "Chop down");
}

function testDoorScriptsToggleDoors(): void {
    const { scheduler, interactionSystem, player, ws, doorManager, locChanges } = createHarness();

    const targetTile = { x: player.tileX + 1, y: player.tileY };

    interactionSystem.startLocInteract(ws, {
        id: 2000,
        tile: targetTile,
        level: player.level,
        action: "Open",
    });

    interactionSystem.updateLocInteractions(30);
    scheduler.process(30);

    assert.strictEqual(
        doorManager.toggles.length,
        1,
        "door script should invoke door manager once",
    );
    assert.strictEqual(locChanges.length, 1, "door script should emit loc change broadcast");
    assert.deepStrictEqual(locChanges[0], {
        oldId: 2000,
        newId: 2001,
        tile: targetTile,
        level: player.level,
    });
}

function main(): void {
    testNpcInteractionRoutesThroughScripts();
    testLocInteractionRoutesThroughScripts();
    testAdjacentLocInteractionExecutesImmediately();
    testDoorScriptsToggleDoors();
    // eslint-disable-next-line no-console
    console.log("Script routing tests passed.");
}

main();
