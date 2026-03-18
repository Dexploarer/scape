/**
 * Handles wall collision flag operations for doors.
 * Updates the CollisionOverlayStore when doors open/close.
 */

import { CollisionFlag } from "../pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { CollisionOverlayStore } from "./CollisionOverlayStore";

/**
 * LocModelType values for walls/doors.
 * These match the values in LocType.ts
 */
export const LocModelType = {
    WALL: 0,
    WALL_DIAGONAL: 9,
    WALL_CORNER: 2,
    WALL_TRI_CORNER: 1,
    WALL_RECT_CORNER: 3,
} as const;

export type LocModelTypeValue = 0 | 1 | 2 | 3 | 9;

/**
 * Wall flag info for each rotation.
 * Rotation 0 = West wall, 1 = North wall, 2 = East wall, 3 = South wall.
 */
interface WallFlagInfo {
    /** Flag to set on the wall's tile */
    self: number;
    /** Flag to set on the neighboring tile (opposite side of wall) */
    neighbor: number;
    /** Projectile blocker flag for self tile */
    selfProj: number;
    /** Projectile blocker flag for neighbor tile */
    neighborProj: number;
    /** X offset to neighbor tile */
    dx: number;
    /** Y offset to neighbor tile */
    dy: number;
}

const WALL_FLAGS: Record<number, WallFlagInfo> = {
    0: { // West wall
        self: CollisionFlag.WALL_WEST,
        neighbor: CollisionFlag.WALL_EAST,
        selfProj: CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER,
        neighborProj: CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER,
        dx: -1,
        dy: 0,
    },
    1: { // North wall
        self: CollisionFlag.WALL_NORTH,
        neighbor: CollisionFlag.WALL_SOUTH,
        selfProj: CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER,
        neighborProj: CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER,
        dx: 0,
        dy: 1,
    },
    2: { // East wall
        self: CollisionFlag.WALL_EAST,
        neighbor: CollisionFlag.WALL_WEST,
        selfProj: CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER,
        neighborProj: CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER,
        dx: 1,
        dy: 0,
    },
    3: { // South wall
        self: CollisionFlag.WALL_SOUTH,
        neighbor: CollisionFlag.WALL_NORTH,
        selfProj: CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER,
        neighborProj: CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER,
        dx: 0,
        dy: -1,
    },
};

/**
 * Diagonal wall corner flags.
 * These affect two adjacent edges.
 */
const WALL_CORNER_FLAGS: Record<number, { flags: number; projFlags: number }> = {
    0: { // NW corner
        flags: CollisionFlag.WALL_NORTH_WEST,
        projFlags: CollisionFlag.WALL_NORTH_WEST_PROJECTILE_BLOCKER,
    },
    1: { // NE corner
        flags: CollisionFlag.WALL_NORTH_EAST,
        projFlags: CollisionFlag.WALL_NORTH_EAST_PROJECTILE_BLOCKER,
    },
    2: { // SE corner
        flags: CollisionFlag.WALL_SOUTH_EAST,
        projFlags: CollisionFlag.WALL_SOUTH_EAST_PROJECTILE_BLOCKER,
    },
    3: { // SW corner
        flags: CollisionFlag.WALL_SOUTH_WEST,
        projFlags: CollisionFlag.WALL_SOUTH_WEST_PROJECTILE_BLOCKER,
    },
};

export class DoorCollisionService {
    constructor(private overlayStore: CollisionOverlayStore) {}

