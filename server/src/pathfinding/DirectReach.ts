type EdgeWallChecker = {
    edgeHasWallBetween(ax: number, ay: number, bx: number, by: number, level: number): boolean;
};

export function hasDirectReachToArea(
    pathService: EdgeWallChecker,
    from: { x: number; y: number },
    tile: { x: number; y: number },
    sizeX: number,
    sizeY: number,
    level: number,
): boolean {
    const fx = from.x;
    const fy = from.y;
    const minX = tile.x;
    const minY = tile.y;
    const maxX = minX + Math.max(1, sizeX) - 1;
    const maxY = minY + Math.max(1, sizeY) - 1;

    if (fx >= minX && fx <= maxX && fy >= minY && fy <= maxY) {
        return true;
    }

    const clampedX = Math.max(minX, Math.min(fx, maxX));
    const clampedY = Math.max(minY, Math.min(fy, maxY));
    const dx = clampedX - fx;
    const dy = clampedY - fy;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (distance === 0) {
        return true;
    }
    if (distance > 1) {
        return false;
    }

    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const checkEdge = (ax: number, ay: number, bx: number, by: number) =>
        !pathService.edgeHasWallBetween(ax, ay, bx, by, level);

    if (stepX === 0 || stepY === 0) {
        return checkEdge(fx, fy, fx + stepX, fy + stepY);
    }

    const horizFirst =
        checkEdge(fx, fy, fx + stepX, fy) && checkEdge(fx + stepX, fy, fx + stepX, fy + stepY);
    const vertFirst =
        checkEdge(fx, fy, fx, fy + stepY) && checkEdge(fx, fy + stepY, fx + stepX, fy + stepY);
    return horizFirst || vertFirst;
}
