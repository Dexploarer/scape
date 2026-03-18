export class PlayerSyncSession {
    // OSRS parity: scene base (tile units, 8-tile aligned) is sticky per recipient and
    // only rebased when the local player approaches scene borders.
    baseTileX = -1;
    baseTileY = -1;

    // OSRS parity: `Players.field1355` bit flags, used for 4-pass loop + skip-count compression.
    field1355 = new Uint8Array(2048);

    // OSRS parity: `Players.Players_indices` / `Players.Players_emptyIndices`.
    playersIndices: number[] = [];
    emptyIndices: number[] = [];

    // OSRS parity: `Players.Players_regions` / `Players.Players_orientations` / `Players.Players_targetIndices`.
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
        // OSRS parity: target indices default to -1.
        this.targets.fill(-1);
    }

    clear(): void {
        this.baseTileX = -1;
        this.baseTileY = -1;
        this.field1355.fill(0);
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
