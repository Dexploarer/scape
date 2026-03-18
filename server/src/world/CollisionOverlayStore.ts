/**
 * Stores dynamic collision modifications that overlay the precomputed collision maps.
 * Used for doors opening/closing, dynamic objects, etc.
 */

export interface CollisionOverlay {
    /** Flags to add (bitwise OR) */
    added: number;
    /** Flags to remove (bitwise AND NOT) */
    removed: number;
}

export class CollisionOverlayStore {
    // Key: `${level}:${x}:${y}` -> overlay data
    private overlays: Map<string, CollisionOverlay> = new Map();

    private makeKey(x: number, y: number, level: number): string {
        return `${level}:${x}:${y}`;
    }

    /**
     * Add collision flags to a tile (overlay operation).
     * These flags will be OR'd with the base collision.
     */
    addFlags(x: number, y: number, level: number, flags: number): void {
        const key = this.makeKey(x, y, level);
        const existing = this.overlays.get(key) ?? { added: 0, removed: 0 };
        existing.added |= flags;
        existing.removed &= ~flags; // If adding, don't also remove
        this.overlays.set(key, existing);
    }

    /**
     * Remove collision flags from a tile (overlay operation).
     * These flags will be AND NOT'd from the base collision.
     */
    removeFlags(x: number, y: number, level: number, flags: number): void {
        const key = this.makeKey(x, y, level);
        const existing = this.overlays.get(key) ?? { added: 0, removed: 0 };
        existing.removed |= flags;
        existing.added &= ~flags; // If removing, don't also add
        this.overlays.set(key, existing);
    }

    /**
     * Set exact overlay flags for a tile (replaces any existing overlay).
     */
    setOverlay(x: number, y: number, level: number, added: number, removed: number): void {
        const key = this.makeKey(x, y, level);
        this.overlays.set(key, { added, removed });
    }

    /**
     * Clear any overlay for a tile.
     */
    clearTile(x: number, y: number, level: number): void {
        const key = this.makeKey(x, y, level);
        this.overlays.delete(key);
    }

    /**
     * Apply overlay modifications to a base collision flag value.
     * Order: (base | added) & ~removed
     */
    applyOverlay(x: number, y: number, level: number, baseFlags: number): number {
        const key = this.makeKey(x, y, level);
        const overlay = this.overlays.get(key);
        if (!overlay) return baseFlags;
        return (baseFlags | overlay.added) & ~overlay.removed;
    }

    /**
     * Get the raw overlay for a tile (for debugging).
     */
    getOverlay(x: number, y: number, level: number): CollisionOverlay | undefined {
        return this.overlays.get(this.makeKey(x, y, level));
    }

    /**
     * Check if any overlays exist.
     */
    hasOverlays(): boolean {
        return this.overlays.size > 0;
    }

    /**
     * Get the number of tiles with overlays.
     */
    get size(): number {
        return this.overlays.size;
    }

    /**
     * Clear all overlays.
     */
    clear(): void {
        this.overlays.clear();
    }

    /**
     * Get all tiles with overlays (for debugging).
     */
    getAllOverlays(): Array<{ x: number; y: number; level: number; overlay: CollisionOverlay }> {
        const result: Array<{ x: number; y: number; level: number; overlay: CollisionOverlay }> =
            [];
        for (const [key, overlay] of this.overlays) {
            const [levelStr, xStr, yStr] = key.split(":");
            result.push({
                level: parseInt(levelStr, 10),
                x: parseInt(xStr, 10),
                y: parseInt(yStr, 10),
                overlay,
            });
        }
        return result;
    }
}
