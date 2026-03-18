import assert from "assert";

import { PlayerManager } from "../src/game/player";

class StubPathService {
    getGraphSize(): number {
        return 128;
    }

    findPathSteps(req: {
        from: { x: number; y: number; plane: number };
        to: { x: number; y: number };
    }) {
        if (req.from.x === 0 && req.from.y === 0 && req.to.x === 2 && req.to.y === 0) {
            return {
                ok: true,
                steps: [{ x: 1, y: 0 }],
                end: { x: 1, y: 0 },
            };
        }
        if (req.from.x === 0 && req.from.y === 0 && req.to.x === 3 && req.to.y === 0) {
            return {
                ok: true,
                steps: [{ x: 1, y: 0 }],
                end: { x: 1, y: 0 },
            };
        }
        return { ok: false, steps: [], message: "no path" };
    }
}

function main(): void {
    {
        const pm = new PlayerManager(new StubPathService() as any);
        const ws: any = { id: "walk-correction-route" };
        const player = pm.add(ws, 0, 0, 0);

        const result = pm.routePlayer(ws, { x: 2, y: 0 }, false);
        assert.strictEqual(
            result.ok,
            true,
            "Expected exact walk routing to succeed with correction",
        );
        assert.deepStrictEqual(
            result.destinationCorrection,
            { x: 1, y: 0 },
            "Expected routePlayer to expose the nearest reachable fallback tile",
        );
        assert.deepStrictEqual(
            player.getWalkDestination(),
            { x: 1, y: 0, run: false },
            "Expected walk destination to be corrected to the selected reachable tile",
        );
    }

    {
        const pm = new PlayerManager(new StubPathService() as any);
        const ws: any = { id: "walk-correction-continue" };
        const player = pm.add(ws, 0, 0, 0);
        player.setWalkDestination({ x: 3, y: 0 }, false);

        const update = pm.continueWalkToDestination(player, 0);
        assert.deepStrictEqual(
            update,
            { destinationCorrection: { x: 1, y: 0 } },
            "Expected continueWalkToDestination to surface the corrected final segment destination",
        );
        assert.deepStrictEqual(
            player.getWalkDestination(),
            { x: 1, y: 0, run: false },
            "Expected repath walking to update the stored destination to the reachable fallback tile",
        );
    }

    console.log("Manual walk destination correction tests passed.");
}

main();
