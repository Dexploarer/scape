import type { NpcState, NpcUpdateDelta } from "../game/npc";

export function buildTeleportNpcUpdateDelta(npc: NpcState): NpcUpdateDelta {
    return {
        id: npc.id,
        x: npc.x,
        y: npc.y,
        level: npc.level,
        rot: npc.rot,
        orientation: npc.getOrientation() & 2047,
        moved: true,
        turned: false,
        directions: [],
        traversals: [],
        snap: true,
        typeId: npc.typeId,
        size: npc.size,
        spawnX: npc.spawnX,
        spawnY: npc.spawnY,
        spawnLevel: npc.spawnLevel,
    };
}

export function upsertNpcUpdateDelta(target: NpcUpdateDelta[], delta: NpcUpdateDelta): void {
    const index = target.findIndex((entry) => entry?.id === delta.id);
    if (index === -1) {
        target.push({ ...delta });
        return;
    }

    const existing = target[index];
    target[index] = {
        ...existing,
        ...delta,
        directions: delta.directions !== undefined ? delta.directions : existing.directions,
        traversals: delta.traversals !== undefined ? delta.traversals : existing.traversals,
    };
}
