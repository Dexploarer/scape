/**
 * Combat State Machine
 *
 * Explicit state machine for combat lifecycle.
 * Makes combat phases visible and transitions auditable.
 *
 * OSRS Combat Flow:
 * 1. Player clicks attack -> Idle -> Approaching
 * 2. Player paths toward NPC
 * 3. When in range + attack ready -> Approaching -> Attacking
 * 4. Attack animation plays, hit scheduled -> Attacking -> Cooldown
 * 5. Wait for attack speed cooldown
 * 6. If still in range -> Cooldown -> Attacking (repeat)
 * 7. If target moved -> Cooldown -> Approaching (re-path)
 * 8. If combat ended -> Cooldown -> Idle
 */
import { CombatPhase, CombatStateMachineContext, CombatStateTransition } from "./CombatState";

/** Maximum transition history to keep (for debugging) */
const MAX_TRANSITION_HISTORY = 50;

/**
 * Combat state machine with explicit transitions.
 *
 * State Diagram:
 * ```
 *                    ┌─────────────┐
 *         ┌─────────►│    Idle     │◄────────────┐
 *         │          └─────────────┘             │
 *         │                 │                    │
 *         │                 │ startCombat()      │ endCombat()
 *         │                 ▼                    │
 *         │          ┌─────────────┐             │
 *         │     ┌───►│ Approaching │─────┐       │
 *         │     │    └─────────────┘     │       │
 *         │     │           │            │       │
 *         │     │           │ in range   │ target dead
 *         │     │           ▼            │       │
 *         │     │    ┌─────────────┐     │       │
 *         │     │    │  Attacking  │─────┼───────┤
 *         │     │    └─────────────┘     │       │
 *         │     │           │            │       │
 *         │     │           │ attack     │       │
 *         │     │           │ executed   │       │
 *         │     │           ▼            │       │
 *         │     │    ┌─────────────┐     │       │
 *         │     └────│  Cooldown   │─────┴───────┘
 *         │          └─────────────┘
 *         │                 │
 *         │                 │ freeze
 *         │                 ▼
 *         │          ┌─────────────┐
 *         └──────────│   Frozen    │
 *                    └─────────────┘
 * ```
 */
export class CombatStateMachine {
    private state: CombatPhase = CombatPhase.Idle;
    private previousState: CombatPhase = CombatPhase.Idle;
    private transitionHistory: CombatStateTransition[] = [];
    private frozenPreviousState: CombatPhase = CombatPhase.Idle;

    /**
     * Get current combat phase.
     */
    getState(): CombatPhase {
        return this.state;
    }

    /**
     * Get previous combat phase (before last transition).
     */
    getPreviousState(): CombatPhase {
        return this.previousState;
    }

    /**
     * Check if currently in combat (not idle).
     */
    isInCombat(): boolean {
        return this.state !== CombatPhase.Idle;
    }

    /**
     * Check if currently frozen.
     */
    isFrozen(): boolean {
        return this.state === CombatPhase.Frozen;
    }

    /**
     * Check if ready to execute an attack.
     */
    isReadyToAttack(): boolean {
        return this.state === CombatPhase.Attacking;
    }

    /**
     * Check if waiting for attack cooldown.
     */
    isOnCooldown(): boolean {
        return this.state === CombatPhase.Cooldown;
    }

    /**
     * Get recent transition history (for debugging).
     */
    getTransitionHistory(): readonly CombatStateTransition[] {
        return this.transitionHistory;
    }

    /**
     * Start combat - transition from Idle to Approaching.
     */
    startCombat(tick: number): CombatStateTransition | null {
        if (this.state !== CombatPhase.Idle) {
            // Already in combat - no transition needed
            return null;
        }
        return this.applyTransition(
            this.makeTransition(CombatPhase.Approaching, tick, "combat_started"),
        );
    }

    /**
     * End combat - transition to Idle from any state.
     */
    endCombat(tick: number, reason: string): CombatStateTransition {
        return this.applyTransition(this.makeTransition(CombatPhase.Idle, tick, reason));
    }

    /**
     * Apply freeze effect - transition to Frozen, remember previous state.
     */
    applyFreeze(tick: number): CombatStateTransition | null {
        if (this.state === CombatPhase.Frozen) {
            return null; // Already frozen
        }
        if (this.state === CombatPhase.Idle) {
            return null; // Can't freeze if not in combat
        }
        this.frozenPreviousState = this.state;
        return this.applyTransition(
            this.makeTransition(CombatPhase.Frozen, tick, "freeze_applied"),
        );
    }

    /**
     * Remove freeze effect - return to previous state.
     */
    removeFreeze(tick: number): CombatStateTransition | null {
        if (this.state !== CombatPhase.Frozen) {
            return null; // Not frozen
        }
        return this.applyTransition(
            this.makeTransition(this.frozenPreviousState, tick, "freeze_expired"),
        );
    }

    /**
     * Process a tick and compute any state transitions.
     * Returns the transition if one occurred, null otherwise.
     */
    tick(ctx: CombatStateMachineContext): CombatStateTransition | null {
        const transition = this.computeTransition(ctx);
        if (transition) {
            return this.applyTransition(transition);
        }
        return null;
    }

