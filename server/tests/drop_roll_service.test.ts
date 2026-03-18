import { describe, expect, it, vi } from "vitest";

import { getItemDefinition } from "../src/data/items";
import { DropRollService } from "../src/game/drops/DropRollService";
import { resolveDropTable } from "../src/game/drops/helpers";

describe("DropRollService", () => {
    it("applies the League V multiplier only to eligible drops", () => {
        const table = resolveDropTable({
            pools: [
                {
                    kind: "independent",
                    category: "main",
                    entries: [
                        { itemId: 995, quantity: 1, rarity: 0.25, leagueBoostEligible: true },
                        { itemId: 526, quantity: 1, rarity: 0.25 },
                    ],
                },
                {
                    kind: "independent",
                    category: "tertiary",
                    entries: [{ itemId: 532, quantity: 1, rarity: 0.25 }],
                },
            ],
        });

        expect(table).toBeDefined();
        const service = new DropRollService({ get: () => table } as any);
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);

        const boosted = service.roll({
            npcTypeId: 1,
            npcName: "Test NPC",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [{ ownerId: 1, isLeagueVWorld: true, leagueDropRateMultiplier: 2 }],
        });
        expect(boosted).toHaveLength(1);
        expect(boosted[0].itemId).toBe(995);
        expect(boosted[0].ownerId).toBe(1);

        const unboosted = service.roll({
            npcTypeId: 1,
            npcName: "Test NPC",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [{ ownerId: 1, isLeagueVWorld: false, leagueDropRateMultiplier: 1 }],
        });
        expect(unboosted).toHaveLength(0);

        randomSpy.mockRestore();
    });

    it("rolls separate owner-tagged drops for multiple recipients", () => {
        const table = resolveDropTable({
            always: [{ itemId: 995, quantity: 10, rarity: "Always" }],
        });

        expect(table).toBeDefined();
        const service = new DropRollService({ get: () => table } as any);
        const drops = service.roll({
            npcTypeId: 1,
            npcName: "Shared NPC",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [
                { ownerId: 1, isLeagueVWorld: false, leagueDropRateMultiplier: 1 },
                { ownerId: 2, isLeagueVWorld: true, leagueDropRateMultiplier: 5 },
            ],
        });

        expect(drops).toHaveLength(2);
        expect(drops.map((drop) => drop.ownerId)).toEqual([1, 2]);
        expect(drops.map((drop) => drop.quantity)).toEqual([10, 10]);
    });

    it("applies League V combined-drop substitutions for covered bosses", () => {
        const table = resolveDropTable({
            always: [{ itemId: 12932, quantity: 1, rarity: "Always" }],
        });

        expect(table).toBeDefined();
        const service = new DropRollService({ get: () => table } as any);

        const leagueDrop = service.roll({
            npcTypeId: 2042,
            npcName: "Zulrah",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [{ ownerId: 1, isLeagueVWorld: true, leagueDropRateMultiplier: 1 }],
        });
        expect(leagueDrop).toHaveLength(1);
        expect(getItemDefinition(leagueDrop[0].itemId)?.name).toBe("Uncharged toxic trident");

        const normalDrop = service.roll({
            npcTypeId: 2042,
            npcName: "Zulrah",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [{ ownerId: 1, isLeagueVWorld: false, leagueDropRateMultiplier: 1 }],
        });
        expect(normalDrop).toHaveLength(1);
        expect(getItemDefinition(normalDrop[0].itemId)?.name).toBe("Magic fang");
    });

    it("uses alternate rarity conditions for wilderness clue modifiers", () => {
        const table = resolveDropTable({
            pools: [
                {
                    kind: "independent",
                    category: "tertiary",
                    entries: [
                        {
                            itemId: 2677,
                            quantity: 1,
                            rarity: "1/128",
                            altRarity: "1/64",
                            altCondition: {
                                wildernessOnly: true,
                                requiredAnyEquippedItemIds: [12785],
                            },
                        },
                    ],
                },
            ],
        });

        expect(table).toBeDefined();
        const service = new DropRollService({ get: () => table } as any);
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.01);
        const ringPlayer = {
            exportEquipmentSnapshot: () => [{ slot: 12, itemId: 12785 }],
            getVarpValue: () => 0,
        };

        const wildernessDrop = service.roll({
            npcTypeId: 1,
            npcName: "Goblin",
            tile: { x: 3200, y: 3600, level: 0 },
            isWilderness: true,
            recipients: [
                {
                    ownerId: 1,
                    player: ringPlayer as any,
                    isLeagueVWorld: false,
                    leagueDropRateMultiplier: 1,
                },
            ],
        });
        expect(wildernessDrop).toHaveLength(1);
        expect(wildernessDrop[0].itemId).toBe(2677);

        const safeDrop = service.roll({
            npcTypeId: 1,
            npcName: "Goblin",
            tile: { x: 3200, y: 3200, level: 0 },
            isWilderness: false,
            recipients: [
                {
                    ownerId: 1,
                    player: ringPlayer as any,
                    isLeagueVWorld: false,
                    leagueDropRateMultiplier: 1,
                },
            ],
        });
        expect(safeDrop).toHaveLength(0);

        randomSpy.mockRestore();
    });
});
