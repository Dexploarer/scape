export type ActorKind = "npc" | "player";

export interface Actor {
    kind: ActorKind;
    id: number; // npcTypeId for NPCs, index or reserved for players
    x: number; // sub-tile (0..8192 in local map coords)
    y: number; // sub-tile (0..8192 in local map coords)
    level: number;
    rotation: number; // 0..2047
}
