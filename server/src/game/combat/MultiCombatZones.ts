/**
 * Multi-Combat Zone System
 *
 * In OSRS:
 * - Single-combat zones: Only one attacker at a time per target
 * - Multi-combat zones: Multiple attackers can attack the same target
 * - Wilderness has specific multi-combat areas
 * - Most boss arenas are multi-combat
 */
import { Actor } from "../actor";
import { NpcState } from "../npc";
import { PlayerState } from "../player";

// Type aliases for compatibility
type Npc = NpcState;
type Player = PlayerState;

// Rectangle-based zone definition
interface CombatZone {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    plane: number;
    isMultiCombat: boolean;
    name?: string;
}

// Chunk-based multi-combat data (from game data)
// Format: regionId -> Set of local coordinates that are multi
const MULTI_COMBAT_CHUNKS = new Map<number, Set<number>>();

// Major multi-combat zones (rectangles for key areas)
const MULTI_COMBAT_ZONES: CombatZone[] = [
    // Wilderness multi-combat areas
    {
        minX: 3136,
        minY: 3520,
        maxX: 3327,
        maxY: 3903,
        plane: 0,
        isMultiCombat: true,
        name: "Deep Wilderness",
    },
    {
        minX: 3008,
        minY: 3856,
        maxX: 3071,
        maxY: 3903,
        plane: 0,
        isMultiCombat: true,
        name: "Mage Arena",
    },
    {
        minX: 3072,
        minY: 3904,
        maxX: 3135,
        maxY: 3967,
        plane: 0,
        isMultiCombat: true,
        name: "Rogues Castle",
    },
    {
        minX: 3200,
        minY: 3840,
        maxX: 3263,
        maxY: 3903,
        plane: 0,
        isMultiCombat: true,
        name: "Revenant Caves Entrance",
    },

    // Revenant Caves (full area)
    {
        minX: 3136,
        minY: 10048,
        maxX: 3263,
        maxY: 10175,
        plane: 0,
        isMultiCombat: true,
        name: "Revenant Caves",
    },

    // God Wars Dungeon
    {
        minX: 2816,
        minY: 5248,
        maxX: 2943,
        maxY: 5375,
        plane: 0,
        isMultiCombat: true,
        name: "God Wars Dungeon",
    },

    // Corporeal Beast
    {
        minX: 2944,
        minY: 4352,
        maxX: 3007,
        maxY: 4415,
        plane: 2,
        isMultiCombat: true,
        name: "Corporeal Beast Lair",
    },

    // Chambers of Xeric
    {
        minX: 3200,
        minY: 5696,
        maxX: 3391,
        maxY: 5887,
        plane: 0,
        isMultiCombat: true,
        name: "Chambers of Xeric",
    },

    // Theatre of Blood
    {
        minX: 3136,
        minY: 4288,
        maxX: 3327,
        maxY: 4479,
        plane: 0,
        isMultiCombat: true,
        name: "Theatre of Blood",
    },

    // Nightmare arena
    {
        minX: 3840,
        minY: 9920,
        maxX: 3903,
        maxY: 9983,
        plane: 0,
        isMultiCombat: true,
        name: "The Nightmare Arena",
    },

    // Dagannoth Kings
    {
        minX: 2880,
        minY: 4416,
        maxX: 2943,
        maxY: 4479,
        plane: 0,
        isMultiCombat: true,
        name: "Dagannoth Kings Lair",
    },

    // Giant Mole
    {
        minX: 1728,
        minY: 5120,
        maxX: 1791,
        maxY: 5247,
        plane: 0,
        isMultiCombat: true,
        name: "Giant Mole Lair",
    },

    // Kalphite Queen
    {
        minX: 3456,
        minY: 9472,
        maxX: 3519,
        maxY: 9535,
        plane: 0,
        isMultiCombat: true,
        name: "Kalphite Queen Lair",
    },

    // King Black Dragon
    {
        minX: 2240,
        minY: 4672,
        maxX: 2303,
        maxY: 4735,
        plane: 0,
        isMultiCombat: true,
        name: "King Black Dragon Lair",
    },

    // Vorkath
    {
        minX: 2240,
        minY: 4032,
        maxX: 2303,
        maxY: 4095,
        plane: 0,
        isMultiCombat: true,
        name: "Vorkath Island",
    },

    // Zulrah shrine (single combat boss arena)
    {
        minX: 2256,
        minY: 3056,
        maxX: 2287,
        maxY: 3087,
        plane: 0,
        isMultiCombat: false,
        name: "Zulrah Shrine",
    },

    // Pest Control islands
    {
        minX: 2624,
        minY: 2560,
        maxX: 2751,
        maxY: 2623,
        plane: 0,
        isMultiCombat: true,
        name: "Pest Control",
    },

    // Nightmare Zone
    {
        minX: 2432,
        minY: 4608,
        maxX: 2559,
        maxY: 4735,
        plane: 0,
        isMultiCombat: true,
        name: "Nightmare Zone",
    },

    // TzHaar Fight Cave
    {
        minX: 2368,
        minY: 5056,
        maxX: 2431,
        maxY: 5119,
        plane: 0,
        isMultiCombat: true,
        name: "Fight Cave",
    },

    // Inferno
    {
        minX: 2240,
        minY: 5312,
        maxX: 2303,
        maxY: 5375,
        plane: 0,
        isMultiCombat: true,
        name: "The Inferno",
    },

    // Catacombs of Kourend
    {
        minX: 1600,
        minY: 9984,
        maxX: 1727,
        maxY: 10111,
        plane: 0,
        isMultiCombat: true,
        name: "Catacombs of Kourend",
    },

    // Slayer Tower basement
    {
        minX: 3392,
        minY: 9920,
        maxX: 3455,
        maxY: 9983,
        plane: 0,
        isMultiCombat: true,
        name: "Slayer Tower Basement",
    },

    // Castle Wars
    {
        minX: 2368,
        minY: 3072,
        maxX: 2431,
        maxY: 3135,
        plane: 0,
        isMultiCombat: true,
        name: "Castle Wars",
    },

    // Soul Wars
    {
        minX: 2112,
        minY: 2880,
        maxX: 2239,
        maxY: 3007,
        plane: 0,
        isMultiCombat: true,
        name: "Soul Wars",
    },

    // Barbarian Assault
    {
        minX: 2512,
        minY: 3520,
        maxX: 2623,
        maxY: 3583,
        plane: 0,
        isMultiCombat: true,
        name: "Barbarian Assault",
    },
];

