import assert from "assert";
import path from "path";

import { ConfigType } from "../../src/rs/cache/ConfigType";
import {
    ArchiveOverlayFloorTypeLoader,
    ArchiveUnderlayFloorTypeLoader,
} from "../../src/rs/config/floortype/FloorTypeLoader";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { ArchiveLocTypeLoader } from "../../src/rs/config/loctype/LocTypeLoader";
import { MapFileLoader } from "../../src/rs/map/MapFileLoader";
import { Scene } from "../../src/rs/scene/Scene";
import { SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { PathService } from "../src/pathfinding/PathService";
import { CollisionFlag } from "../src/pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

// Compute the render flags [l0,l1,l2,l3] for a world tile using decodeTerrain only (pre-bridge demotion)
function getPreDemotionFlags(builder: SceneBuilder, x: number, y: number): number[] {
    const mapX = Math.floor(x / 64);
    const mapY = Math.floor(y / 64);

    // Build a small scene window around the mapsquare with a 6-tile border
    const border = 6;
    const baseX = mapX * 64 - border;
    const baseY = mapY * 64 - border;
    const size = 64 + border * 2;

    const scene = new Scene(Scene.MAX_LEVELS, size, size);
    const terrainData = builder.getTerrainData(mapX, mapY);
    assert(terrainData, `No terrain data for mapsquare (${mapX},${mapY})`);

    const offsetX = mapX * 64 - baseX;
    const offsetY = mapY * 64 - baseY;
    builder.decodeTerrain(scene, terrainData!, offsetX, offsetY, baseX, baseY);

    const localX = x - baseX;
    const localY = y - baseY;
    assert(
        localX >= 0 && localY >= 0 && localX < size && localY < size,
        `Local tile out of bounds (${localX},${localY}) in sized region (${size}x${size})`,
    );
    return [0, 1, 2, 3].map((l) => scene.tileRenderFlags[l][localX][localY]);
}

function main() {
    const cachesRoot = path.resolve(process.cwd(), "caches");
    const env = initCacheEnv(cachesRoot);

    // Minimal loaders for SceneBuilder pre-demotion snapshot (no model/loc loading required)
    const locsArchive = env.indices.configs.getArchive(ConfigType.DAT2.locs);
    const locTypeLoader = new ArchiveLocTypeLoader(env.info, locsArchive);
    const underlaysArchive = env.indices.configs.getArchive(ConfigType.DAT2.underlays);
    const overlaysArchive = env.indices.configs.getArchive(ConfigType.DAT2.overlays);
    const floorTypeLoader = new ArchiveUnderlayFloorTypeLoader(env.info, underlaysArchive);
    const overlayFloorTypeLoader = new ArchiveOverlayFloorTypeLoader(env.info, overlaysArchive);
    const locModelLoader = new LocModelLoader(
        locTypeLoader,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined as any,
    );
    const mapFileLoader = new MapFileLoader(env.indices.maps, env.mapFileIndex);
    const builder = new SceneBuilder(
        env.info,
        mapFileLoader,
        floorTypeLoader,
        overlayFloorTypeLoader,
        locTypeLoader,
        locModelLoader,
        env.xteas,
    );

    // 1) Render flags parity used by pathfinding (pre-bridge demotion snapshot)
    {
        const x = 3166,
            y = 3475;
        const flags = getPreDemotionFlags(builder, x, y);
        const expected = [0, 2, 0, 0];
        assert.deepStrictEqual(
            flags,
            expected,
            `Render flags for (${x},${y}) were ${flags.join(",")} but expected ${expected.join(
                ",",
            )}`,
        );
        // eslint-disable-next-line no-console
        console.log(`OK: render flags for (${x},${y}) = ${flags.join(",")}`);
    }

    // 2) Bridge demotion sanity at (3168,3479):
    //    - Pre-demotion: base plane tile not floor-blocked; level 1 column has bridge bit set.
    //    - Post-demotion: base plane collision is populated on the demoted column.
    {
        const x = 3168,
            y = 3479;
        const pre = getPreDemotionFlags(builder, x, y);
        const baseFloorBlocked = (pre[0] & 0x1) === 0x1;
        const level1Bridge = (pre[1] & 0x2) === 0x2;
        // eslint-disable-next-line no-console
        console.log(
            `Pre-demotion flags (${x},${y}) = ${pre.join(
                ",",
            )} baseFloorBlocked=${baseFloorBlocked} level1Bridge=${level1Bridge}`,
        );

        const mapService = new MapCollisionService(env, true);
        const pathService = new PathService(mapService, 128);
        const res = pathService.findPath({
            from: { x: x - 1, y, plane: 0 },
            to: { x, y },
            size: 1,
        });
        // eslint-disable-next-line no-console
        console.log(
            `Post-demotion path to (${x},${y}) ok=${res.ok} waypoints=${
                res.waypoints?.length ?? 0
            }`,
        );
        // Unwalkable means we cannot step onto the tile from an adjacent tile
        assert.ok(
            !res.waypoints || res.waypoints.length === 0,
            "Expected no step onto bridge-demoted base tile",
        );

        const mapX = Math.floor(x / 64);
        const mapY = Math.floor(y / 64);
        const ms = mapService.getMapSquare(mapX, mapY)!;
        const localX = x - mapX * 64;
        const localY = y - mapY * 64;
        const bx = localX + ms.borderSize;
        const by = localY + ms.borderSize;
        const baseFlag = ms.collisionMaps[0].getFlag(bx, by);
        const baseFloor = (baseFlag & CollisionFlag.FLOOR) !== 0;
        // eslint-disable-next-line no-console
        console.log(
            `Post-demotion collision (${x},${y}) baseFlag=0x${baseFlag.toString(
                16,
            )} baseFloor=${baseFloor}`,
        );
    }
}

main();
