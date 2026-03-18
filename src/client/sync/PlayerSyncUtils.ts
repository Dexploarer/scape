export function toSubCoordinates(
    tileX: number,
    tileY: number,
    fallbackSubX?: number,
    fallbackSubY?: number,
): { subX: number; subY: number } {
    const subX = fallbackSubX !== undefined ? fallbackSubX : (tileX << 7) + 64;
    const subY = fallbackSubY !== undefined ? fallbackSubY : (tileY << 7) + 64;
    return { subX, subY };
}
