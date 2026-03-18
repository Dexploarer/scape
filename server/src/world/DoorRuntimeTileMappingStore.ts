import fs from "fs";
import path from "path";

import { logger } from "../utils/logger";
import {
    PersistedRuntimeDoorTileMap,
    RuntimeTileEntry,
    RuntimeTilePairStats,
    readRuntimeTileMappingsFromFile,
    writeRuntimeTileMappingsToFile,
} from "./DoorCatalogFile";

export type DoorRuntimePair = {
    closed: number;
    opened: number;
};

export class DoorRuntimeTileMappingStore {
    private readonly pairsByTile = new Map<string, Map<string, RuntimeTilePairStats>>();
    private dirty = false;
    private flushTimer: NodeJS.Timeout | undefined;

    constructor(
        private readonly filePath: string = path.resolve("server/data/doors.json"),
        private readonly flushDelayMs: number = 2000,
    ) {
        this.load();
    }

    getPairForTile(
        level: number,
        x: number,
        y: number,
        currentId: number,
    ): DoorRuntimePair | undefined {
        const tileKey = this.makeTileKey(level, x, y);
        const byPair = this.pairsByTile.get(tileKey);
        if (!byPair || byPair.size === 0) {
            return undefined;
        }

        const candidates = [...byPair.values()].filter(
            (entry) => entry.closed === currentId || entry.opened === currentId,
        );
        if (candidates.length === 0) {
            return undefined;
        }

        candidates.sort(
            (a, b) =>
                b.count - a.count ||
                Math.abs(a.closed - a.opened) - Math.abs(b.closed - b.opened) ||
                a.closed - b.closed ||
                a.opened - b.opened,
        );

        const best = candidates[0];
        return {
            closed: best.closed,
            opened: best.opened,
        };
    }

    recordObservedPair(level: number, x: number, y: number, closed: number, opened: number): void {
        const closedId = closed;
        const openedId = opened;
        if (closedId <= 0 || openedId <= 0 || closedId === openedId) {
            return;
        }

        const tileKey = this.makeTileKey(level, x, y);
        const pairKey = this.makePairKey(closedId, openedId);
        const now = new Date().toISOString();

        const byPair = this.pairsByTile.get(tileKey) ?? new Map<string, RuntimeTilePairStats>();
        const existing = byPair.get(pairKey);
        if (existing) {
            existing.count = existing.count + 1;
            existing.lastObserved = now;
        } else {
            byPair.set(pairKey, {
                closed: closedId,
                opened: openedId,
                count: 1,
                lastObserved: now,
            });
        }

        this.pairsByTile.set(tileKey, byPair);
        this.markDirty();
    }

    flushNow(): void {
        this.flushToDisk();
    }

    dispose(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = undefined;
        }
        this.flushToDisk();
    }

    private markDirty(): void {
        this.dirty = true;
        if (this.flushTimer) {
            return;
        }
        this.flushTimer = setTimeout(
            () => {
                this.flushTimer = undefined;
                this.flushToDisk();
            },
            Math.max(50, this.flushDelayMs),
        );
    }

    private flushToDisk(): void {
        if (!this.dirty) {
            return;
        }

        try {
            const entries: RuntimeTileEntry[] = [];
            for (const [tileKey, byPair] of this.pairsByTile.entries()) {
                const [levelRaw, xRaw, yRaw] = tileKey.split(":");
                const level = parseInt(levelRaw, 10);
                const x = parseInt(xRaw, 10);
                const y = parseInt(yRaw, 10);
                if (Number.isNaN(level) || Number.isNaN(x) || Number.isNaN(y)) {
                    continue;
                }

                const pairs = [...byPair.values()]
                    .map((entry) => ({
                        closed: entry.closed,
                        opened: entry.opened,
                        count: Math.max(1, entry.count),
                        lastObserved: entry.lastObserved,
                    }))
                    .sort(
                        (a, b) => b.count - a.count || a.closed - b.closed || a.opened - b.opened,
                    );

                if (pairs.length === 0) {
                    continue;
                }

                entries.push({ level, x, y, pairs });
            }

            entries.sort((a, b) => a.level - b.level || a.x - b.x || a.y - b.y);
            const payload: PersistedRuntimeDoorTileMap = {
                version: 1,
                generatedAt: new Date().toISOString(),
                entries,
            };

            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            writeRuntimeTileMappingsToFile(this.filePath, payload);
            this.dirty = false;
        } catch (err) {
            logger.warn(`[DoorRuntimeTileMappingStore] Failed to flush ${this.filePath}`, err);
        }
    }

    private load(): void {
        if (!fs.existsSync(this.filePath)) {
            return;
        }

        try {
            const parsed = readRuntimeTileMappingsFromFile(this.filePath);
            const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

            for (const entry of entries) {
                const level = entry.level;
                const x = entry.x;
                const y = entry.y;
                const tileKey = this.makeTileKey(level, x, y);
                const byPair =
                    this.pairsByTile.get(tileKey) ?? new Map<string, RuntimeTilePairStats>();
                const pairs = Array.isArray(entry?.pairs) ? entry.pairs : [];

                for (const pair of pairs) {
                    const closed = pair.closed;
                    const opened = pair.opened;
                    if (closed <= 0 || opened <= 0 || closed === opened) {
                        continue;
                    }
                    const pairKey = this.makePairKey(closed, opened);
                    byPair.set(pairKey, {
                        closed,
                        opened,
                        count: Math.max(1, pair.count),
                        lastObserved: pair.lastObserved.length > 0 ? pair.lastObserved : new Date(0).toISOString(),
                    });
                }

                if (byPair.size > 0) {
                    this.pairsByTile.set(tileKey, byPair);
                }
            }

            logger.info(
                `[DoorRuntimeTileMappingStore] Loaded ${this.pairsByTile.size} tile mapping(s) from ${this.filePath}`,
            );
        } catch (err) {
            logger.warn(`[DoorRuntimeTileMappingStore] Failed to load ${this.filePath}`, err);
        }
    }

    private makeTileKey(level: number, x: number, y: number): string {
        return `${level}:${x}:${y}`;
    }

    private makePairKey(closed: number, opened: number): string {
        return `${closed}:${opened}`;
    }
}
