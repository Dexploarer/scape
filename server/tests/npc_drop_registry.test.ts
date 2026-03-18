import { describe, expect, it } from "vitest";

import { getItemDefinition } from "../src/data/items";
import { NpcDropRegistry } from "../src/game/drops/NpcDropRegistry";

describe("NpcDropRegistry", () => {
    it("resolves manual overrides without requiring npc type loading", () => {
        const registry = new NpcDropRegistry({
            load: () => {
                throw new Error("manual overrides should not load npc types");
            },
        } as any);

        const table = registry.get(2831);
        expect(table).toBeDefined();
        expect(table?.always.map((entry) => getItemDefinition(entry.itemId)?.name)).toEqual([
            "Bones",
            "Raw chicken",
        ]);
    });

    it("uses imported bootstrap tables even when the source row is marked incomplete", () => {
        const registry = new NpcDropRegistry({
            load: () => ({ name: "Rock Crab", combatLevel: 13 }),
        } as any);

        const table = registry.get(2693);
        expect(table).toBeDefined();
        expect((table?.always.length ?? 0) + (table?.pools.length ?? 0)).toBeGreaterThan(0);
    });

    it("resolves the live manual goblin table variants", () => {
        const registry = new NpcDropRegistry({
            load: () => {
                throw new Error("manual overrides should not load npc types");
            },
        } as any);

        const level2 = registry.get(3028);
        const level5 = registry.get(3045);
        const bonesOnly = registry.get(2246);
        const level2Items = level2?.pools.flatMap((pool) =>
            pool.entries.map((entry) => getItemDefinition(entry.itemId)?.name),
        );
        const level5Items = level5?.pools.flatMap((pool) =>
            pool.entries.map((entry) => getItemDefinition(entry.itemId)?.name),
        );

        expect(level2?.always.map((entry) => getItemDefinition(entry.itemId)?.name)).toEqual([
            "Bones",
        ]);
        expect(level5?.always.map((entry) => getItemDefinition(entry.itemId)?.name)).toEqual([
            "Bones",
        ]);
        expect(bonesOnly?.always.map((entry) => getItemDefinition(entry.itemId)?.name)).toEqual([
            "Bones",
        ]);
        expect(level2Items).toContain("Bronze sq shield");
        expect(level5Items).toContain("Bronze axe");
    });
});
