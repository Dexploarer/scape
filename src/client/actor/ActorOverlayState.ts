/**
 * ActorOverlayState - Type definitions and factory functions for actor overlay state.
 *
 * Each actor has:
 * - hitSplatCount: byte (0-4)
 * - hitSplatTypes[4], hitSplatValues[4], hitSplatCycles[4]: int[]
 * - hitSplatTypes2[4], hitSplatValues2[4]: int[] (secondary splat info)
 * - healthBars: linked list of HealthBar
 * - overheadText: String, overheadTextCyclesRemaining: int
 */

// Maximum hitsplat slots per actor (OSRS uses 4)
export const MAX_HITSPLAT_SLOTS = 4;

/**
 * Per-actor hitsplat state
 *
 *
 * - hitSplatCycles stores the END cycle in CLIENT CYCLES (20ms each)
 * - Start visibility is calculated at render time: hitSplatCycles - displayCycles
 * - displayCycles is loaded from HitSplatDefinition at render time
 * - OSRS does NOT store a separate start cycle array
 */
export interface ActorHitsplatState {
    hitSplatCount: number;
    hitSplatTypes: Int32Array; // size 4
    hitSplatValues: Int32Array; // size 4
    hitSplatTypes2: Int32Array; // size 4 (secondary type)
    hitSplatValues2: Int32Array; // size 4 (secondary value)
    hitSplatCycles: Int32Array; // size 4 (expiry cycle in CLIENT CYCLES)
}

/**
 * Health bar update state (matches OSRS HealthBarUpdate)
 */
export interface HealthBarUpdateState {
    cycle: number;
    health: number;
    health2: number;
    cycleOffset: number;
}

/**
 * Health bar definition state (matches OSRS HealthBarDefinition)
 */
export interface HealthBarDefinitionState {
    defId: number;
    int1: number;
    int2: number;
    int3: number;
    stepIncrement: number;
    int5: number;
    width: number;
    widthPadding: number;
}

/**
 * Single health bar state
 */
export interface HealthBarBarState {
    def: HealthBarDefinitionState;
    updates: HealthBarUpdateState[];
}

/**
 * Per-actor health bar collection
 */
export interface ActorHealthBarsState {
    bars: HealthBarBarState[];
}

/**
 * Create a new empty hitsplat state for an actor.
 * Arrays are initialized to match OSRS defaults.
 *
 *
 * - hitSplatCount initialized to 0 (byte)
 * - hitSplatTypes/Values/Cycles are int[4] initialized to 0
 * - Types are stored as-is; negative type means empty/unused in rendering
 */
export function createActorHitsplatState(): ActorHitsplatState {
    // OSRS: Actor constructor initializes these to new int[4] which are 0-filled
    const state: ActorHitsplatState = {
        hitSplatCount: 0,
        hitSplatTypes: new Int32Array(MAX_HITSPLAT_SLOTS),
        hitSplatValues: new Int32Array(MAX_HITSPLAT_SLOTS),
        hitSplatTypes2: new Int32Array(MAX_HITSPLAT_SLOTS),
        hitSplatValues2: new Int32Array(MAX_HITSPLAT_SLOTS),
        hitSplatCycles: new Int32Array(MAX_HITSPLAT_SLOTS),
    };
    // Int32Array is 0-filled by default, matching OSRS int[] behavior
    return state;
}

/**
 * Create a new empty health bars state for an actor
 */
export function createActorHealthBarsState(): ActorHealthBarsState {
    return {
        bars: [],
    };
}
