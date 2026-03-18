import assert from "assert";

import { CollisionMap } from "../../src/rs/scene/CollisionMap";
import { PathService } from "../src/pathfinding/PathService";
import type { MapCollisionService, ServerMapSquare } from "../src/world/MapCollisionService";

function makeStubMapSquare(): ServerMapSquare {
    const borderSize = 6;
    const size = 64 + borderSize * 2;
    const baseX = -borderSize;
    const baseY = -borderSize;
    const flags = new Int32Array(size * size); // all-walkable if queried
    const cm = new CollisionMap(size, size, flags);
    return {
        mapX: 0,
        mapY: 0,
        borderSize,
        baseX,
        baseY,
        size,
        collisionMaps: [cm, cm, cm, cm],
    };
}

function makeStubMap(): MapCollisionService {
    const square = makeStubMapSquare();
    return {
        getMapSquare: (mapX: number, mapY: number) =>
            mapX === 0 && mapY === 0 ? square : undefined,
        getTileMinLevelAt: (_x: number, _y: number, plane: number) => plane,
    } as unknown as MapCollisionService;
}

function main() {
    const map = makeStubMap();
    const pathService = new PathService(map, 128);

    // Regression: negative world tiles must not alias into mapsquare (0,0) via truncation.
    assert.strictEqual(
        pathService.getCollisionFlagAt(-1, 0, 0),
        undefined,
        "Expected negative worldX to be treated as out-of-bounds",
    );
    assert.strictEqual(
        pathService.getCollisionFlagAt(0, -1, 0),
        undefined,
        "Expected negative worldY to be treated as out-of-bounds",
    );

    // eslint-disable-next-line no-console
    console.log("Pathfinding OOB tests passed.");
}

main();
