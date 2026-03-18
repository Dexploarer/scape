/**
 * OSRS Collision Flags - Shared between client and server
 *
 * 32-bit bitmask flags used for pathfinding and movement validation.
 *
 * Flag Categories:
 * 1. Wall/Object flags (0x1 - 0x100): Indicate presence of walls/objects
 * 2. Projectile blocker flags (0x200 - 0x20000): Block ranged attacks/LoS
 * 3. Floor flags (0x40000 - 0x200000): Floor decoration and blocking
 * 4. Route blocker flags (0x400000 - 0x40000000): Pathfinder-specific (550+ clients)
 *
 * Entity Occupation Flags (0x800000 - 0x2000000):
 * These flags are set/cleared dynamically when entities move.
 * NOTE: These intentionally overlap with ROUTE_BLOCKER flags because:
 * - Route blockers are only checked during path calculation
 * - Entity flags are only checked during movement validation
 * The pathfinder ignores entity flags entirely per OSRS behavior.
 *
 * References:
 * - https://oldschool.runescape.wiki/w/Pathfinding
 * - https://osrs-docs.com/docs/mechanics/entity-collision/
 */

// =============================================================================
// Base Flag Bits
// =============================================================================

export const CollisionFlagBits = {
    // Wall corner objects (pillars) - block diagonal movement
    WALL_NORTH_WEST: 0x1,
    WALL_NORTH: 0x2,
    WALL_NORTH_EAST: 0x4,
    WALL_EAST: 0x8,
    WALL_SOUTH_EAST: 0x10,
    WALL_SOUTH: 0x20,
    WALL_SOUTH_WEST: 0x40,
    WALL_WEST: 0x80,

    // Solid object on tile
    OBJECT: 0x100,

    // Projectile blocking walls (for ranged/magic LoS)
    WALL_NORTH_WEST_PROJECTILE_BLOCKER: 0x200,
    WALL_NORTH_PROJECTILE_BLOCKER: 0x400,
    WALL_NORTH_EAST_PROJECTILE_BLOCKER: 0x800,
    WALL_EAST_PROJECTILE_BLOCKER: 0x1000,
    WALL_SOUTH_EAST_PROJECTILE_BLOCKER: 0x2000,
    WALL_SOUTH_PROJECTILE_BLOCKER: 0x4000,
    WALL_SOUTH_WEST_PROJECTILE_BLOCKER: 0x8000,
    WALL_WEST_PROJECTILE_BLOCKER: 0x10000,
    OBJECT_PROJECTILE_BLOCKER: 0x20000,

    // Floor flags
    FLOOR_DECORATION: 0x40000,
    BLOCK_NPCS: 0x80000,
    BLOCK_PLAYERS: 0x100000,
    FLOOR: 0x200000,

    // Route blocker flags (pathfinder-specific, 550+ clients)
    // Used to allow routing through bankers, etc.
    WALL_NORTH_WEST_ROUTE_BLOCKER: 0x400000,
    WALL_NORTH_ROUTE_BLOCKER: 0x800000,
    WALL_NORTH_EAST_ROUTE_BLOCKER: 0x1000000,
    WALL_EAST_ROUTE_BLOCKER: 0x2000000,
    WALL_SOUTH_EAST_ROUTE_BLOCKER: 0x4000000,
    WALL_SOUTH_ROUTE_BLOCKER: 0x8000000,
    WALL_SOUTH_WEST_ROUTE_BLOCKER: 0x10000000,
    WALL_WEST_ROUTE_BLOCKER: 0x20000000,
    OBJECT_ROUTE_BLOCKER: 0x40000000,

    // ==========================================================================
    // Dynamic Entity Occupation Flags
    // ==========================================================================
    // These are set/cleared at runtime when entities move.
    // NOTE: These overlap with ROUTE_BLOCKER flags intentionally (see header).
    //
    // CRITICAL: When an entity leaves a tile, its flag is removed regardless
    // of whether another entity is still present. This enables entity stacking.
    // ==========================================================================

    /** Dynamic flag set when an NPC occupies a tile */
    OCCUPIED_NPC: 0x800000,

    /** Dynamic flag set when a player occupies a tile */
    OCCUPIED_PLAYER: 0x1000000,

    /** Dynamic flag for NPCs that block projectiles (gorillas, barricades, etc.) */
    OCCUPIED_PROJECTILE_BLOCKER: 0x2000000,
} as const;

