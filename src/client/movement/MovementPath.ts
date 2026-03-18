import { MovementDirection, deltaToDirection, directionToDelta } from "../../shared/Direction";

export interface TileCoord {
    x: number;
    y: number;
}

export interface MovementStep {
    tile: TileCoord;
    direction: MovementDirection;
    run: boolean;
    /**
     * Per-step traversal flag mirroring OSRS `class231` ordinals:
     * 0 = slow (half-speed), 1 = walk, 2 = run (double-speed).
     */
    traversal?: number;
    // Optional synthetic turn-only step used to mirror vanilla per-turn pacing
    turn?: boolean;
}

export interface MovementPathOptions {
    running?: boolean;
    allowTeleport?: boolean;
    maxStepDistance?: number;
}

export class MovementPath {
    readonly from: TileCoord;
    readonly to: TileCoord;
    readonly steps: MovementStep[] = [];
    readonly isTeleport: boolean;

    constructor(from: TileCoord, to: TileCoord, steps: MovementStep[], isTeleport: boolean) {
        this.from = { x: from.x | 0, y: from.y | 0 };
        this.to = { x: to.x | 0, y: to.y | 0 };
        this.steps = steps;
        this.isTeleport = isTeleport;
    }

    get stepCount(): number {
        return this.steps.length;
    }

    get run(): boolean {
        return this.steps.some((step) => step.run);
    }
}

function clampStepDelta(delta: number): number {
    if (delta > 1) return 1;
    if (delta < -1) return -1;
    return delta | 0;
}

export function buildMovementPath(
    from: TileCoord,
    to: TileCoord,
    opts: MovementPathOptions = {},
): MovementPath {
    const fromTile = { x: from.x | 0, y: from.y | 0 };
    const toTile = { x: to.x | 0, y: to.y | 0 };

    if (fromTile.x === toTile.x && fromTile.y === toTile.y) {
        return new MovementPath(fromTile, toTile, [], false);
    }

    const dx = toTile.x - fromTile.x;
    const dy = toTile.y - fromTile.y;
    const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
    const maxStep = Math.max(
        1,
        typeof opts.maxStepDistance === "number" ? opts.maxStepDistance : 2,
    );

    if (chebyshev > maxStep && !opts.allowTeleport) {
        // Treat large jumps as teleports; no intermediate steps.
        return new MovementPath(fromTile, toTile, [], true);
    }

    const running = !!opts.running && chebyshev >= 2;
    const steps: MovementStep[] = [];

    let currX = fromTile.x;
    let currY = fromTile.y;

    // Build true diagonal movement path (OSRS allows diagonal movement)
    while (currX !== toTile.x || currY !== toTile.y) {
        const remainDx = toTile.x - currX;
        const remainDy = toTile.y - currY;

        // Move diagonally when possible, otherwise move in a single axis
        const stepDx = remainDx !== 0 ? clampStepDelta(remainDx) : 0;
        const stepDy = remainDy !== 0 ? clampStepDelta(remainDy) : 0;

        if (stepDx === 0 && stepDy === 0) break;

        const dir = deltaToDirection(stepDx, stepDy);
        if (dir === undefined) break;

        currX += stepDx;
        currY += stepDy;

        steps.push({
            tile: { x: currX, y: currY },
            direction: dir,
            run: running,
            traversal: running ? 2 : 1,
        });
    }

    return new MovementPath(fromTile, toTile, steps, false);
}

export function stepToDelta(step: MovementStep): { dx: number; dy: number } {
    return directionToDelta(step.direction);
}
