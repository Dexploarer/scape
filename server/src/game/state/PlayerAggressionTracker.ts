import {
    AGGRESSION_TIMER_TICKS,
    type PlayerAggressionState,
    createAggressionState,
    updateAggressionStateWithPosition,
} from "../combat/NpcCombatAI";

/**
 * Tracks OSRS aggression tolerance state for a player.
 *
 * After ~10 minutes in an area, NPCs become tolerant (stop aggro).
 * Moving 10+ tiles from both tracked positions resets the timer.
 * Teleporting clears the state entirely so it re-initializes at the new location.
 */
export class PlayerAggressionTracker {
    private state: PlayerAggressionState | null = null;

    /**
     * Get the current aggression state, creating it if needed.
     */
    getAggressionState(currentTick: number, tileX: number, tileY: number): PlayerAggressionState {
        if (!this.state) {
            this.state = createAggressionState(currentTick, tileX, tileY);
        }
        return this.state;
    }

    /**
     * Update aggression state each tick with the player's current position.
     */
    updateAggressionState(
        currentTick: number,
        tileX: number,
        tileY: number,
        neverTolerant: boolean = false,
        customTimer?: number,
    ): void {
        const state = this.getAggressionState(currentTick, tileX, tileY);
        const timer = customTimer ?? AGGRESSION_TIMER_TICKS;
        this.state = updateAggressionStateWithPosition(
            state,
            currentTick,
            tileX,
            tileY,
            timer,
            neverTolerant,
        );
    }

    /**
     * Reset aggression state (e.g., after teleporting).
     * Makes NPCs aggressive toward the player again.
     */
    resetAggressionState(currentTick: number, tileX: number, tileY: number): void {
        this.state = createAggressionState(currentTick, tileX, tileY);
    }

    /**
     * Clear the state entirely. Used when position context is not yet available
     * (e.g., inside a teleport override before the next tick).
     */
    clearState(): void {
        this.state = null;
    }

    /**
     * Check if the aggression timer has expired (NPCs are tolerant).
     */
    isAggressionExpired(): boolean {
        return this.state?.aggressionExpired ?? false;
    }
}
