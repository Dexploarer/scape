import { FloorDecoration } from "./FloorDecoration";
import { Loc } from "./Loc";
import { SceneTileModel } from "./SceneTileModel";
import { Wall } from "./Wall";
import { WallDecoration } from "./WallDecoration";

export class SceneTile {
    originalLevel: number;
    level: number;
    x: number;
    y: number;
    minLevel: number;
    // When a bridge flag is present, OSRS links the original ground tile
    // below the shifted column. We keep a pointer to that tile so renderers
    // can draw both surfaces for correct visibility.
    linkedBelow?: SceneTile;
    // True when this tile on level 0 was shifted down from level 1 due to bridge flag
    // (helps downstream consumers adjust object render planes/height sampling)
    isBridgeSurface?: boolean;
    // When true, this tile is kept for metadata (locs/walls) but should not emit terrain geometry.
    skipRender?: boolean;

    tileModel?: SceneTileModel;
    floorDecoration?: FloorDecoration;
    wall?: Wall;
    wallDecoration?: WallDecoration;
    locs: Loc[];

    constructor(level: number, x: number, y: number) {
        this.originalLevel = this.level = level;
        this.x = x;
        this.y = y;
        this.minLevel = 0;
        this.locs = [];
    }
}
