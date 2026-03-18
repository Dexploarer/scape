/**
 * Unified direction system for OSRS movement.
 * Shared between client and server for consistent pathfinding and movement handling.
 *
 * OSRS coordinate system: North = +Y, South = -Y, East = +X, West = -X
 */

/**
 * Movement direction enum with values matching OSRS conventions.
 * Values 0-7 represent the 8 cardinal/diagonal directions.
 */
export enum MovementDirection {
    SouthWest = 0,
    South = 1,
    SouthEast = 2,
    West = 3,
    East = 4,
    NorthWest = 5,
    North = 6,
    NorthEast = 7,
}

/**
 * Bitwise direction flags used for pathfinding algorithms.
 * Can be combined to represent diagonal directions (e.g., NORTH | EAST = NORTH_EAST).
 */
export class DirectionFlag {
    static readonly NORTH: number = 0x1;
    static readonly EAST: number = 0x2;
    static readonly SOUTH: number = 0x4;
    static readonly WEST: number = 0x8;

    static readonly SOUTH_WEST: number = DirectionFlag.WEST | DirectionFlag.SOUTH;
    static readonly NORTH_WEST: number = DirectionFlag.WEST | DirectionFlag.NORTH;
    static readonly SOUTH_EAST: number = DirectionFlag.EAST | DirectionFlag.SOUTH;
    static readonly NORTH_EAST: number = DirectionFlag.EAST | DirectionFlag.NORTH;
}

// Lookup table: MovementDirection -> delta
const DIR_TO_DELTA: ReadonlyArray<{ dx: number; dy: number }> = [
    { dx: -1, dy: -1 }, // SouthWest (south = -Y)
    { dx: 0, dy: -1 }, // South
    { dx: 1, dy: -1 }, // SouthEast
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: 0 }, // East
    { dx: -1, dy: 1 }, // NorthWest (north = +Y)
    { dx: 0, dy: 1 }, // North
    { dx: 1, dy: 1 }, // NorthEast
];

// Lookup table: delta string -> MovementDirection
const DELTA_TO_DIR = new Map<string, MovementDirection>([
    ["-1,-1", MovementDirection.SouthWest],
    ["0,-1", MovementDirection.South],
    ["1,-1", MovementDirection.SouthEast],
    ["-1,0", MovementDirection.West],
    ["1,0", MovementDirection.East],
    ["-1,1", MovementDirection.NorthWest],
    ["0,1", MovementDirection.North],
    ["1,1", MovementDirection.NorthEast],
]);

// Lookup table: MovementDirection -> DirectionFlag
const DIR_TO_FLAG: ReadonlyArray<number> = [
    DirectionFlag.SOUTH_WEST, // SouthWest = 0
    DirectionFlag.SOUTH, // South = 1
    DirectionFlag.SOUTH_EAST, // SouthEast = 2
    DirectionFlag.WEST, // West = 3
    DirectionFlag.EAST, // East = 4
    DirectionFlag.NORTH_WEST, // NorthWest = 5
    DirectionFlag.NORTH, // North = 6
    DirectionFlag.NORTH_EAST, // NorthEast = 7
];

// Lookup table: DirectionFlag -> MovementDirection (for single flags and combinations)
const FLAG_TO_DIR = new Map<number, MovementDirection>([
    [DirectionFlag.SOUTH_WEST, MovementDirection.SouthWest],
    [DirectionFlag.SOUTH, MovementDirection.South],
    [DirectionFlag.SOUTH_EAST, MovementDirection.SouthEast],
    [DirectionFlag.WEST, MovementDirection.West],
    [DirectionFlag.EAST, MovementDirection.East],
    [DirectionFlag.NORTH_WEST, MovementDirection.NorthWest],
    [DirectionFlag.NORTH, MovementDirection.North],
    [DirectionFlag.NORTH_EAST, MovementDirection.NorthEast],
]);

/**
 * Returns the tile delta (dx, dy) for a given direction using OSRS walking semantics.
 */
export function directionToDelta(direction: MovementDirection): { dx: number; dy: number } {
    return DIR_TO_DELTA[direction] ?? { dx: 0, dy: 0 };
}

/**
 * Converts a tile delta (-1..1) pair to an OSRS movement direction, or undefined if zero.
 */
export function deltaToDirection(dx: number, dy: number): MovementDirection | undefined {
    const key = `${dx | 0},${dy | 0}`;
    return DELTA_TO_DIR.get(key);
}

/**
 * Converts a MovementDirection to its corresponding DirectionFlag.
 */
export function directionToFlag(direction: MovementDirection): number {
    return DIR_TO_FLAG[direction] ?? 0;
}

/**
 * Converts a DirectionFlag (or combination) to its corresponding MovementDirection.
 * Returns undefined if the flag doesn't represent a valid direction.
 */
export function flagToDirection(flag: number): MovementDirection | undefined {
    return FLAG_TO_DIR.get(flag);
}

/**
 * Converts a DirectionFlag to a tile delta.
 */
export function flagToDelta(flag: number): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    if ((flag & DirectionFlag.EAST) !== 0) dx = 1;
    else if ((flag & DirectionFlag.WEST) !== 0) dx = -1;

    if ((flag & DirectionFlag.NORTH) !== 0) dy = 1;
    else if ((flag & DirectionFlag.SOUTH) !== 0) dy = -1;

    return { dx, dy };
}

/**
 * Converts a tile delta to a DirectionFlag.
 */
export function deltaToFlag(dx: number, dy: number): number {
    let flag = 0;

    if (dx > 0) flag |= DirectionFlag.EAST;
    else if (dx < 0) flag |= DirectionFlag.WEST;

    if (dy > 0) flag |= DirectionFlag.NORTH;
    else if (dy < 0) flag |= DirectionFlag.SOUTH;

    return flag;
}

