import assert from "assert";
import path from "path";

import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { Scene } from "../../src/rs/scene/Scene";
import { LocLoadType, SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { NORMAL_STRATEGY } from "../src/pathfinding/legacy/pathfinder/CollisionStrategy";
import { Pathfinder } from "../src/pathfinding/legacy/pathfinder/Pathfinder";
import { ExactRouteStrategy } from "../src/pathfinding/legacy/pathfinder/RouteStrategy";
import { CollisionFlag } from "../src/pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { initCacheEnv } from "../src/world/CacheEnv";

function buildSceneRect(center: { x: number; y: number }, radius: number) {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);
    const factory = getCacheLoaderFactory(env.info, env.cacheSystem);

    const minX = center.x - radius;
    const minY = center.y - radius;
    const maxX = center.x + radius;
    const maxY = center.y + radius;
    const baseX = Math.floor(minX / Scene.MAP_SQUARE_SIZE) * Scene.MAP_SQUARE_SIZE;
    const baseY = Math.floor(minY / Scene.MAP_SQUARE_SIZE) * Scene.MAP_SQUARE_SIZE;
    const endX = Math.ceil((maxX + 1) / Scene.MAP_SQUARE_SIZE) * Scene.MAP_SQUARE_SIZE;
    const endY = Math.ceil((maxY + 1) / Scene.MAP_SQUARE_SIZE) * Scene.MAP_SQUARE_SIZE;
    const sizeX = endX - baseX;
    const sizeY = endY - baseY;

    const mapFileLoader = factory.getMapFileLoader();
    const underlays = factory.getUnderlayTypeLoader();
    const overlays = factory.getOverlayTypeLoader();
    const locTypeLoader = factory.getLocTypeLoader();
    const locModelLoader = new LocModelLoader(
        locTypeLoader,
        factory.getModelLoader(),
        factory.getTextureLoader(),
        factory.getSeqTypeLoader(),
        factory.getSeqFrameLoader(),
        factory.getSkeletalSeqLoader(),
    );
    const builder = new SceneBuilder(
        env.info,
        mapFileLoader,
        underlays,
        overlays,
        locTypeLoader,
        locModelLoader,
        env.xteas,
    );
    const scene = builder.buildScene(baseX, baseY, sizeX, sizeY, false, LocLoadType.NO_MODELS);
    return { scene, baseX, baseY };
}

function isWalkable(
    scene: Scene,
    baseX: number,
    baseY: number,
    plane: number,
    sx: number,
    sy: number,
    dx: number,
    dy: number,
): boolean {
    const pf = new Pathfinder();
    const graphBaseX = sx - pf.graphSize / 2;
    const graphBaseY = sy - pf.graphSize / 2;
    const col = scene.collisionMaps[plane];
    for (let gx = 0; gx < pf.graphSize; gx++) {
        for (let gy = 0; gy < pf.graphSize; gy++) {
            const wx = graphBaseX + gx;
            const wy = graphBaseY + gy;
            const tx = wx - baseX;
            const ty = wy - baseY;
            let f = 0;
            if (tx >= 0 && ty >= 0 && tx < scene.sizeX && ty < scene.sizeY) f = col.getFlag(tx, ty);
            pf.flags[gx][gy] = f;
        }
    }
    const rs = new ExactRouteStrategy();
    rs.approxDestX = dx;
    rs.approxDestY = dy;
    rs.destSizeX = 1;
    rs.destSizeY = 1;
    const steps = pf.findPath(sx, sy, 1, plane, rs, NORMAL_STRATEGY, 0, false);
    return steps >= 1 && pf.exitX === dx && pf.exitY === dy;
}