    /**
     * Remove wall collision flags for a door at the given position and rotation.
     * Call this when a door is OPENED (collision should be removed).
     */
    removeWallCollision(
        x: number,
        y: number,
        level: number,
        rotation: number,
        locType: LocModelTypeValue,
        blocksProjectile: boolean
    ): void {
        const rot = rotation & 3;

        if (locType === LocModelType.WALL) {
            const info = WALL_FLAGS[rot];
            if (!info) return;

            // Remove flags from self tile
            this.overlayStore.removeFlags(x, y, level, info.self);
            // Remove flags from neighbor tile
            this.overlayStore.removeFlags(x + info.dx, y + info.dy, level, info.neighbor);

            if (blocksProjectile) {
                this.overlayStore.removeFlags(x, y, level, info.selfProj);
                this.overlayStore.removeFlags(x + info.dx, y + info.dy, level, info.neighborProj);
            }
        } else if (locType === LocModelType.WALL_DIAGONAL) {
            // Diagonal walls block movement along a diagonal line
            const info = WALL_CORNER_FLAGS[rot];
            if (!info) return;
            this.overlayStore.removeFlags(x, y, level, info.flags);
            if (blocksProjectile) {
                this.overlayStore.removeFlags(x, y, level, info.projFlags);
            }
        } else if (locType === LocModelType.WALL_CORNER) {
            // Wall corner - affects two directions
            this.removeWallCornerCollision(x, y, level, rot, blocksProjectile);
        } else if (locType === LocModelType.WALL_TRI_CORNER) {
            // Tri-corner (L-shaped wall segment)
            this.removeWallTriCornerCollision(x, y, level, rot, blocksProjectile);
        } else if (locType === LocModelType.WALL_RECT_CORNER) {
            // Rectangular corner
            this.removeWallRectCornerCollision(x, y, level, rot, blocksProjectile);
        }
    }

    /**
     * Add wall collision flags for a door at the given position and rotation.
     * Call this when a door is CLOSED (collision should be added).
     */
    addWallCollision(
        x: number,
        y: number,
        level: number,
        rotation: number,
        locType: LocModelTypeValue,
        blocksProjectile: boolean
    ): void {
        const rot = rotation & 3;

        if (locType === LocModelType.WALL) {
            const info = WALL_FLAGS[rot];
            if (!info) return;

            // Add flags to self tile
            this.overlayStore.addFlags(x, y, level, info.self);
            // Add flags to neighbor tile
            this.overlayStore.addFlags(x + info.dx, y + info.dy, level, info.neighbor);

            if (blocksProjectile) {
                this.overlayStore.addFlags(x, y, level, info.selfProj);
                this.overlayStore.addFlags(x + info.dx, y + info.dy, level, info.neighborProj);
            }
        } else if (locType === LocModelType.WALL_DIAGONAL) {
            const info = WALL_CORNER_FLAGS[rot];
            if (!info) return;
            this.overlayStore.addFlags(x, y, level, info.flags);
            if (blocksProjectile) {
                this.overlayStore.addFlags(x, y, level, info.projFlags);
            }
        } else if (locType === LocModelType.WALL_CORNER) {
            this.addWallCornerCollision(x, y, level, rot, blocksProjectile);
        } else if (locType === LocModelType.WALL_TRI_CORNER) {
            this.addWallTriCornerCollision(x, y, level, rot, blocksProjectile);
        } else if (locType === LocModelType.WALL_RECT_CORNER) {
            this.addWallRectCornerCollision(x, y, level, rot, blocksProjectile);
        }
    }

    // === Wall Corner (Type 2) ===
    // Blocks diagonal movement through a corner

