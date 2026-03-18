import { MapCollisionService } from "./MapCollisionService";

function clampPlane(plane: number): number {
    return Math.max(0, Math.min(3, Math.trunc(plane)));
}

/**
 * Resolve the plane used for collision reads at a given world tile.
 *
 * This is "bridge-aware": on link-below tiles it returns the demoted plane
 * (matching collision demotion done in Scene.applyBridgeLinks()).
 */
export function resolveCollisionPlaneAt(
    map: MapCollisionService,
    worldX: number,
    worldY: number,
    plane: number,
): number {
    const p = clampPlane(plane);
    return map.getTileMinLevelAt(Math.trunc(worldX), Math.trunc(worldY), p) ?? p;
}