function main() {
    // Check a known terrain flag case: 3104,3479 → [1,0,0,0] at planes 0..3
    {
        const center = { x: 3104, y: 3479 };
        const { scene, baseX, baseY } = buildSceneRect(center, 8);
        const tx = 3104 - baseX;
        const ty = 3479 - baseY;
        const byPlane = [0, 1, 2, 3].map((l) => scene.tileRenderFlags[l][tx][ty]);
        const expected: [number, number, number, number] = [1, 0, 0, 0];
        assert.deepStrictEqual(
            byPlane,
            expected,
            `Expected renderFlags.byPlane at (3104,3479) to be ${expected.join(
                ",",
            )} but got ${byPlane.join(",")}`,
        );

        // Unwalkable from any neighbor
        const plane = 0;
        const neighbors: Array<[number, number]> = [
            [3103, 3479],
            [3105, 3479],
            [3104, 3478],
            [3104, 3480],
        ];
        let anyWalkable = false;
        for (const [sx, sy] of neighbors) {
            const inBounds =
                sx >= baseX && sy >= baseY && sx < baseX + scene.sizeX && sy < baseY + scene.sizeY;
            if (!inBounds) continue;
            anyWalkable ||= isWalkable(scene, baseX, baseY, plane, sx, sy, 3104, 3479);
        }
        assert.ok(
            !anyWalkable,
            `Tile (3104,3479,0) should be unwalkable due to renderFlags (1,0,0,0)`,
        );
    }

    // Grand Exchange scenarios
    {
        const center = { x: 3165, y: 3484 };
        const { scene, baseX, baseY } = buildSceneRect(center, 16);
        const plane = 0;

        const expectStepMatchesTileState = (
            start: [number, number],
            end: [number, number],
            label: string,
        ) => {
            const [sx, sy] = start;
            const [dx, dy] = end;
            const destX = dx - baseX;
            const destY = dy - baseY;
            const renderFlags = scene.tileRenderFlags[plane]?.[destX]?.[destY] ?? 0;
            const destTile = scene.tiles[plane]?.[destX]?.[destY];
            const destCollision = scene.collisionMaps[plane].getFlag(destX, destY);
            const hasRenderBlock = (renderFlags & 0x1) === 1;
            const hasLocBlock = (destTile?.locs?.length ?? 0) > 0;
            const hasObjectCollision = (destCollision & CollisionFlag.OBJECT) !== 0;
            const destBlocked = hasRenderBlock || hasLocBlock || hasObjectCollision;
            const debug = `${label} flags=0x${renderFlags.toString(
                16,
            )}, collision=0x${destCollision.toString(16)}, locs=${destTile?.locs?.length ?? 0}`;

            if (destBlocked) {
                assert.ok(
                    !isWalkable(scene, baseX, baseY, plane, sx, sy, dx, dy),
                    `${debug} (blocked)`,
                );
            } else {
                assert.ok(
                    isWalkable(scene, baseX, baseY, plane, sx, sy, dx, dy),
                    `${debug} (expected walkable)`,
                );
            }
        };

        // A: [3165,3490,0] should be collidable (no neighbor can reach exactly this tile)
        {
            const tx = 3165,
                ty = 3490;
            const neighbors: Array<[number, number]> = [
                [tx - 1, ty],
                [tx + 1, ty],
                [tx, ty - 1],
                [tx, ty + 1],
            ];
            let anyWalkable = false;
            for (const [sx, sy] of neighbors) {
                const inBounds =
                    sx >= baseX &&
                    sy >= baseY &&
                    sx < baseX + scene.sizeX &&
                    sy < baseY + scene.sizeY;
                if (!inBounds) continue;
                anyWalkable ||= isWalkable(scene, baseX, baseY, plane, sx, sy, tx, ty);
            }
            assert.ok(!anyWalkable, `[${tx},${ty},0] expected collidable`);
        }

        // B: [3164,3479,0] -> [3164,3480,0] walkable
        assert.ok(
            isWalkable(scene, baseX, baseY, plane, 3164, 3479, 3164, 3480),
            `3164,3479 -> 3164,3480 should be walkable`,
        );

        // C: [3157,3482,0] -> [3158,3482,0] walkable
        assert.ok(
            isWalkable(scene, baseX, baseY, plane, 3157, 3482, 3158, 3482),
            `3157,3482 -> 3158,3482 should be walkable`,
        );

        // D: [3165,3478,0] walkable from north
        assert.ok(
            isWalkable(scene, baseX, baseY, plane, 3165, 3477, 3165, 3478),
            `3165,3478 should be walkable from 3165,3477`,
        );

        // E: [3164,3487,0] -> [3164,3488,0] should NOT be walkable
        assert.ok(
            !isWalkable(scene, baseX, baseY, plane, 3164, 3487, 3164, 3488),
            `3164,3487 -> 3164,3488 should NOT be walkable`,
        );

        // F: [3164,3488,0] -> [3165,3488,0] – cache-dependent
        expectStepMatchesTileState([3164, 3488], [3165, 3488], `[GE] 3164,3488 -> 3165,3488`);

        // G: [3163,3489,0] -> [3163,3490,0]
        expectStepMatchesTileState([3163, 3489], [3163, 3490], `[GE] 3163,3489 -> 3163,3490`);

        // H: [3164,3491,0] -> [3165,3491,0]
        expectStepMatchesTileState([3164, 3491], [3165, 3491], `[GE] 3164,3491 -> 3165,3491`);

        // I: [3165,3491,0] -> [3166,3491,0] should NOT be walkable
        assert.ok(
            !isWalkable(scene, baseX, baseY, plane, 3165, 3491, 3166, 3491),
            `3165,3491 -> 3166,3491 should NOT be walkable`,
        );
    }

    // Falador castle roof bridge – ensure demoted tiles stay walkable
    {
        const center = { x: 3242, y: 3226 };
        const { scene, baseX, baseY } = buildSceneRect(center, 12);
        const plane = 0;

        const origin = { x: 3242, y: 3226 };
        const west = { x: origin.x - 1, y: origin.y };
        const east = { x: origin.x + 1, y: origin.y };
        const south = { x: origin.x, y: origin.y - 1 };

        assert.ok(
            isWalkable(scene, baseX, baseY, plane, west.x, west.y, origin.x, origin.y),
            `[Falador bridge] ${west.x},${west.y} -> ${origin.x},${origin.y} should be walkable`,
        );

        assert.ok(
            isWalkable(scene, baseX, baseY, plane, origin.x, origin.y, east.x, east.y),
            `[Falador bridge] ${origin.x},${origin.y} -> ${east.x},${east.y} should be walkable`,
        );

        assert.ok(
            isWalkable(scene, baseX, baseY, plane, south.x, south.y, origin.x, origin.y),
            `[Falador bridge] ${south.x},${south.y} -> ${origin.x},${origin.y} should be walkable`,
        );
    }
}

main();