    private removeWallCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        const info = WALL_CORNER_FLAGS[rotation];
        if (!info) return;
        this.overlayStore.removeFlags(x, y, level, info.flags);
        if (blocksProjectile) {
            this.overlayStore.removeFlags(x, y, level, info.projFlags);
        }
    }

    private addWallCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        const info = WALL_CORNER_FLAGS[rotation];
        if (!info) return;
        this.overlayStore.addFlags(x, y, level, info.flags);
        if (blocksProjectile) {
            this.overlayStore.addFlags(x, y, level, info.projFlags);
        }
    }

    // === Wall Tri-Corner (Type 1) ===
    // L-shaped wall segment affecting two adjacent walls

    private removeWallTriCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        // Tri-corner affects two adjacent cardinal directions
        switch (rotation) {
            case 0: // NW - blocks north and west
                this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_NORTH | CollisionFlag.WALL_WEST);
                this.overlayStore.removeFlags(x, y + 1, level, CollisionFlag.WALL_SOUTH);
                this.overlayStore.removeFlags(x - 1, y, level, CollisionFlag.WALL_EAST);
                if (blocksProjectile) {
                    this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER);
                }
                break;
            case 1: // NE - blocks north and east
                this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_NORTH | CollisionFlag.WALL_EAST);
                this.overlayStore.removeFlags(x, y + 1, level, CollisionFlag.WALL_SOUTH);
                this.overlayStore.removeFlags(x + 1, y, level, CollisionFlag.WALL_WEST);
                if (blocksProjectile) {
                    this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER);
                }
                break;
            case 2: // SE - blocks south and east
                this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_SOUTH | CollisionFlag.WALL_EAST);
                this.overlayStore.removeFlags(x, y - 1, level, CollisionFlag.WALL_NORTH);
                this.overlayStore.removeFlags(x + 1, y, level, CollisionFlag.WALL_WEST);
                if (blocksProjectile) {
                    this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER);
                }
                break;
            case 3: // SW - blocks south and west
                this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_SOUTH | CollisionFlag.WALL_WEST);
                this.overlayStore.removeFlags(x, y - 1, level, CollisionFlag.WALL_NORTH);
                this.overlayStore.removeFlags(x - 1, y, level, CollisionFlag.WALL_EAST);
                if (blocksProjectile) {
                    this.overlayStore.removeFlags(x, y, level, CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER);
                }
                break;
        }
    }

    private addWallTriCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        switch (rotation) {
            case 0:
                this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_NORTH | CollisionFlag.WALL_WEST);
                this.overlayStore.addFlags(x, y + 1, level, CollisionFlag.WALL_SOUTH);
                this.overlayStore.addFlags(x - 1, y, level, CollisionFlag.WALL_EAST);
                if (blocksProjectile) {
                    this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER);
                }
                break;
            case 1:
                this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_NORTH | CollisionFlag.WALL_EAST);
                this.overlayStore.addFlags(x, y + 1, level, CollisionFlag.WALL_SOUTH);
                this.overlayStore.addFlags(x + 1, y, level, CollisionFlag.WALL_WEST);
                if (blocksProjectile) {
                    this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER);
                }
                break;
            case 2:
                this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_SOUTH | CollisionFlag.WALL_EAST);
                this.overlayStore.addFlags(x, y - 1, level, CollisionFlag.WALL_NORTH);
                this.overlayStore.addFlags(x + 1, y, level, CollisionFlag.WALL_WEST);
                if (blocksProjectile) {
                    this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER);
                }
                break;
            case 3:
                this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_SOUTH | CollisionFlag.WALL_WEST);
                this.overlayStore.addFlags(x, y - 1, level, CollisionFlag.WALL_NORTH);
                this.overlayStore.addFlags(x - 1, y, level, CollisionFlag.WALL_EAST);
                if (blocksProjectile) {
                    this.overlayStore.addFlags(x, y, level, CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER | CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER);
                }
                break;
        }
    }

    // === Wall Rect Corner (Type 3) ===
    // Rectangular corner - similar to tri-corner but takes full space

    private removeWallRectCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        // Same as tri-corner for collision purposes
        this.removeWallTriCornerCollision(x, y, level, rotation, blocksProjectile);
    }

    private addWallRectCornerCollision(x: number, y: number, level: number, rotation: number, blocksProjectile: boolean): void {
        this.addWallTriCornerCollision(x, y, level, rotation, blocksProjectile);
    }

    /**
     * Get wall flags for a rotation (for debugging).
     */
    getWallFlagsForRotation(rotation: number): WallFlagInfo | undefined {
        return WALL_FLAGS[rotation & 3];
    }
}
