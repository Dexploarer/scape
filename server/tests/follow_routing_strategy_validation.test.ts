import assert from "assert";

import {
    PlayerInteractionSystem,
    PlayerRepository,
} from "../src/game/interactions/PlayerInteractionSystem";
import { PlayerState } from "../src/game/player";

class StubPathService {
    findPathSteps(req: { to: { x: number; y: number } }) {
        if (req.to.x === 5 && req.to.y === 4) {
            return {
                ok: true,
                steps: [{ x: 3, y: 6 }],
                end: { x: 4, y: 4 },
            };
        }
        if (req.to.x === 4 && req.to.y === 6) {
            return {
                ok: true,
                steps: [{ x: 3, y: 6 }],
                end: { x: 3, y: 6 },
            };
        }
        return { ok: false, steps: [] };
    }
}

function main(): void {
    const follower = new PlayerState(1, 2, 6, 0);
    const target = new PlayerState(2, 5, 5, 0);
    follower.setVarbitValue(10037, 12);
    target.setVarbitValue(10037, 12);
    target.followX = target.tileX;
    target.followZ = target.tileY;

    const followerWs: any = { id: "follow-strategy-validation" };
    const players = new Map<any, PlayerState>([[followerWs, follower]]);

    const repo: PlayerRepository = {
        get: (socket: any) => players.get(socket),
        getById: (id: number) => {
            if (follower.id === id) return follower;
            if (target.id === id) return target;
            return undefined;
        },
        getSocketByPlayerId: (id: number) => (follower.id === id ? followerWs : undefined),
        forEach: (cb) => players.forEach((player, socket) => cb(socket, player)),
        forEachBot: () => {},
    };

    const system = new PlayerInteractionSystem(repo, new StubPathService() as any);
    const start = system.startFollowing(followerWs, target.id, "follow");
    assert.strictEqual(start.ok, true, "Expected follow interaction to start");

    system.updateFollowing(0);

    assert.deepStrictEqual(
        follower.getPathQueue(),
        [{ x: 3, y: 6 }],
        "Follow routing should skip strategy-invalid alternative endpoints and continue to the next candidate",
    );

    console.log("Follow routing strategy validation test passed.");
}

main();
