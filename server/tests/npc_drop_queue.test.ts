import { describe, expect, it, vi } from "vitest";

import { NpcManager } from "../src/game/npcManager";

describe("NpcManager delayed NPC drops", () => {
    it("spawns queued NPC drops only when the despawn tick is reached", () => {
        const manager = new NpcManager(
            {} as any,
            {} as any,
            { load: () => undefined } as any,
            {} as any,
        );
        const spawned: Array<{
            itemId: number;
            quantity: number;
            ownerId?: number;
            privateTicks?: number;
        }> = [];
        manager.setGroundItemSpawner((itemId, quantity, _tile, _tick, options) => {
            spawned.push({
                itemId,
                quantity,
                ownerId: options?.ownerId,
                privateTicks: options?.privateTicks,
            });
        });

        const npc = {
            id: 1,
            tileX: 3200,
            tileY: 3200,
            level: 0,
            clearPath: vi.fn(),
            clearInteraction: vi.fn(),
        };
        (manager as any).npcs.set(1, npc);

        const queued = manager.queueDeath(1, 5, 10, [
            {
                itemId: 995,
                quantity: 50,
                tile: { x: 3200, y: 3200, level: 0 },
                ownerId: 7,
                isMonsterDrop: true,
                isWilderness: false,
            },
        ]);

        expect(queued).toBe(true);

        manager.tick(4, undefined, new Set());
        expect(spawned).toHaveLength(0);

        manager.tick(5, undefined, new Set());
        expect(spawned).toHaveLength(1);
        expect(spawned[0]).toEqual({
            itemId: 995,
            quantity: 50,
            ownerId: 7,
            privateTicks: undefined,
        });
    });
});
