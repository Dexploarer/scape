import { Archive } from "../cache/Archive";
import { CacheIndex } from "../cache/CacheIndex";
import { Scene } from "../scene/Scene";

export function getMapSquareId(mapX: number, mapY: number): number {
    return (mapX << 8) + mapY;
}

export function getMapIndexFromTile(tile: number): number {
    return Math.floor(tile / Scene.MAP_SQUARE_SIZE);
}

export interface MapFileIndex {
    getTerrainArchiveId(mapX: number, mapY: number): number;
    getLocArchiveId(mapX: number, mapY: number): number;
    getTerrainFileId(mapX: number, mapY: number): number;
    getLocFileId(mapX: number, mapY: number): number;
}

class MapSquare {
    constructor(
        readonly mapId: number,
        readonly terrainArchiveId: number,
        readonly locArchiveId: number,
        readonly members: boolean,
    ) {}
}

export class DatMapFileIndex implements MapFileIndex {
    static load(versionListArchive: Archive): DatMapFileIndex {
        const file = versionListArchive.getFileNamed("map_index");
        if (!file) {
            throw new Error("map_index not found");
        }
        const buffer = file.getDataAsBuffer();

        const mapSquares = new Map<number, MapSquare>();

        const count = (buffer.remaining / 7) | 0;
        for (let i = 0; i < count; i++) {
            const mapId = buffer.readUnsignedShort();
            const terrainArchiveId = buffer.readUnsignedShort();
            const locArchiveId = buffer.readUnsignedShort();
            const members = buffer.readUnsignedByte() === 1;
            mapSquares.set(mapId, new MapSquare(mapId, terrainArchiveId, locArchiveId, members));
        }

        return new DatMapFileIndex(mapSquares);
    }

    constructor(readonly mapSquares: Map<number, MapSquare>) {}

    getTerrainArchiveId(mapX: number, mapY: number): number {
        return this.mapSquares.get(getMapSquareId(mapX, mapY))?.terrainArchiveId ?? -1;
    }

    getLocArchiveId(mapX: number, mapY: number): number {
        return this.mapSquares.get(getMapSquareId(mapX, mapY))?.locArchiveId ?? -1;
    }

    getTerrainFileId(_mapX: number, _mapY: number): number {
        return 0;
    }

    getLocFileId(_mapX: number, _mapY: number): number {
        return 0;
    }
}

export class Dat2MapIndex implements MapFileIndex {
    readonly named: boolean;

    constructor(readonly mapIndex: CacheIndex) {
        this.named = mapIndex.table.named;
    }

    getTerrainArchiveId(mapX: number, mapY: number): number {
        if (this.named) {
            return this.mapIndex.getArchiveId(`m${mapX}_${mapY}`);
        }
        const regionId = getMapSquareId(mapX, mapY);
        return this.mapIndex.archiveExists(regionId) ? regionId : -1;
    }

    getLocArchiveId(mapX: number, mapY: number): number {
        if (this.named) {
            return this.mapIndex.getArchiveId(`l${mapX}_${mapY}`);
        }
        const regionId = getMapSquareId(mapX, mapY);
        return this.mapIndex.archiveExists(regionId) ? regionId : -1;
    }

    getTerrainFileId(_mapX: number, _mapY: number): number {
        return 0;
    }

    getLocFileId(_mapX: number, _mapY: number): number {
        return this.named ? 0 : 1;
    }
}
