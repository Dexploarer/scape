export class PlayerSyncSession {
    // scene base (tile units, 8-tile aligned) is sticky per recipient and
    // only rebased when the local player approaches scene borders.
    baseTileX = -1;
    baseTileY = -1;

    // Bit flags used for 4-pass loop + skip-count compression.
    updateFlags = new Uint8Array(2048);

    // Active and empty player index lists for sync encoding.
    playersIndices: number[] = [];
    emptyIndices: number[] = [];

    // Per-index region, orientation, and interaction target tracking.
    regions = new Int32Array(2048);
    orientations = new Int32Array(2048);
    targets = new Int32Array(2048);

    // Legacy list used by the old encoder; retained while refactoring.
    activeIndices: number[] = [];
    lastInteractionIndex = new Map<number, number>();
    lastAppearanceHash = new Map<number, number>();
    lastKnownTiles = new Map<number, { x: number; y: number; level: number }>();
    lastMovementType = new Map<number, number>();
    /**
     * Per-recipient last sent healthbar values (actorId -> defId -> scaled 0..width),
     * used for smooth interpolation and correct remove/add semantics when ids vary.
     */
    lastHealthBarScaled = new Map<number, Map<number, number>>();

    constructor() {
        // Target indices default to -1 (no target).
        this.targets.fill(-1);
    }

    clear(): void {
        this.baseTileX = -1;
        this.baseTileY = -1;
        this.updateFlags.fill(0);
        this.playersIndices = [];
        this.emptyIndices = [];
        this.regions.fill(0);
        this.orientations.fill(0);
        this.targets.fill(-1);
        this.activeIndices = [];
        this.lastInteractionIndex.clear();
        this.lastAppearanceHash.clear();
        this.lastKnownTiles.clear();
        this.lastMovementType.clear();
        this.lastHealthBarScaled.clear();
    }
}
