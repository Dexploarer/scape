export function clampPlane(plane: number): number {
    return Math.max(0, Math.min(3, plane | 0));
}
