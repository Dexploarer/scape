import { getCacheLoaderFactory } from "../../../src/rs/cache/loader/CacheLoaderFactory";
import { ByteBuffer } from "../../../src/rs/io/ByteBuffer";
import { logger } from "../utils/logger";
import type { CacheEnv } from "./CacheEnv";

export type LocTilePlacement = {
    id: number;
    x: number;
    y: number;
    level: number;
    type: number;
    rotation: number;
};

type SquareTileMap = Map<string, LocTilePlacement[]>;

export class LocTileLookupService {
    private readonly mapFileLoader: any;
    private readonly squareCache = new Map<number, SquareTileMap>();

    constructor(private readonly env: CacheEnv) {
        const factory = getCacheLoaderFactory(env.info, env.cacheSystem as any);
        this.mapFileLoader = factory.getMapFileLoader();
    }

    getLocAt(level: number, x: number, y: number, idHint?: number): LocTilePlacement | undefined {
        const placements = this.getLocsAtTile(level, x, y);
        if (placements.length === 0) {
            return undefined;
        }

        if (idHint !== undefined && Number.isFinite(idHint)) {
            const wanted = idHint;
            return placements.find((entry) => entry.id === wanted);
        }

        return placements[0];
    }

    getLocsAtTile(level: number, x: number, y: number): LocTilePlacement[] {
        const mapX = Math.floor(x / 64);
        const mapY = Math.floor(y / 64);
        if (mapX < 0 || mapY < 0) {
            return [];
        }

        const square = this.getOrLoadSquare(mapX, mapY);
        if (!square) {
            return [];
        }

        const tileKey = this.makeTileKey(level, x, y);
        const placements = square.get(tileKey);
        if (!placements || placements.length === 0) {
            return [];
        }

        return [...placements].sort(
            (a, b) => a.id - b.id || a.type - b.type || a.rotation - b.rotation,
        );
    }

    private getOrLoadSquare(mapX: number, mapY: number): SquareTileMap | undefined {
        const key = this.squareKey(mapX, mapY);
        const cached = this.squareCache.get(key);
        if (cached) {
            return cached;
        }

        const loaded = this.loadSquare(mapX, mapY);
        if (loaded) {
            this.squareCache.set(key, loaded);
            return loaded;
        }
        return undefined;
    }

    private loadSquare(mapX: number, mapY: number): SquareTileMap | undefined {
        const tileMap: SquareTileMap = new Map();
        const locArchiveId = this.env.mapFileIndex.getLocArchiveId(mapX, mapY);
        if (locArchiveId === -1) {
            return tileMap;
        }

        const locData = this.mapFileLoader.getLocData(mapX, mapY, this.env.xteas);
        if (!locData) {
            return tileMap;
        }

        try {
            this.decodeLocData(locData, mapX, mapY, (placement) => {
                const key = this.makeTileKey(placement.level, placement.x, placement.y);
                const list = tileMap.get(key);
                if (list) {
                    list.push(placement);
                } else {
                    tileMap.set(key, [placement]);
                }
            });
            return tileMap;
        } catch (err) {
            logger.warn(
                `[LocTileLookupService] Failed to decode loc archive for square (${mapX},${mapY})`,
                err,
            );
            return undefined;
        }
    }

    private decodeLocData(
        data: Int8Array,
        mapX: number,
        mapY: number,
        onPlacement: (placement: LocTilePlacement) => void,
    ): void {
        const buffer = new ByteBuffer(data);
        let id = -1;

        let idDelta: number;
        while (buffer.remaining > 0 && (idDelta = buffer.readSmart3()) !== 0) {
            id += idDelta;

            let pos = 0;
            let posDelta: number;
            while (buffer.remaining > 0 && (posDelta = buffer.readUnsignedSmart()) !== 0) {
                pos += posDelta - 1;
                const localX = (pos >> 6) & 0x3f;
                const localY = pos & 0x3f;
                const level = (pos >> 12) & 0x3;
                const attrs = buffer.readUnsignedByte();
                const type = attrs >> 2;
                const rotation = attrs & 0x3;

                onPlacement({
                    id: id,
                    x: (mapX << 6) + localX,
                    y: (mapY << 6) + localY,
                    level: level,
                    type: type,
                    rotation: rotation,
                });
            }
        }
    }

    private squareKey(mapX: number, mapY: number): number {
        return (mapX << 16) | (mapY & 0xffff);
    }

    private makeTileKey(level: number, x: number, y: number): string {
        return `${level}:${x}:${y}`;
    }
}
