import assert from "assert";
import path from "path";

import { VARBIT_LEAGUE_TUTORIAL_COMPLETED } from "../../src/shared/vars";
import { PlayerManager } from "../src/game/player";
import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

function makeEnv() {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);
    const map = new MapCollisionService(env, true);
    const pathService = new PathService(map, 128);
    return { pathService };
}

function tickOnce(pm: PlayerManager) {
    // Apply move reservations and tick all players once
    (pm as any).resolveMoveReservations?.();
    pm.forEach((_ws, p) => p.tickStep());
}

function unlockMovement(player: { setVarbitValue: (id: number, value: number) => void }) {
    player.setVarbitValue(VARBIT_LEAGUE_TUTORIAL_COMPLETED, 12);
}

function setPidPriority(player: object, priority: number) {
    Object.defineProperty(player, "pidPriority", {
        value: priority,
        writable: true,
        configurable: true,
    });
}

async function main() {
    const { pathService } = makeEnv();
    const pm = new PlayerManager(pathService);

    // Tie-breaking: runner vs walker into same dest — runner should win
    {
        const ws1: any = { id: "t1a" };
        const ws2: any = { id: "t1b" };
        const p1 = pm.add(ws1, 3168, 3475, 0); // walker
        const p2 = pm.add(ws2, 3168, 3477, 0); // runner
        unlockMovement(p1);
        unlockMovement(p2);
        setPidPriority(p1, 100);
        setPidPriority(p2, 200);
        (p1 as any).queue = [{ x: 3168, y: 3476 }];
        (p2 as any).queue = [
            { x: 3168, y: 3476 },
            { x: 3168, y: 3475 },
        ];
        p1.running = false;
        p2.running = true;
        tickOnce(pm);
        assert.strictEqual(p2.tileX, 3168);
        assert.strictEqual(p2.tileY, 3476, "Runner should take contested tile");
        assert.strictEqual(p1.tileX, 3168);
        assert.strictEqual(p1.tileY, 3475, "Walker should be blocked from contested tile");
    }

    // Tie-breaking: walker vs walker — lower id wins (id ordering)
    {
        const ws1: any = { id: "t2a" };
        const ws2: any = { id: "t2b" };
        const p1 = pm.add(ws1, 3170, 3475, 0); // lower id
        const p2 = pm.add(ws2, 3170, 3477, 0);
        unlockMovement(p1);
        unlockMovement(p2);
        setPidPriority(p1, 100);
        setPidPriority(p2, 200);
        (p1 as any).queue = [{ x: 3170, y: 3476 }];
        (p2 as any).queue = [{ x: 3170, y: 3476 }];
        p1.running = false;
        p2.running = false;
        tickOnce(pm);
        // p1 (lower id) should move; p2 stays
        assert.strictEqual(p1.tileX, 3170);
        assert.strictEqual(p1.tileY, 3476, "Lower id walker should win contested tile");
        assert.strictEqual(p2.tileX, 3170);
        assert.strictEqual(p2.tileY, 3477, "Higher id walker should be blocked");
    }

    // Diagonal corner case: side-adjacent occupant blocks diagonal
    {
        const wsA: any = { id: "t3a" };
        const wsB: any = { id: "t3b" };
        const A = pm.add(wsA, 3200, 3200, 0);
        const B = pm.add(wsB, 3200, 3201, 0); // occupant on north side (side-adjacent)
        unlockMovement(A);
        unlockMovement(B);
        setPidPriority(A, 100);
        setPidPriority(B, 200);
        // A wants to move NE (diagonal) to (3201,3201)
        (A as any).queue = [{ x: 3201, y: 3201 }];
        A.running = false;
        // B stays put this tick
        tickOnce(pm);
        // A should be blocked due to B occupying side tile (3200,3201)
        assert.strictEqual(A.tileX, 3200);
        assert.strictEqual(A.tileY, 3200, "Diagonal should be blocked by side occupant");
    }

    // Diagonal allowed when both side tiles vacate in same sub-step
    {
        const wsA: any = { id: "t4a" };
        const wsB: any = { id: "t4b" };
        const A = pm.add(wsA, 3210, 3210, 0);
        const B = pm.add(wsB, 3210, 3211, 0); // north side, will move away
        unlockMovement(A);
        unlockMovement(B);
        setPidPriority(A, 100);
        setPidPriority(B, 200);
        // A move NE; B moves north away so side becomes free this step
        (A as any).queue = [{ x: 3211, y: 3211 }];
        (B as any).queue = [{ x: 3210, y: 3212 }];
        A.running = false;
        B.running = false;
        tickOnce(pm);
        assert.strictEqual(A.tileX, 3211);
        assert.strictEqual(A.tileY, 3211, "Diagonal should succeed when side vacates");
    }

    // eslint-disable-next-line no-console
    console.log("Movement priority tests passed.");
}

main();
