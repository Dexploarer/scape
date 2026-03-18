import { RAD_TO_RS_UNITS } from "../../rs/utils/rotation";

export { RAD_TO_RS_UNITS } from "../../rs/utils/rotation";
export const FACE_MIN_DIST_SQ = 16;

export function computeFacingRotation(dx: number, dy: number): number | undefined {
    const ix = dx | 0;
    const iy = dy | 0;
    if (ix * ix + iy * iy < FACE_MIN_DIST_SQ) return undefined;
    return ((Math.atan2(ix, iy) * RAD_TO_RS_UNITS) | 0) & 2047;
}

export function computeFacingRotationFromPositions(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): number | undefined {
    return computeFacingRotation(toX - fromX, toY - fromY);
}
