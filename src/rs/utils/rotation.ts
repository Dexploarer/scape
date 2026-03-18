import { RS_TO_RADIANS } from "../MathConstants";

// Shared OSRS angle scale: radians -> 0..2047
export const RAD_TO_RS_UNITS = 1 / RS_TO_RADIANS;

// Face from (fromX, fromY) toward (toX, toY) in world/subtile coords
export function faceAngleRs(fromX: number, fromY: number, toX: number, toY: number): number {
    const dx = (fromX | 0) - (toX | 0);
    const dy = (fromY | 0) - (toY | 0);
    if (dx === 0 && dy === 0) return 0;
    const angle = Math.atan2(dx, dy);
    return ((angle * RAD_TO_RS_UNITS) | 0) & 2047;
}
