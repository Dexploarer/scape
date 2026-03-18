import assert from "assert";

import { LocModelType } from "../../src/rs/config/loctype/LocModelType";
import {
    PlayerInteractionSystem,
    PlayerRepository,
} from "../src/game/interactions/PlayerInteractionSystem";
import { PlayerState } from "../src/game/player";
import { RouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";

class StubPathService {
    findPath(
        req: { from: { x: number; y: number; plane: number }; to: { x: number; y: number } },
        strategy?: RouteStrategy,
    ) {
        if (strategy?.hasArrived(req.from.x, req.from.y, req.from.plane)) {
            return { ok: true, waypoints: [] };
        }
        return { ok: true, waypoints: [{ x: req.to.x, y: req.to.y }] };
    }

    getCollisionFlagAt(): number {
        return 0;
    }

    edgeHasWallBetween(): boolean {
        return false;
    }
}

function createRepo(ws: any, player: PlayerState): PlayerRepository {
    return {
        get: (socket: any) => (socket === ws ? player : undefined),
        getById: (id: number) => (player.id === id ? player : undefined),
        getSocketByPlayerId: (id: number) => (player.id === id ? ws : undefined),
        forEach: (cb) => cb(ws, player),
        forEachBot: () => {},
    };
}

async function main(): Promise<void> {
    const ws: any = { id: "nonblocking-loc" };
    const player = new PlayerState(1, 3200, 3200, 0);
    const repo = createRepo(ws, player);
    const pathService = new StubPathService();
    const locTypeLoader = {
        load: () => ({
            clipType: 0,
            sizeX: 1,
            sizeY: 1,
            types: [LocModelType.NORMAL],
        }),
    };

    const system = new PlayerInteractionSystem(repo, pathService as any, locTypeLoader as any);

    system.startLocInteract(ws, {
        id: 9001,
        tile: { x: 3200, y: 3200 },
        level: 0,
        action: "Climb",
    });

    system.updateLocInteractions(0);

    assert.strictEqual(
        player.getPathQueue().length,
        0,
        "standing on a non-blocking loc should not enqueue a path during interaction processing",
    );

    assert.strictEqual(
        player.getPathQueue().length,
        0,
        "standing on a non-blocking loc should not enqueue a path",
    );

    player.teleport(3201, 3200, 0);

    system.startLocInteract(ws, {
        id: 9001,
        tile: { x: 3200, y: 3200 },
        level: 0,
        action: "Climb",
    });

    const queue = player.getPathQueue();
    assert(queue.length > 0, "expected to walk onto non-blocking loc when not already on it");
    const last = queue[queue.length - 1]!;
    assert.deepStrictEqual(
        last,
        { x: 3200, y: 3200 },
        "non-blocking loc routing should target the loc tile itself",
    );

    console.log("\n✓ Non-blocking loc interactions don't force extra pathing when already on tile");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
