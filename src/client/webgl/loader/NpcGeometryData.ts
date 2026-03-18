import { NpcData } from "../npc/NpcData";

export type NpcGeometryData = {
    mapX: number;
    mapY: number;
    borderSize: number;
    npcs: NpcData[];
    vertices: Uint8Array;
    indices: Int32Array;
    loadedTextures: Map<number, Int32Array>;
};
