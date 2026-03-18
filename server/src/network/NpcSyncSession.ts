export class NpcSyncSession {
    /**
     * Local NPC indices (OSRS: Client.npcIndices / Client.npcCount).
     * Kept in the same order the server streamed them, so the bitstream count + per-index updates
     * match `PcmPlayer.method846` semantics.
     */
    npcIndices: number[] = [];

    /** Last encoded targetIndex (FACE_ENTITY) per NPC, 24-bit or 0xffffff sentinel. */
    lastTargetIndex: Map<number, number> = new Map();
}