// Combat engagement tracking
interface CombatEngagement {
    attacker: Actor;
    defender: Actor;
    lastAttackTick: number;
}

export class MultiCombatSystem {
    // Track who is attacking whom
    private engagements: Map<Actor, CombatEngagement[]> = new Map();

    // Ticks until combat engagement expires (16 ticks = ~10 seconds)
    private static readonly COMBAT_ENGAGEMENT_TIMEOUT = 16;

    /**
     * Check if a position is in a multi-combat zone
     */
    isMultiCombat(x: number, y: number, plane: number): boolean {
        // First check rectangle zones
        for (const zone of MULTI_COMBAT_ZONES) {
            if (
                zone.plane === plane &&
                x >= zone.minX &&
                x <= zone.maxX &&
                y >= zone.minY &&
                y <= zone.maxY
            ) {
                return zone.isMultiCombat;
            }
        }

        // Check chunk-based data
        const regionId = ((x >> 6) << 8) | (y >> 6);
        const localCoord = ((x & 63) << 6) | (y & 63);

        const regionMultis = MULTI_COMBAT_CHUNKS.get(regionId);
        if (regionMultis?.has(localCoord)) {
            return true;
        }

        // Default to single combat
        return false;
    }

    /**
     * Check if actor is in multi-combat zone
     */
    actorInMultiCombat(actor: Actor): boolean {
        return this.isMultiCombat(actor.x, actor.y, actor.level);
    }

