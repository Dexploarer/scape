import { getMapIndexFromTile } from "../../rs/map/MapFileIndex";
import { Scene } from "../../rs/scene/Scene";
import type { MapManager, MapSquare } from "../MapManager";
import { clampPlane } from "../utils/PlaneUtil";

export interface PlaneResolveMapSquare extends MapSquare {
    getTileRenderFlag(level: number, tileX: number, tileY: number): number;
    isBridgeSurface?: (level: number, tileX: number, tileY: number) => boolean;
}

function getTileRenderFlagSafe(
    map: PlaneResolveMapSquare | undefined,
    level: number,
    tileX: number,
    tileY: number,
): number {
    if (!map || typeof map.getTileRenderFlag !== "function") return 0;
    try {
        return map.getTileRenderFlag(level | 0, tileX | 0, tileY | 0) | 0;
    } catch {
        return 0;
    }
}

function isBridgeSurfaceSafe(
    map: PlaneResolveMapSquare | undefined,
    level: number,
    tileX: number,
    tileY: number,
): boolean {
    if (!map || typeof map.isBridgeSurface !== "function") return false;
    try {
        return !!map.isBridgeSurface(level | 0, tileX | 0, tileY | 0);
    } catch {
        return false;
    }
}

function hasBridgeColumnSafe(
    map: PlaneResolveMapSquare | undefined,
    tileX: number,
    tileY: number,
): boolean {
    return (getTileRenderFlagSafe(map, 1, tileX, tileY) & 0x2) === 0x2;
}

/**
 * Which plane to use for height sampling, matching the repo’s current bridge-aware RENDER behavior.
 * This is intentionally not named "effective plane": it is for height selection.
 */
export function resolveHeightSamplePlaneForLocal(
    map: PlaneResolveMapSquare | undefined,
    basePlane: number,
    localTileX: number,
    localTileY: number,
): number {
    let plane = clampPlane(basePlane);
    const isSurface = isBridgeSurfaceSafe(map, plane, localTileX, localTileY);
    const hasBridgeColumn = hasBridgeColumnSafe(map, localTileX, localTileY);
    if (isSurface || hasBridgeColumn) {
        plane = clampPlane(plane + 1);
    }
    return plane;
}

/**
 * Which plane to use for collision sampling (movement/pathing), matching the repo’s current OCCUPANCY behavior.
 */
export function resolveCollisionSamplePlaneForLocal(
    map: PlaneResolveMapSquare | undefined,
    basePlane: number,
    localTileX: number,
    localTileY: number,
): number {
    let plane = clampPlane(basePlane);
    const isSurface = isBridgeSurfaceSafe(map, plane, localTileX, localTileY);
    const hasBridgeColumn = hasBridgeColumnSafe(map, localTileX, localTileY);
    if (!isSurface && hasBridgeColumn) {
        plane = clampPlane(plane + 1);
    }
    return plane;
}

/**
 * Which plane to use for interaction semantics (tile selection / “where is the tile effectively”),
 * matching the repo’s current EFFECTIVE behavior.
 */
export function resolveInteractionPlaneForLocal(
    map: PlaneResolveMapSquare | undefined,
    basePlane: number,
    localTileX: number,
    localTileY: number,
): number {
    const plane = clampPlane(basePlane);
    const isSurface = isBridgeSurfaceSafe(map, plane, localTileX, localTileY);
    const hasBridgeColumn = hasBridgeColumnSafe(map, localTileX, localTileY);
    if (isSurface) {
        return plane;
    }
    if (plane === 0 && hasBridgeColumn) {
        return 1;
    }
    return plane;
}

/**
 * Which plane ground-item stacks are indexed on.
 *
 * OSRS keeps ground piles on the raw client plane and only applies bridge promotion when
 * sampling world height for rendering/click volumes. Reference flow:
 * - `PathStep.addTileItem(...)` stores into `worldView.groundItems[plane][x][y]`
 * - `Message.addSceneMenuOptions(...)` reads piles back from `worldView.groundItems[var22][x][y]`
 * - `NpcComposition.getTileHeight(...)` is what promotes bridge height at render time
 */
export function resolveGroundItemStackPlane(basePlane: number): number {
    return clampPlane(basePlane);
}

function resolveForWorldTile<T extends PlaneResolveMapSquare>(
    mapManager: MapManager<T>,
    basePlane: number,
    tileX: number,
    tileY: number,
    localResolver: (
        map: PlaneResolveMapSquare | undefined,
        basePlane: number,
        localTileX: number,
        localTileY: number,
    ) => number,
): number {
    const map = mapManager.getMap(getMapIndexFromTile(tileX), getMapIndexFromTile(tileY)) as
        | T
        | undefined;
    if (!map) {
        return clampPlane(basePlane);
    }
    const localX = tileX & (Scene.MAP_SQUARE_SIZE - 1);
    const localY = tileY & (Scene.MAP_SQUARE_SIZE - 1);
    return localResolver(map, basePlane, localX, localY);
}

export function resolveCollisionSamplePlaneForWorldTile<T extends PlaneResolveMapSquare>(
    mapManager: MapManager<T>,
    basePlane: number,
    tileX: number,
    tileY: number,
): number {
    return resolveForWorldTile(
        mapManager,
        basePlane,
        tileX,
        tileY,
        resolveCollisionSamplePlaneForLocal,
    );
}

export function resolveInteractionPlaneForWorldTile<T extends PlaneResolveMapSquare>(
    mapManager: MapManager<T>,
    basePlane: number,
    tileX: number,
    tileY: number,
): number {
    return resolveForWorldTile(
        mapManager,
        basePlane,
        tileX,
        tileY,
        resolveInteractionPlaneForLocal,
    );
}
