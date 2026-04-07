import { RUN_ENERGY_MAX } from "../actor";

const DEFAULT_STAMINA_DRAIN_MULTIPLIER = 0.3;
// Stamina effect max duration is 8000 ticks (40 doses * 200 ticks each)
const MAX_STAMINA_DURATION_TICKS = 8000;

/**
 * Minimal view of the owning player needed by run-energy logic.
 * Keeps the sub-state decoupled from the full PlayerState class.
 */
export interface RunEnergyOwner {
    /** Actor-level run energy (0..RUN_ENERGY_MAX internal units). */
    runEnergy: number;
    /** Actor-level run toggle. */
    runToggle: boolean;
}

/**
 * Encapsulates all run-energy and stamina-effect state for a player.
 *
 * `runEnergy` and `runToggle` remain on Actor (inherited by PlayerState).
 * This class reads/writes them via the {@link RunEnergyOwner} reference
 * passed at construction time.
 */
export class PlayerRunEnergyState {
    private dirty: boolean = true;
    private staminaEffectExpiryTick: number = 0;
    private staminaDrainMultiplier: number = 1;
    private remainder: number = 0;

    constructor(
        private readonly owner: RunEnergyOwner,
        private readonly hasInfiniteEnergy: () => boolean,
    ) {}

    // ------------------------------------------------------------------
    // Unit-based accessors (internal 0..10000 scale)
    // ------------------------------------------------------------------

    getRunEnergyUnits(): number {
        const current = this.owner.runEnergy;
        if (!Number.isFinite(current)) {
            this.owner.runEnergy = RUN_ENERGY_MAX;
            return RUN_ENERGY_MAX;
        }
        return Math.max(0, Math.min(RUN_ENERGY_MAX, Math.floor(current)));
    }

    setRunEnergyUnits(units: number): void {
        const normalized = Math.max(0, Math.min(RUN_ENERGY_MAX, Math.floor(units)));
        const before = this.getRunEnergyUnits();
        this.owner.runEnergy = normalized;
        this.remainder = 0;
        if (before !== normalized) {
            this.dirty = true;
        }
    }

    adjustRunEnergyUnits(deltaUnits: number): number {
        const current = this.getRunEnergyUnits();
        let total = current + this.remainder + deltaUnits;
        let next = Math.floor(total);
        if (next < 0) {
            next = 0;
            total = 0;
        } else if (next > RUN_ENERGY_MAX) {
            next = RUN_ENERGY_MAX;
            total = RUN_ENERGY_MAX;
        }
        this.remainder = total - next;
        if (
            (next === 0 && this.remainder < 0) ||
            (next === RUN_ENERGY_MAX && this.remainder > 0)
        ) {
            this.remainder = 0;
        }
        if (current !== next) {
            this.dirty = true;
        }
        this.owner.runEnergy = next;
        return next;
    }

    // ------------------------------------------------------------------
    // Percent-based accessors (0..100 scale)
    // ------------------------------------------------------------------

    getRunEnergyPercent(): number {
        return Math.floor((this.getRunEnergyUnits() / RUN_ENERGY_MAX) * 100);
    }

    setRunEnergyPercent(percent: number): void {
        const value = Number.isFinite(percent) ? percent : 0;
        const normalized = Math.max(0, Math.min(100, Math.floor(value)));
        const units = Math.round((normalized / 100) * RUN_ENERGY_MAX);
        this.setRunEnergyUnits(units);
    }

    adjustRunEnergyPercent(deltaPercent: number): number {
        const deltaUnits = (deltaPercent / 100) * RUN_ENERGY_MAX;
        const units = this.adjustRunEnergyUnits(deltaUnits);
        return Math.floor((units / RUN_ENERGY_MAX) * 100);
    }

    // ------------------------------------------------------------------
    // Stamina effect
    // ------------------------------------------------------------------

    applyStaminaEffect(currentTick: number, durationTicks: number, drainMultiplier?: number): void {
        const now = Math.max(0, currentTick);
        const duration = Math.max(1, durationTicks);
        const baseline = this.staminaEffectExpiryTick > now ? this.staminaEffectExpiryTick : now;
        this.staminaEffectExpiryTick = Math.min(
            baseline + duration,
            now + MAX_STAMINA_DURATION_TICKS,
        );
        const multiplier =
            drainMultiplier !== undefined ? drainMultiplier : DEFAULT_STAMINA_DRAIN_MULTIPLIER;
        this.staminaDrainMultiplier = Math.max(0, Math.min(1, multiplier));
    }

    tickStaminaEffect(currentTick: number): void {
        if (this.staminaEffectExpiryTick !== 0 && this.staminaEffectExpiryTick <= currentTick) {
            this.staminaEffectExpiryTick = 0;
            this.staminaDrainMultiplier = 1;
        }
    }

    getStaminaEffectRemainingTicks(currentTick: number): number {
        if (this.staminaEffectExpiryTick === 0) return 0;
        const remaining = this.staminaEffectExpiryTick - currentTick;
        return remaining > 0 ? remaining : 0;
    }

    getRunEnergyDrainMultiplier(currentTick: number): number {
        this.tickStaminaEffect(currentTick);
        return Math.max(0, Math.min(1, this.staminaDrainMultiplier));
    }

    // ------------------------------------------------------------------
    // Infinite run energy (gamemode-driven)
    // ------------------------------------------------------------------

    hasInfiniteRunEnergy(): boolean {
        return this.hasInfiniteEnergy();
    }

    syncInfiniteRunEnergy(): boolean {
        if (!this.hasInfiniteRunEnergy()) {
            return false;
        }
        if (this.getRunEnergyUnits() < RUN_ENERGY_MAX) {
            this.setRunEnergyUnits(RUN_ENERGY_MAX);
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Run resolution helpers
    // ------------------------------------------------------------------

    wantsToRun(): boolean {
        return !!this.owner.runToggle;
    }

    hasAvailableRunEnergy(): boolean {
        return this.hasInfiniteRunEnergy() || this.getRunEnergyUnits() > 0;
    }

    resolveRequestedRun(run: boolean): boolean {
        return !!run && this.hasAvailableRunEnergy();
    }

    isRunActive(): boolean {
        return this.resolveRequestedRun(this.wantsToRun());
    }

    // ------------------------------------------------------------------
    // Dirty tracking (for network sync)
    // ------------------------------------------------------------------

    hasRunEnergyUpdate(): boolean {
        return this.dirty;
    }

    markRunEnergySynced(): void {
        this.dirty = false;
    }

    markDirty(): void {
        this.dirty = true;
    }
}
