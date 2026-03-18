import { getMapIndexFromTile } from "../../../rs/map/MapFileIndex";
import objSpawnsUrl from "./obj-spawns.json?url";

export interface ObjSpawn {
    id: number;
    count: number;
    x: number;
    y: number;
    plane: number;
}

export async function fetchObjSpawns(): Promise<ObjSpawn[]> {
    const response = await fetch(objSpawnsUrl);
    return await response.json();
}

export function getMapObjSpawns(
    spawns: ObjSpawn[],
    maxLevel: number,
    mapX: number,
    mapY: number,
): ObjSpawn[] {
    return spawns.filter((obj) => {
        const objMapX = getMapIndexFromTile(obj.x);
        const objMapY = getMapIndexFromTile(obj.y);
        return mapX === objMapX && mapY === objMapY && obj.plane <= maxLevel;
    });
}
