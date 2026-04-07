/**
 * Shared projectile height / offset helpers for strict .
 *
 * Coordinate convention:
 * - World Z is negative-up (more negative = higher).
 * - Ground heights are provided in negative-up world units.
 *
 * CS2/cache values are authoritative; these helpers only combine offsets.
 */

export const TILE_UNIT = 128;

// OSRS player chest/hand conventions.
export const PLAYER_CHEST_OFFSET_UNITS = Math.round(0.9 * TILE_UNIT);
export const PLAYER_HAND_LIFT_UNITS = 64;

/** Resolve the vertical offset for a player source (hands). */
export function resolvePlayerSourceOffset(
    startHeight: number,
    sourceHeightOffset?: number,
): number {
    const base = Number.isFinite(sourceHeightOffset as number)
        ? Number(sourceHeightOffset)
        : Number(startHeight) | 0;
    return base + PLAYER_HAND_LIFT_UNITS;
}

/** Resolve the vertical offset for a player target (chest). */
export function resolvePlayerTargetOffset(endHeight: number, targetHeightOffset?: number): number {
    if (Number.isFinite(targetHeightOffset as number)) return Number(targetHeightOffset);
    // Player targets always use chest height, not endHeight.
    return PLAYER_CHEST_OFFSET_UNITS;
}

/** Compute a base Z from ground Z and a vertical offset. */
export function computeBaseZ(groundZ: number, offsetUnits: number): number {
    return (groundZ as number) - (offsetUnits as number);
}