/**
 * OSRS `orientationAnglesByDirection`, indexed by MovementDirection.
 * Reference: `client.orientationAnglesByDirection = {768,1024,1280,512,1536,256,0,1792}`.
 * Angle basis used throughout this project:
 * North=0, NorthWest=256, West=512, SouthWest=768, South=1024, SouthEast=1280, East=1536, NorthEast=1792.
 */
export const DIRECTION_TO_ORIENTATION: ReadonlyArray<number> = [
    768, 1024, 1280, 512, 1536, 256, 0, 1792,
];

/**
 * Converts a direction into a 0..2047 orientation value compatible with client rotation logic.
 */
export function directionToOrientation(direction: MovementDirection): number {
    return DIRECTION_TO_ORIENTATION[direction] ?? 0;
}

/**
 * Determines whether the supplied direction represents diagonal movement.
 */
export function isDiagonal(direction: MovementDirection): boolean {
    switch (direction) {
        case MovementDirection.NorthWest:
        case MovementDirection.NorthEast:
        case MovementDirection.SouthWest:
        case MovementDirection.SouthEast:
            return true;
        default:
            return false;
    }
}

/**
 * Determines whether the supplied DirectionFlag represents diagonal movement.
 */
export function isFlagDiagonal(flag: number): boolean {
    const hasNS = (flag & (DirectionFlag.NORTH | DirectionFlag.SOUTH)) !== 0;
    const hasEW = (flag & (DirectionFlag.EAST | DirectionFlag.WEST)) !== 0;
    return hasNS && hasEW;
}

// Lookup table: combined run delta string -> 4-bit run direction code
// Used for player sync when encoding running movement (2 tiles per tick)
const RUN_DELTA_TO_CODE = new Map<string, number>([
    ["-2,-2", 0],
    ["-1,-2", 1],
    ["0,-2", 2],
    ["1,-2", 3],
    ["2,-2", 4],
    ["-2,-1", 5],
    ["2,-1", 6],
    ["-2,0", 7],
    ["2,0", 8],
    ["-2,1", 9],
    ["2,1", 10],
    ["-2,2", 11],
    ["-1,2", 12],
    ["0,2", 13],
    ["1,2", 14],
    ["2,2", 15],
]);

// Lookup table: 4-bit run direction code -> { delta, directions }
// Used for player sync when decoding running movement
const RUN_CODE_DATA: ReadonlyArray<{
    dx: number;
    dy: number;
    dir1: MovementDirection;
    dir2: MovementDirection;
}> = [
    { dx: -2, dy: -2, dir1: MovementDirection.SouthWest, dir2: MovementDirection.SouthWest }, // 0
    { dx: -1, dy: -2, dir1: MovementDirection.SouthWest, dir2: MovementDirection.South }, // 1
    { dx: 0, dy: -2, dir1: MovementDirection.South, dir2: MovementDirection.South }, // 2
    { dx: 1, dy: -2, dir1: MovementDirection.South, dir2: MovementDirection.SouthEast }, // 3
    { dx: 2, dy: -2, dir1: MovementDirection.SouthEast, dir2: MovementDirection.SouthEast }, // 4
    { dx: -2, dy: -1, dir1: MovementDirection.SouthWest, dir2: MovementDirection.West }, // 5
    { dx: 2, dy: -1, dir1: MovementDirection.SouthEast, dir2: MovementDirection.East }, // 6
    { dx: -2, dy: 0, dir1: MovementDirection.West, dir2: MovementDirection.West }, // 7
    { dx: 2, dy: 0, dir1: MovementDirection.East, dir2: MovementDirection.East }, // 8
    { dx: -2, dy: 1, dir1: MovementDirection.West, dir2: MovementDirection.NorthWest }, // 9
    { dx: 2, dy: 1, dir1: MovementDirection.East, dir2: MovementDirection.NorthEast }, // 10
    { dx: -2, dy: 2, dir1: MovementDirection.NorthWest, dir2: MovementDirection.NorthWest }, // 11
    { dx: -1, dy: 2, dir1: MovementDirection.North, dir2: MovementDirection.NorthWest }, // 12
    { dx: 0, dy: 2, dir1: MovementDirection.North, dir2: MovementDirection.North }, // 13
    { dx: 1, dy: 2, dir1: MovementDirection.North, dir2: MovementDirection.NorthEast }, // 14
    { dx: 2, dy: 2, dir1: MovementDirection.NorthEast, dir2: MovementDirection.NorthEast }, // 15
];

/**
 * Converts a combined run delta (-2..2) pair to a 4-bit run direction code.
 * Returns -1 if the delta doesn't represent a valid run direction.
 */
export function deltaToRunDirection(dx: number, dy: number): number {
    return RUN_DELTA_TO_CODE.get(`${dx | 0},${dy | 0}`) ?? -1;
}

/**
 * Converts a 4-bit run direction code to a combined run delta.
 * Returns undefined if the code is out of range.
 */
export function runDirectionToDelta(code: number): { dx: number; dy: number } | undefined {
    const data = RUN_CODE_DATA[code & 0xf];
    return data ? { dx: data.dx, dy: data.dy } : undefined;
}

/**
 * Converts a 4-bit run direction code to the two walk directions it comprises.
 * Returns undefined if the code is out of range.
 */
export function runDirectionToWalkDirections(
    code: number,
): [MovementDirection, MovementDirection] | undefined {
    const data = RUN_CODE_DATA[code & 0xf];
    return data ? [data.dir1, data.dir2] : undefined;
}
