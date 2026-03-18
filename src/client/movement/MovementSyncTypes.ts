import type { TileCoord } from "./MovementPath";

export interface MovementUpdate {
    serverId: number;
    ecsIndex: number;
    subX?: number;
    subY?: number;
    x?: number;
    y?: number;
    level: number;
    running?: boolean;
    moved?: boolean;
    snap?: boolean;
    rotation?: number;
    orientation?: number;
    turned?: boolean;
    seq?: number;
    directions?: number[];
    traversals?: number[];
}

export interface MovementStateOptions {
    subX: number;
    subY: number;
    level: number;
    running: boolean;
    rotation?: number;
    orientation?: number;
    turned: boolean;
    moved: boolean;
}

export interface RegisterMovementEntity {
    serverId: number;
    ecsIndex: number;
    tile: TileCoord;
    level: number;
    subX: number;
    subY: number;
}
