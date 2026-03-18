// Spell side effects system for freeze, bind, teleblock, etc.
// Reference: docs/osrs-mechanics.md, docs/pvp-mechanics.md

/**
 * OSRS Freeze Mechanics:
 * - After a freeze ends, the target has 5 ticks of freeze immunity
 * - Protection prayers reduce freeze duration by 50% (half-freeze)
 * - Freeze prevents all movement but not attacks
 */
export const FREEZE_IMMUNITY_TICKS = 5;

export type StatusEffect = {
    type: "freeze" | "bind" | "teleblock" | "poison" | "venom";
    endTick: number; // Tick when the effect expires
    power?: number; // For effects like poison/venom
};

export type EntityStatusEffects = {
    freeze?: StatusEffect;
    bind?: StatusEffect;
    teleblock?: StatusEffect;
    poison?: StatusEffect;
    venom?: StatusEffect;
    /** Tick when freeze immunity expires (5 ticks after freeze ends) */
    freezeImmunityUntilTick?: number;
};

/**
 * Manages status effects for players and NPCs
 */
export class SpellEffectsManager {
    private playerEffects: Map<number, EntityStatusEffects> = new Map();
    private npcEffects: Map<number, EntityStatusEffects> = new Map();

    /**
     * Apply a freeze effect to an entity
     * @param entityType "player" or "npc"
     * @param entityId Entity ID
     * @param durationTicks Base freeze duration in ticks
     * @param currentTick Current game tick
     * @param hasProtectionPrayer If true, duration is halved (OSRS half-freeze mechanic)
     * @returns true if freeze was applied, false if immune
     */
    applyFreeze(
        entityType: "player" | "npc",
        entityId: number,
        durationTicks: number,
        currentTick: number,
        hasProtectionPrayer: boolean = false,
    ): boolean {
        const effects = this.getEffects(entityType, entityId);

        // Check freeze immunity (5 ticks after previous freeze ended)
        if (effects.freezeImmunityUntilTick && currentTick < effects.freezeImmunityUntilTick) {
            return false; // Still immune
        }

        // Clear expired immunity
        if (effects.freezeImmunityUntilTick && currentTick >= effects.freezeImmunityUntilTick) {
            delete effects.freezeImmunityUntilTick;
        }

        // Apply half-freeze if target has protection prayer active
        const actualDuration = hasProtectionPrayer ? Math.floor(durationTicks / 2) : durationTicks;

        const endTick = currentTick + actualDuration;

        // Only apply if not already frozen or if new duration is longer
        if (!effects.freeze || effects.freeze.endTick < endTick) {
            effects.freeze = {
                type: "freeze",
                endTick,
            };
            return true;
        }

        return false;
    }

    /**
     * Apply a bind effect to an entity (no immunity, can stack with freeze)
     */
    applyBind(
        entityType: "player" | "npc",
        entityId: number,
        durationTicks: number,
        currentTick: number,
        hasProtectionPrayer: boolean = false,
    ): void {
        const effects = this.getEffects(entityType, entityId);

        // Apply half-bind if target has protection prayer active
        const actualDuration = hasProtectionPrayer ? Math.floor(durationTicks / 2) : durationTicks;

        const endTick = currentTick + actualDuration;

        // Only apply if not already bound or if new duration is longer
        if (!effects.bind || effects.bind.endTick < endTick) {
            effects.bind = {
                type: "bind",
                endTick,
            };
        }
    }

    /**
     * Apply a teleblock effect to a player
     * Duration is halved if protect from magic is active
     */
    applyTeleblock(
        playerId: number,
        durationTicks: number,
        currentTick: number,
        hasProtectFromMagic: boolean = false,
    ): void {
        const effects = this.getEffects("player", playerId);

        // Half duration if protect from magic is active
        const actualDuration = hasProtectFromMagic ? Math.floor(durationTicks / 2) : durationTicks;

        const endTick = currentTick + actualDuration;

        // Only apply if not already teleblocked or if new duration is longer
        if (!effects.teleblock || effects.teleblock.endTick < endTick) {
            effects.teleblock = {
                type: "teleblock",
                endTick,
            };
        }
    }

    /**
     * Check if an entity is frozen
     * Also sets freeze immunity when freeze expires
     */
    isFrozen(entityType: "player" | "npc", entityId: number, currentTick: number): boolean {
        const effects = this.getEffects(entityType, entityId);
        if (!effects.freeze) return false;

        if (currentTick >= effects.freeze.endTick) {
            // Freeze expired - grant immunity
            effects.freezeImmunityUntilTick = currentTick + FREEZE_IMMUNITY_TICKS;
            delete effects.freeze;
            return false;
        }
        return true;
    }

