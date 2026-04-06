import {
    VARBIT_HAM_TRAPDOOR,
    VARBIT_XPDROPS_ENABLED,
    VARP_AREA_SOUNDS_VOLUME,
    VARP_COMBAT_TARGET_PLAYER_INDEX,
    VARP_MASTER_VOLUME,
    VARP_MUSIC_VOLUME,
    VARP_SOUND_EFFECTS_VOLUME,
} from "../../../../src/shared/vars";
import type { PersistentSubState } from "./PersistentSubState";

/** Varps that should persist even when their value is 0. */
const ZERO_PERSISTENT_VARPS = new Set<number>([
    VARP_MUSIC_VOLUME,
    VARP_SOUND_EFFECTS_VOLUME,
    VARP_AREA_SOUNDS_VOLUME,
    VARP_MASTER_VOLUME,
]);

/** Varps that are session-only and must NOT be saved to disk. */
const NON_PERSISTENT_VARPS = new Set<number>([VARP_COMBAT_TARGET_PLAYER_INDEX]);

/** Varbits that are session-only and must NOT be saved to disk. */
const NON_PERSISTENT_VARBITS = new Set<number>([
    VARBIT_HAM_TRAPDOOR,
]);

/** Varbits that should persist even when their value is 0. */
const ZERO_PERSISTENT_VARBITS = new Set<number>([
    VARBIT_XPDROPS_ENABLED,
]);

/** Default value for XP drops varbit when no persisted value exists. */
const DEFAULT_XPDROPS_ENABLED = 1;

export interface VarpSerializedData {
    varps?: Record<number, number>;
    varbits?: Record<number, number>;
}

/**
 * Stores player varp (variable player) and varbit (variable bit) values.
 * Also owns music-region tracking fields that are purely session state.
 *
 * Implements PersistentSubState so it can serialize/deserialize its own
 * portion of PlayerPersistentVars.
 */
export class PlayerVarpState implements PersistentSubState<VarpSerializedData> {
    private varpValues: Map<number, number> = new Map();
    private varbitValues: Map<number, number> = new Map();

    private lastMusicRegionId: number = -1;
    private lastPlayedMusicTrackId: number = -1;

    // ------------------------------------------------------------------
    // Varbit accessors
    // ------------------------------------------------------------------

    getVarbitValue(id: number): number {
        return this.varbitValues.get(id) ?? 0;
    }

    setVarbitValue(id: number, value: number): void {
        if (!Number.isFinite(id)) return;
        const normalized = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
        this.varbitValues.set(id, normalized);
    }

    hasVarbitValue(id: number): boolean {
        return this.varbitValues.has(id);
    }

    // ------------------------------------------------------------------
    // Varp accessors
    // ------------------------------------------------------------------

    getVarpValue(id: number): number {
        return this.varpValues.get(id) ?? 0;
    }

    hasVarpValue(id: number): boolean {
        return this.varpValues.has(id);
    }

    setVarpValue(id: number, value: number): void {
        if (!Number.isFinite(id)) return;
        const normalized = Math.floor(Number.isFinite(value) ? value : 0);
        this.varpValues.set(id, normalized);
    }

    // ------------------------------------------------------------------
    // Music region tracking (session-only, not persisted)
    // ------------------------------------------------------------------

    getLastMusicRegionId(): number {
        return this.lastMusicRegionId;
    }

    setLastMusicRegionId(regionId: number): void {
        this.lastMusicRegionId = regionId;
    }

    getLastPlayedMusicTrackId(): number {
        return this.lastPlayedMusicTrackId;
    }

    setLastPlayedMusicTrackId(trackId: number): void {
        this.lastPlayedMusicTrackId = trackId;
    }

    // ------------------------------------------------------------------
    // Raw map accessors (for iteration by sync services)
    // ------------------------------------------------------------------

    getVarpEntries(): ReadonlyMap<number, number> {
        return this.varpValues;
    }

    getVarbitEntries(): ReadonlyMap<number, number> {
        return this.varbitValues;
    }

    // ------------------------------------------------------------------
    // PersistentSubState implementation
    // ------------------------------------------------------------------

    serialize(): VarpSerializedData {
        const varps: Record<number, number> = {};
        const varbits: Record<number, number> = {};
        for (const [id, value] of this.varpValues.entries()) {
            if (NON_PERSISTENT_VARPS.has(id)) continue;
            if (value !== 0 || ZERO_PERSISTENT_VARPS.has(id)) {
                varps[id] = value;
            }
        }
        for (const [id, value] of this.varbitValues.entries()) {
            if (NON_PERSISTENT_VARBITS.has(id)) continue;
            if (value !== 0 || ZERO_PERSISTENT_VARBITS.has(id)) {
                varbits[id] = value;
            }
        }
        const result: VarpSerializedData = {};
        if (Object.keys(varps).length > 0) result.varps = varps;
        if (Object.keys(varbits).length > 0) result.varbits = varbits;
        return result;
    }

    deserialize(data: VarpSerializedData | undefined): void {
        this.varpValues.clear();
        this.varbitValues.clear();
        if (!data) {
            this.setVarbitValue(VARBIT_XPDROPS_ENABLED, DEFAULT_XPDROPS_ENABLED);
            return;
        }
        if (data.varps) {
            for (const [key, value] of Object.entries(data.varps)) {
                const id = parseInt(key, 10);
                if (!Number.isNaN(id) && !NON_PERSISTENT_VARPS.has(id)) {
                    this.setVarpValue(id, value);
                }
            }
        }
        if (data.varbits) {
            for (const [key, value] of Object.entries(data.varbits)) {
                const id = parseInt(key, 10);
                if (!Number.isNaN(id) && !NON_PERSISTENT_VARBITS.has(id)) {
                    this.setVarbitValue(id, value);
                }
            }
        }
        if (
            !data.varbits ||
            !Object.prototype.hasOwnProperty.call(data.varbits, String(VARBIT_XPDROPS_ENABLED))
        ) {
            this.setVarbitValue(VARBIT_XPDROPS_ENABLED, DEFAULT_XPDROPS_ENABLED);
        }
    }
}
