import assert from "assert";

import { LocModelType } from "../../src/rs/config/loctype/LocModelType";
import {
    PlayerInteractionSystem,
    PlayerRepository,
} from "../src/game/interactions/PlayerInteractionSystem";
import { PlayerState } from "../src/game/player";

class StubPathService {
    findPathCalls = 0;
    findPathStepsCalls = 0;

    getCollisionFlagAt(): number {
        return 0;
    }

    // Legacy API (should not be used by interaction routing anymore)
    findPath(): any {
        this.findPathCalls++;
        return { ok: true, waypoints: [{ x: 2, y: 2 }] };
    }

    // Expected API: step-by-step tiles (server authoritative)
    findPathSteps(): any {
        this.findPathStepsCalls++;
        return {
            ok: true,
            steps: [
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 2, y: 1 },
            ],
        };
    }
}

function main(): void {
    const pathService = new StubPathService();

    const locTypeLoader: any = {
        load: (_id: number) => ({
            sizeX: 1,
            sizeY: 1,
            clipType: 1,
            types: [LocModelType.NORMAL],
            actions: ["Use"],
        }),
    };

    const ws: any = { id: "interaction_no_waypoint_interpolation" };
    const player = new PlayerState(1, 0, 0, 0);
    const players = new Map<any, PlayerState>([[ws, player]]);

    const repo: PlayerRepository = {
        get: (socket: any) => players.get(socket),
        getById: (id: number) => (player.id === id ? player : undefined),
        getSocketByPlayerId: (id: number) => (player.id === id ? ws : undefined),
        forEach: (cb) => players.forEach((p, socket) => cb(socket, p)),
        forEachBot: () => {},
    };

    const system = new PlayerInteractionSystem(repo, pathService as any, locTypeLoader);
    player.setVarbitValue(10037, 12);

    system.startLocInteract(ws, {
        id: 1,
        tile: { x: 2, y: 2 },
        level: 0,
        action: "Use",
    });

    assert.strictEqual(
        pathService.findPathCalls,
        0,
        "Interaction routing must not call findPath()",
    );
    assert.strictEqual(
        pathService.findPathStepsCalls,
        1,
        "Interaction routing should call findPathSteps()",
    );

    const queue = player.getPathQueue();
    assert.deepStrictEqual(
        queue,
        [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
        ],
        "Player path should use step-by-step tiles from findPathSteps()",
    );

    // No diagonal interpolation between non-adjacent waypoints.
    let px = player.tileX;
    let py = player.tileY;
    for (const step of queue) {
        const dx = Math.abs(step.x - px);
        const dy = Math.abs(step.y - py);
        assert.ok(dx + dy === 1, `Expected cardinal unit step, got dx=${dx}, dy=${dy}`);
        px = step.x;
        py = step.y;
    }

    console.log("✓ Interaction routing does not expand turn-point waypoints");

    {
        const blockedPathService = new StubPathService();
        blockedPathService.findPathSteps = () => ({
            ok: true,
            steps: [{ x: 1, y: 0 }],
            end: { x: 0, y: 0 },
        });

        const blockedPlayer = new PlayerState(2, 0, 0, 0);
        blockedPlayer.setVarbitValue(10037, 12);
        const blockedWs: any = { id: "interaction_invalid_alt_end" };
        const blockedPlayers = new Map<any, PlayerState>([[blockedWs, blockedPlayer]]);

        const blockedRepo: PlayerRepository = {
            get: (socket: any) => blockedPlayers.get(socket),
            getById: (id: number) => (blockedPlayer.id === id ? blockedPlayer : undefined),
            getSocketByPlayerId: (id: number) => (blockedPlayer.id === id ? blockedWs : undefined),
            forEach: (cb) => blockedPlayers.forEach((p, socket) => cb(socket, p)),
            forEachBot: () => {},
        };

        const blockedSystem = new PlayerInteractionSystem(
            blockedRepo,
            blockedPathService as any,
            locTypeLoader,
        );

        blockedSystem.startLocInteract(blockedWs, {
            id: 1,
            tile: { x: 2, y: 2 },
            level: 0,
            action: "Use",
        });

        assert.deepStrictEqual(
            blockedPlayer.getPathQueue(),
            [],
            "Interaction routing must reject alternative fallback endpoints that do not satisfy the loc route strategy",
        );
    }
}

main();