    /**
     * Check if an attack is allowed based on combat zone rules
     *
     * In single combat:
     * - You can only attack if the target isn't already in combat with someone else
     * - You can only attack if you aren't already in combat with someone else
     *
     * In multi combat:
     * - Multiple entities can attack the same target
     */
    canAttack(
        attacker: Actor,
        defender: Actor,
        currentTick: number,
    ): { allowed: boolean; reason?: string } {
        // Multi-combat zones allow any attack
        if (this.actorInMultiCombat(attacker) && this.actorInMultiCombat(defender)) {
            return { allowed: true };
        }

        // Clean up expired engagements
        this.cleanupEngagements(currentTick);

        // Check if defender is already in combat with someone else
        const defenderEngagements = this.getActiveEngagements(defender, currentTick);
        for (const engagement of defenderEngagements) {
            if (engagement.attacker !== attacker) {
                return {
                    allowed: false,
                    reason: "That target is already in combat.",
                };
            }
        }

        // Check if attacker is already in combat with someone else
        const attackerEngagements = this.getActiveEngagements(attacker, currentTick);
        for (const engagement of attackerEngagements) {
            if (engagement.defender !== defender) {
                return {
                    allowed: false,
                    reason: "You are already under attack!",
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Record a combat engagement
     */
    recordEngagement(attacker: Actor, defender: Actor, currentTick: number): void {
        // Get or create engagement list for attacker
        let attackerEngagements = this.engagements.get(attacker);
        if (!attackerEngagements) {
            attackerEngagements = [];
            this.engagements.set(attacker, attackerEngagements);
        }

        // Update or add engagement
        const existing = attackerEngagements.find((e) => e.defender === defender);
        if (existing) {
            existing.lastAttackTick = currentTick;
        } else {
            attackerEngagements.push({
                attacker,
                defender,
                lastAttackTick: currentTick,
            });
        }

        // Also record reverse engagement (defender knows they're being attacked)
        let defenderEngagements = this.engagements.get(defender);
        if (!defenderEngagements) {
            defenderEngagements = [];
            this.engagements.set(defender, defenderEngagements);
        }

        const reverseExisting = defenderEngagements.find((e) => e.attacker === attacker);
        if (reverseExisting) {
            reverseExisting.lastAttackTick = currentTick;
        } else {
            defenderEngagements.push({
                attacker,
                defender,
                lastAttackTick: currentTick,
            });
        }
    }

    /**
     * Get active engagements for an actor
     */
    private getActiveEngagements(actor: Actor, currentTick: number): CombatEngagement[] {
        const engagements = this.engagements.get(actor) || [];
        return engagements.filter(
            (e) => currentTick - e.lastAttackTick < MultiCombatSystem.COMBAT_ENGAGEMENT_TIMEOUT,
        );
    }

    /**
     * Clean up expired engagements
     */
    private cleanupEngagements(currentTick: number): void {
        for (const [actor, engagements] of this.engagements) {
            const active = engagements.filter(
                (e) => currentTick - e.lastAttackTick < MultiCombatSystem.COMBAT_ENGAGEMENT_TIMEOUT,
            );

            if (active.length === 0) {
                this.engagements.delete(actor);
            } else {
                this.engagements.set(actor, active);
            }
        }
    }

    /**
     * Remove all engagements for a dead/despawned actor
     */
    removeActor(actor: Actor): void {
        this.engagements.delete(actor);

        // Also remove from other actors' engagement lists
        for (const [otherActor, engagements] of this.engagements) {
            const filtered = engagements.filter(
                (e) => e.attacker !== actor && e.defender !== actor,
            );

            if (filtered.length !== engagements.length) {
                if (filtered.length === 0) {
                    this.engagements.delete(otherActor);
                } else {
                    this.engagements.set(otherActor, filtered);
                }
            }
        }
    }

    /**
     * Check if actor is currently in combat
     */
    isInCombat(actor: Actor, currentTick: number): boolean {
        const engagements = this.getActiveEngagements(actor, currentTick);
        return engagements.length > 0;
    }

    /**
     * Get the last attacker for retaliation targeting
     */
    getLastAttacker(actor: Actor, currentTick: number): Actor | null {
        const engagements = this.getActiveEngagements(actor, currentTick);
        if (engagements.length === 0) return null;

        // Find the most recent attack where this actor was the defender
        let mostRecent: CombatEngagement | null = null;
        for (const engagement of engagements) {
            if (engagement.defender === actor) {
                if (!mostRecent || engagement.lastAttackTick > mostRecent.lastAttackTick) {
                    mostRecent = engagement;
                }
            }
        }

        return mostRecent?.attacker ?? null;
    }

    /**
     * Get all current attackers of an actor
     */
    getAttackers(actor: Actor, currentTick: number): Actor[] {
        const engagements = this.getActiveEngagements(actor, currentTick);
        return engagements.filter((e) => e.defender === actor).map((e) => e.attacker);
    }

    /**
     * Get current target of an actor
     */
    getCurrentTarget(actor: Actor, currentTick: number): Actor | null {
        const engagements = this.getActiveEngagements(actor, currentTick);
        const asAttacker = engagements.filter((e) => e.attacker === actor);

        if (asAttacker.length === 0) return null;

        // Return most recently attacked target
        let mostRecent = asAttacker[0];
        for (const engagement of asAttacker) {
            if (engagement.lastAttackTick > mostRecent.lastAttackTick) {
                mostRecent = engagement;
            }
        }

        return mostRecent.defender;
    }

    /**
     * Get combat zone name at position (for UI display)
     */
    getZoneName(x: number, y: number, plane: number): string | null {
        for (const zone of MULTI_COMBAT_ZONES) {
            if (
                zone.plane === plane &&
                x >= zone.minX &&
                x <= zone.maxX &&
                y >= zone.minY &&
                y <= zone.maxY
            ) {
                return zone.name ?? null;
            }
        }
        return null;
    }

    /**
     * Load multi-combat chunk data from cache/file
     */
    loadChunkData(data: Map<number, number[]>): void {
        MULTI_COMBAT_CHUNKS.clear();
        for (const [regionId, coords] of data) {
            MULTI_COMBAT_CHUNKS.set(regionId, new Set(coords));
        }
    }
}

// Singleton instance
export const multiCombatSystem = new MultiCombatSystem();

/**
 * OSRS Wilderness boundaries.
 * The Wilderness spans from Y=3520 (level 1) to Y=3966 (level 56).
 * X ranges from 2944 to 3391 approximately.
 *
 * Formula: Wilderness level = (Y - 3520) / 8 + 1
 */
const WILDERNESS_MIN_X = 2944;
const WILDERNESS_MAX_X = 3391;
const WILDERNESS_MIN_Y = 3520;
const WILDERNESS_MAX_Y = 3966;

/**
 * Check if a position is in the Wilderness.
 * OSRS: Items dropped in wilderness are immediately visible to all players.
 */
export function isInWilderness(x: number, y: number): boolean {
    return (
        x >= WILDERNESS_MIN_X &&
        x <= WILDERNESS_MAX_X &&
        y >= WILDERNESS_MIN_Y &&
        y <= WILDERNESS_MAX_Y
    );
}

/**
 * Get the Wilderness level at a position.
 * Returns 0 if not in wilderness.
 */
export function getWildernessLevel(x: number, y: number): number {
    if (!isInWilderness(x, y)) return 0;
    return Math.floor((y - WILDERNESS_MIN_Y) / 8) + 1;
}

// ========== RAID ZONE DETECTION ==========

/** Chambers of Xeric (CoX) boundaries */
const COX_MIN_X = 3200;
const COX_MAX_X = 3391;
const COX_MIN_Y = 5696;
const COX_MAX_Y = 5887;

/** Theatre of Blood (ToB) boundaries */
const TOB_MIN_X = 3136;
const TOB_MAX_X = 3391;
const TOB_MIN_Y = 4288;
const TOB_MAX_Y = 4479;

/** Tombs of Amascut (ToA) boundaries - approximate */
const TOA_MIN_X = 3392;
const TOA_MAX_X = 3519;
const TOA_MIN_Y = 5120;
const TOA_MAX_Y = 5247;

/**
 * Check if a position is in a raid instance (CoX, ToB, ToA).
 */
export function isInRaid(x: number, y: number, plane: number): boolean {
    // Chambers of Xeric
    if (x >= COX_MIN_X && x <= COX_MAX_X && y >= COX_MIN_Y && y <= COX_MAX_Y && plane === 0) {
        return true;
    }
    // Theatre of Blood
    if (x >= TOB_MIN_X && x <= TOB_MAX_X && y >= TOB_MIN_Y && y <= TOB_MAX_Y && plane === 0) {
        return true;
    }
    // Tombs of Amascut
    if (x >= TOA_MIN_X && x <= TOA_MAX_X && y >= TOA_MIN_Y && y <= TOA_MAX_Y && plane === 0) {
        return true;
    }
    return false;
}

// ========== LMS ZONE DETECTION ==========

/** Last Man Standing lobby and arena boundaries */
const LMS_LOBBY_MIN_X = 3136;
const LMS_LOBBY_MAX_X = 3199;
const LMS_LOBBY_MIN_Y = 3584;
const LMS_LOBBY_MAX_Y = 3647;

/** LMS arena (Deserted Island) - instanced area */
const LMS_ARENA_MIN_X = 3392;
const LMS_ARENA_MAX_X = 3519;
const LMS_ARENA_MIN_Y = 5632;
const LMS_ARENA_MAX_Y = 5759;

/**
 * Check if a position is in Last Man Standing.
 */
export function isInLMS(x: number, y: number, plane: number): boolean {
    // LMS Lobby
    if (
        x >= LMS_LOBBY_MIN_X &&
        x <= LMS_LOBBY_MAX_X &&
        y >= LMS_LOBBY_MIN_Y &&
        y <= LMS_LOBBY_MAX_Y &&
        plane === 0
    ) {
        return true;
    }
    // LMS Arena (Deserted Island)
    if (
        x >= LMS_ARENA_MIN_X &&
        x <= LMS_ARENA_MAX_X &&
        y >= LMS_ARENA_MIN_Y &&
        y <= LMS_ARENA_MAX_Y &&
        plane === 0
    ) {
        return true;
    }
    return false;
}

/**
 * Check if a position is in any PvP-enabled area.
 * Used to determine if special attack orb should show PvP mode.
 */
export function isInPvPArea(x: number, y: number, plane: number): boolean {
    // Wilderness is a PvP area
    if (isInWilderness(x, y)) {
        return true;
    }
    // LMS is a PvP area (when in arena, not lobby)
    if (
        x >= LMS_ARENA_MIN_X &&
        x <= LMS_ARENA_MAX_X &&
        y >= LMS_ARENA_MIN_Y &&
        y <= LMS_ARENA_MAX_Y &&
        plane === 0
    ) {
        return true;
    }
    // TODO: Add PvP world detection when implemented
    // TODO: Add Duel Arena detection when implemented
    return false;
}
