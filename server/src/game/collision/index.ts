/**
 * Collision System Exports
 *
 * OSRS-accurate collision handling including:
 * - Dynamic entity occupation tracking
 * - NPCs that ignore collision
 * - NPCs that block line of sight
 */

export {
    EntityCollisionService,
    entityCollisionService,
    EntityType,
    COLLISION_IGNORING_NPCS,
    LINE_OF_SIGHT_BLOCKING_NPCS,
    shouldIgnoreEntityCollision,
    shouldBlockLineOfSight,
} from "./EntityCollisionService";