    /**
     * Check if an entity has freeze immunity
     */
    hasFreezeImmunity(
        entityType: "player" | "npc",
        entityId: number,
        currentTick: number,
    ): boolean {
        const effects = this.getEffects(entityType, entityId);
        if (!effects.freezeImmunityUntilTick) return false;

        if (currentTick >= effects.freezeImmunityUntilTick) {
            delete effects.freezeImmunityUntilTick;
            return false;
        }
        return true;
    }

    /**
     * Get remaining freeze immunity duration in ticks
     */
    getFreezeImmunityRemaining(
        entityType: "player" | "npc",
        entityId: number,
        currentTick: number,
    ): number {
        const effects = this.getEffects(entityType, entityId);
        if (!effects.freezeImmunityUntilTick) return 0;
        const remaining = effects.freezeImmunityUntilTick - currentTick;
        return Math.max(0, remaining);
    }

    /**
     * Check if an entity is bound (cannot move but can attack)
     */
    isBound(entityType: "player" | "npc", entityId: number, currentTick: number): boolean {
        const effects = this.getEffects(entityType, entityId);
        if (!effects.bind) return false;
        if (currentTick >= effects.bind.endTick) {
            delete effects.bind;
            return false;
        }
        return true;
    }

    /**
     * Check if a player is teleblocked
     */
    isTeleblocked(playerId: number, currentTick: number): boolean {
        const effects = this.getEffects("player", playerId);
        if (!effects.teleblock) return false;
        if (currentTick >= effects.teleblock.endTick) {
            delete effects.teleblock;
            return false;
        }
        return true;
    }

    /**
     * Get remaining duration of freeze effect in ticks
     */
    getFreezeDuration(entityType: "player" | "npc", entityId: number, currentTick: number): number {
        const effects = this.getEffects(entityType, entityId);
        if (!effects.freeze) return 0;
        const remaining = effects.freeze.endTick - currentTick;
        return Math.max(0, remaining);
    }

    /**
     * Get remaining duration of teleblock effect in ticks
     */
    getTeleblockDuration(playerId: number, currentTick: number): number {
        const effects = this.getEffects("player", playerId);
        if (!effects.teleblock) return 0;
        const remaining = effects.teleblock.endTick - currentTick;
        return Math.max(0, remaining);
    }

    /**
     * Clear all effects for an entity
     */
    clearEffects(entityType: "player" | "npc", entityId: number): void {
        if (entityType === "player") {
            this.playerEffects.delete(entityId);
        } else {
            this.npcEffects.delete(entityId);
        }
    }

    /**
     * Clear freeze effect and immunity for an entity (e.g., on death)
     */
    clearFreeze(entityType: "player" | "npc", entityId: number): void {
        const effects = this.getEffects(entityType, entityId);
        delete effects.freeze;
        delete effects.freezeImmunityUntilTick;
    }

    /**
     * Clean up expired effects (should be called periodically)
     */
    cleanupExpired(currentTick: number): void {
        for (const [id, effects] of this.playerEffects) {
            let hasActive = false;

            if (effects.freeze && currentTick >= effects.freeze.endTick) {
                // Grant immunity when freeze expires during cleanup
                effects.freezeImmunityUntilTick = currentTick + FREEZE_IMMUNITY_TICKS;
                delete effects.freeze;
            }
            if (effects.freeze) hasActive = true;

            if (effects.freezeImmunityUntilTick && currentTick >= effects.freezeImmunityUntilTick) {
                delete effects.freezeImmunityUntilTick;
            }
            if (effects.freezeImmunityUntilTick) hasActive = true;

            if (effects.bind && currentTick >= effects.bind.endTick) {
                delete effects.bind;
            }
            if (effects.bind) hasActive = true;

            if (effects.teleblock && currentTick >= effects.teleblock.endTick) {
                delete effects.teleblock;
            }
            if (effects.teleblock) hasActive = true;

            if (!hasActive) {
                this.playerEffects.delete(id);
            }
        }

        for (const [id, effects] of this.npcEffects) {
            let hasActive = false;

            if (effects.freeze && currentTick >= effects.freeze.endTick) {
                // Grant immunity when freeze expires during cleanup
                effects.freezeImmunityUntilTick = currentTick + FREEZE_IMMUNITY_TICKS;
                delete effects.freeze;
            }
            if (effects.freeze) hasActive = true;

            if (effects.freezeImmunityUntilTick && currentTick >= effects.freezeImmunityUntilTick) {
                delete effects.freezeImmunityUntilTick;
            }
            if (effects.freezeImmunityUntilTick) hasActive = true;

            if (effects.bind && currentTick >= effects.bind.endTick) {
                delete effects.bind;
            }
            if (effects.bind) hasActive = true;

            if (!hasActive) {
                this.npcEffects.delete(id);
            }
        }
    }

    private getEffects(entityType: "player" | "npc", entityId: number): EntityStatusEffects {
        const map = entityType === "player" ? this.playerEffects : this.npcEffects;
        let effects = map.get(entityId);
        if (!effects) {
            effects = {};
            map.set(entityId, effects);
        }
        return effects;
    }
}
