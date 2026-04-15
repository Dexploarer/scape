import type { SpellCastModifiers } from "../network/GameMessageDtos";

export type SpellTargetKind = "npc" | "player" | "loc" | "obj";

export type SpellCastTarget =
    | { type: "npc"; npcId: number }
    | { type: "player"; playerId: number }
    | { type: "loc"; locId: number; tile: { x: number; y: number; plane?: number } }
    | { type: "obj"; objId: number; tile: { x: number; y: number; plane?: number } };

export interface SpellCastRequest {
    spellId: number;
    modifiers?: SpellCastModifiers;
    target: SpellCastTarget;
}