// =============================================================================
// Combined Movement Masks
// =============================================================================

/**
 * Floor blocking mask - tiles with these flags block all movement.
 * OSRS initializes tiles with a blocked flag (0x1000000) but clears it when
 * terrain is decoded. Since we load terrain directly, we don't need that flag.
 */
const FLOOR_BLOCKED = CollisionFlagBits.FLOOR | CollisionFlagBits.FLOOR_DECORATION;

/** Combined entity occupation mask */
const OCCUPIED_ENTITY = CollisionFlagBits.OCCUPIED_NPC | CollisionFlagBits.OCCUPIED_PLAYER;

export const CollisionFlag = {
    ...CollisionFlagBits,

    FLOOR_BLOCKED,
    OCCUPIED_ENTITY,

    // Cardinal direction blocking (checks opposite wall + object + floor)
    BLOCK_WEST: CollisionFlagBits.WALL_EAST | CollisionFlagBits.OBJECT | FLOOR_BLOCKED,
    BLOCK_EAST: CollisionFlagBits.WALL_WEST | CollisionFlagBits.OBJECT | FLOOR_BLOCKED,
    BLOCK_SOUTH: CollisionFlagBits.WALL_NORTH | CollisionFlagBits.OBJECT | FLOOR_BLOCKED,
    BLOCK_NORTH: CollisionFlagBits.WALL_SOUTH | CollisionFlagBits.OBJECT | FLOOR_BLOCKED,

    // Diagonal direction blocking
    BLOCK_SOUTH_WEST:
        CollisionFlagBits.WALL_NORTH |
        CollisionFlagBits.WALL_NORTH_EAST |
        CollisionFlagBits.WALL_EAST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_EAST:
        CollisionFlagBits.WALL_NORTH_WEST |
        CollisionFlagBits.WALL_NORTH |
        CollisionFlagBits.WALL_WEST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_NORTH_WEST:
        CollisionFlagBits.WALL_EAST |
        CollisionFlagBits.WALL_SOUTH_EAST |
        CollisionFlagBits.WALL_SOUTH |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_NORTH_EAST:
        CollisionFlagBits.WALL_SOUTH |
        CollisionFlagBits.WALL_SOUTH_WEST |
        CollisionFlagBits.WALL_WEST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,

    // Multi-direction blocking (for large entities)
    BLOCK_NORTH_AND_SOUTH_EAST:
        CollisionFlagBits.WALL_NORTH |
        CollisionFlagBits.WALL_NORTH_EAST |
        CollisionFlagBits.WALL_EAST |
        CollisionFlagBits.WALL_SOUTH_EAST |
        CollisionFlagBits.WALL_SOUTH |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_NORTH_AND_SOUTH_WEST:
        CollisionFlagBits.WALL_NORTH_WEST |
        CollisionFlagBits.WALL_NORTH |
        CollisionFlagBits.WALL_SOUTH |
        CollisionFlagBits.WALL_SOUTH_WEST |
        CollisionFlagBits.WALL_WEST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_NORTH_EAST_AND_WEST:
        CollisionFlagBits.WALL_NORTH_WEST |
        CollisionFlagBits.WALL_NORTH |
        CollisionFlagBits.WALL_NORTH_EAST |
        CollisionFlagBits.WALL_EAST |
        CollisionFlagBits.WALL_WEST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_EAST_AND_WEST:
        CollisionFlagBits.WALL_EAST |
        CollisionFlagBits.WALL_SOUTH_EAST |
        CollisionFlagBits.WALL_SOUTH |
        CollisionFlagBits.WALL_SOUTH_WEST |
        CollisionFlagBits.WALL_WEST |
        CollisionFlagBits.OBJECT |
        FLOOR_BLOCKED,

    // Route blocker masks (pathfinder-specific)
    BLOCK_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_EAST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_EAST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_EAST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_AND_SOUTH_EAST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_AND_SOUTH_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_NORTH_EAST_AND_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_NORTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_NORTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
    BLOCK_SOUTH_EAST_AND_WEST_ROUTE_BLOCKER:
        CollisionFlagBits.WALL_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_EAST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_SOUTH_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.WALL_WEST_ROUTE_BLOCKER |
        CollisionFlagBits.OBJECT_ROUTE_BLOCKER |
        FLOOR_BLOCKED,
} as const;

export type CollisionFlagType = typeof CollisionFlag;
