import type { Vec2 } from "./woodcutting";

export type FlaxPatchState = {
    locId: number;
    tile: Vec2;
    level: number;
    respawnTick: number;
};

export class FlaxPatchTracker {
    private depletedPatches = new Map<string, FlaxPatchState>();

    private static key(tile: Vec2, level: number): string {
        return `${tile.x}|${tile.y}|${level}`;
    }

    isDepleted(tile: Vec2, level: number): boolean {
        return this.depletedPatches.has(FlaxPatchTracker.key(tile, level));
    }

    markDepleted(state: FlaxPatchState): void {
        this.depletedPatches.set(FlaxPatchTracker.key(state.tile, state.level), state);
    }

    processRespawns(tick: number, callback: (state: FlaxPatchState) => void): void {
        for (const [key, state] of this.depletedPatches) {
            if (tick >= state.respawnTick) {
                this.depletedPatches.delete(key);
                callback(state);
            }
        }
    }
}
