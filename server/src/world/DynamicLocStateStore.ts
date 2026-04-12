export type DynamicLocChangeState = {
    oldId: number;
    newId: number;
    level: number;
    oldTile: { x: number; y: number };
    newTile: { x: number; y: number };
    oldRotation?: number;
    newRotation?: number;
    newShape?: number;
};

type StoredDynamicLocChangeState = DynamicLocChangeState;

export class DynamicLocStateStore {
    private readonly activeStates = new Map<string, StoredDynamicLocChangeState>();

    observeLocChange(change: DynamicLocChangeState): void {
        const normalized = this.normalize(change);
        if (!normalized) {
            return;
        }

        const existingKey = this.findByCurrentState(normalized);
        if (existingKey) {
            const existing = this.activeStates.get(existingKey);
            if (!existing) {
                return;
            }

            if (this.matchesOriginState(existing, normalized)) {
                this.activeStates.delete(existingKey);
                return;
            }

            this.activeStates.set(existingKey, {
                ...existing,
                newId: normalized.newId,
                newTile: normalized.newTile,
                newRotation: normalized.newRotation,
                newShape: normalized.newShape,
            });
            return;
        }

        this.activeStates.set(this.makeOriginKey(normalized), normalized);
    }

    queryScene(
        sceneBaseX: number,
        sceneBaseY: number,
        level: number,
        sceneSize: number = 104,
    ): DynamicLocChangeState[] {
        const minX = sceneBaseX | 0;
        const minY = sceneBaseY | 0;
        const maxX = minX + Math.max(1, sceneSize | 0) - 1;
        const maxY = minY + Math.max(1, sceneSize | 0) - 1;
        const targetLevel = level | 0;
        const visible: DynamicLocChangeState[] = [];

        for (const state of this.activeStates.values()) {
            if ((state.level | 0) !== targetLevel) {
                continue;
            }
            if (!this.intersectsScene(state, minX, minY, maxX, maxY)) {
                continue;
            }
            visible.push({
                oldId: state.oldId,
                newId: state.newId,
                level: state.level,
                oldTile: { x: state.oldTile.x, y: state.oldTile.y },
                newTile: { x: state.newTile.x, y: state.newTile.y },
                oldRotation: state.oldRotation,
                newRotation: state.newRotation,
                newShape: state.newShape,
            });
        }

        visible.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            if (a.oldTile.x !== b.oldTile.x) return a.oldTile.x - b.oldTile.x;
            if (a.oldTile.y !== b.oldTile.y) return a.oldTile.y - b.oldTile.y;
            if (a.newTile.x !== b.newTile.x) return a.newTile.x - b.newTile.x;
            if (a.newTile.y !== b.newTile.y) return a.newTile.y - b.newTile.y;
            if (a.oldId !== b.oldId) return a.oldId - b.oldId;
            return a.newId - b.newId;
        });

        return visible;
    }

    getActiveCount(): number {
        return this.activeStates.size;
    }

    private normalize(change: DynamicLocChangeState): StoredDynamicLocChangeState | undefined {
        const oldId = Number(change.oldId) | 0;
        const newId = Number(change.newId) | 0;
        const level = Number(change.level) | 0;
        const oldTileX = Number(change.oldTile?.x) | 0;
        const oldTileY = Number(change.oldTile?.y) | 0;
        const newTileX = Number(change.newTile?.x) | 0;
        const newTileY = Number(change.newTile?.y) | 0;

        if (!Number.isFinite(oldId) || !Number.isFinite(newId) || !Number.isFinite(level)) {
            return undefined;
        }

        const oldRotation =
            change.oldRotation !== undefined && Number.isFinite(change.oldRotation)
                ? change.oldRotation & 0x3
                : undefined;
        const newRotation =
            change.newRotation !== undefined && Number.isFinite(change.newRotation)
                ? change.newRotation & 0x3
                : undefined;
        const newShape =
            change.newShape !== undefined && Number.isFinite(change.newShape)
                ? Math.max(0, Math.floor(change.newShape))
                : undefined;

        if (
            oldId === newId &&
            oldTileX === newTileX &&
            oldTileY === newTileY &&
            this.rotationMatches(oldRotation, newRotation) &&
            newShape === undefined
        ) {
            return undefined;
        }

        return {
            oldId,
            newId,
            level,
            oldTile: { x: oldTileX, y: oldTileY },
            newTile: { x: newTileX, y: newTileY },
            oldRotation,
            newRotation,
            newShape,
        };
    }

    private findByCurrentState(change: StoredDynamicLocChangeState): string | undefined {
        for (const [key, state] of this.activeStates.entries()) {
            if ((state.level | 0) !== (change.level | 0)) {
                continue;
            }
            if ((state.newId | 0) !== (change.oldId | 0)) {
                continue;
            }
            if (!this.tilesEqual(state.newTile, change.oldTile)) {
                continue;
            }
            if (!this.rotationMatches(state.newRotation, change.oldRotation)) {
                continue;
            }
            return key;
        }

        return undefined;
    }

    private matchesOriginState(
        existing: StoredDynamicLocChangeState,
        next: StoredDynamicLocChangeState,
    ): boolean {
        return (
            (existing.oldId | 0) === (next.newId | 0) &&
            this.tilesEqual(existing.oldTile, next.newTile) &&
            this.rotationMatches(existing.oldRotation, next.newRotation) &&
            this.shapeMatches(undefined, next.newShape)
        );
    }

    private intersectsScene(
        state: StoredDynamicLocChangeState,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): boolean {
        return (
            this.tileInBounds(state.oldTile, minX, minY, maxX, maxY) ||
            this.tileInBounds(state.newTile, minX, minY, maxX, maxY)
        );
    }

    private tileInBounds(
        tile: { x: number; y: number },
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): boolean {
        return tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY;
    }

    private tilesEqual(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
        return (a.x | 0) === (b.x | 0) && (a.y | 0) === (b.y | 0);
    }

    private rotationMatches(a?: number, b?: number): boolean {
        if (a === undefined || b === undefined) {
            return true;
        }
        return (a & 0x3) === (b & 0x3);
    }

    private shapeMatches(a?: number, b?: number): boolean {
        if (a === undefined || b === undefined) {
            return true;
        }
        return Math.floor(a) === Math.floor(b);
    }

    private makeOriginKey(change: StoredDynamicLocChangeState): string {
        const rotation = change.oldRotation !== undefined ? change.oldRotation & 0x3 : -1;
        const shape = change.newShape !== undefined ? Math.floor(change.newShape) : -1;
        return `${change.level}:${change.oldTile.x}:${change.oldTile.y}:${change.oldId}:${rotation}:${shape}`;
    }
}