    /**
     * Force a specific state (for migration from old system).
     * Use sparingly - prefer explicit transitions.
     */
    forceState(phase: CombatPhase, tick: number, reason: string): CombatStateTransition {
        return this.applyTransition(this.makeTransition(phase, tick, `force: ${reason}`));
    }

    /**
     * Compute the next transition based on current state and context.
     */
    private computeTransition(ctx: CombatStateMachineContext): CombatStateTransition | null {
        switch (this.state) {
            case CombatPhase.Idle:
                // Idle state only transitions via explicit startCombat() call
                return null;

            case CombatPhase.Approaching:
                return this.computeApproachingTransition(ctx);

            case CombatPhase.Attacking:
                // Attacking always transitions to Cooldown after attack executes
                // This is called after the attack is scheduled
                return this.makeTransition(CombatPhase.Cooldown, ctx.tick, "attack_executed");

            case CombatPhase.Cooldown:
                return this.computeCooldownTransition(ctx);

            case CombatPhase.Frozen:
                return this.computeFrozenTransition(ctx);

            default:
                return null;
        }
    }

    /**
     * Compute transition from Approaching state.
     */
    private computeApproachingTransition(
        ctx: CombatStateMachineContext,
    ): CombatStateTransition | null {
        // Priority 1: Target dead -> end combat
        if (!ctx.targetAlive) {
            return this.makeTransition(CombatPhase.Idle, ctx.tick, "target_dead");
        }

        // Priority 2: Player frozen -> Frozen state
        if (ctx.playerFrozen) {
            this.frozenPreviousState = CombatPhase.Approaching;
            return this.makeTransition(CombatPhase.Frozen, ctx.tick, "player_frozen");
        }

        // Priority 3: In range and attack ready -> Attacking
        if (ctx.targetInRange && ctx.attackSpeedReady) {
            // For ranged/magic, also check line of sight
            if (ctx.attackReach > 1 && !ctx.hasLineOfSight) {
                return null; // Need to keep approaching for LoS
            }
            return this.makeTransition(CombatPhase.Attacking, ctx.tick, "in_range_attack_ready");
        }

        // Stay in Approaching - keep pathing
        return null;
    }

    /**
     * Compute transition from Cooldown state.
     */
    private computeCooldownTransition(
        ctx: CombatStateMachineContext,
    ): CombatStateTransition | null {
        // Priority 1: Target dead -> end combat
        if (!ctx.targetAlive) {
            return this.makeTransition(CombatPhase.Idle, ctx.tick, "target_dead");
        }

        // Priority 2: Player frozen -> Frozen state
        if (ctx.playerFrozen) {
            this.frozenPreviousState = CombatPhase.Cooldown;
            return this.makeTransition(CombatPhase.Frozen, ctx.tick, "player_frozen");
        }

        // Priority 3: Attack ready
        if (ctx.attackSpeedReady) {
            // If in range, transition to Attacking
            if (ctx.targetInRange) {
                // For ranged/magic, check LoS
                if (ctx.attackReach > 1 && !ctx.hasLineOfSight) {
                    return this.makeTransition(
                        CombatPhase.Approaching,
                        ctx.tick,
                        "need_line_of_sight",
                    );
                }
                return this.makeTransition(CombatPhase.Attacking, ctx.tick, "attack_ready");
            }
            // Out of range, need to approach again
            return this.makeTransition(CombatPhase.Approaching, ctx.tick, "target_out_of_range");
        }

        // Stay in Cooldown - waiting for attack speed
        return null;
    }

    /**
     * Compute transition from Frozen state.
     */
    private computeFrozenTransition(ctx: CombatStateMachineContext): CombatStateTransition | null {
        // Priority 1: Target dead -> end combat
        if (!ctx.targetAlive) {
            return this.makeTransition(CombatPhase.Idle, ctx.tick, "target_dead");
        }

        // Priority 2: Freeze expired -> return to previous state
        if (!ctx.playerFrozen) {
            return this.makeTransition(this.frozenPreviousState, ctx.tick, "freeze_expired");
        }

        // Stay frozen
        return null;
    }

    /**
     * Create a transition record.
     */
    private makeTransition(to: CombatPhase, tick: number, reason: string): CombatStateTransition {
        return {
            from: this.state,
            to,
            tick,
            reason,
        };
    }

    /**
     * Apply a transition and record it.
     */
    private applyTransition(transition: CombatStateTransition): CombatStateTransition {
        this.previousState = this.state;
        this.state = transition.to;
        this.transitionHistory.push(transition);

        // Keep history bounded
        if (this.transitionHistory.length > MAX_TRANSITION_HISTORY) {
            this.transitionHistory.shift();
        }

        return transition;
    }

    /**
     * Reset state machine to initial state.
     */
    reset(): void {
        this.state = CombatPhase.Idle;
        this.previousState = CombatPhase.Idle;
        this.frozenPreviousState = CombatPhase.Idle;
        this.transitionHistory = [];
    }
}

/**
 * Create a new combat state machine.
 */
export function createCombatStateMachine(): CombatStateMachine {
    return new CombatStateMachine();
}
