import { describe, expect, test } from "bun:test";

import { SKILL_IDS } from "../src/rs/skill/skills";
import { BotSdkPerceptionBuilder } from "../server/src/network/botsdk/BotSdkPerceptionBuilder";
import type { PlayerState } from "../server/src/game/player";
import type { ServerServices } from "../server/src/game/ServerServices";
import type { DynamicLocChangeState } from "../server/src/world/DynamicLocStateStore";
import type { GroundItemStack } from "../server/src/game/items/GroundItemManager";
import type { NpcState } from "../server/src/game/npc";

type SkillEntryLike = {
    baseLevel: number;
    boost: number;
    xp: number;
};

type MockPlayerOptions = {
    id: number;
    name: string;
    tileX: number;
    tileY: number;
    level?: number;
    worldViewId?: number;
    combatLevel?: number;
    hp?: number;
    maxHp?: number;
    runEnergy?: number;
    specialEnergy?: number;
    specialAttackActive?: boolean;
    activePrayers?: string[];
    quickPrayersEnabled?: boolean;
    accountStage?: number;
    inCombat?: boolean;
    target?: unknown;
    inventory?: Array<{ itemId: number; quantity: number } | undefined>;
    equipment?: Array<{ slot: number; itemId: number; quantity?: number }>;
    agent?: Record<string, unknown>;
};

type MockNpcOptions = {
    id: number;
    typeId: number;
    tileX: number;
    tileY: number;
    level?: number;
    size?: number;
    worldViewId?: number;
    name?: string;
    hp?: number;
    combatLevel?: number;
    inCombat?: boolean;
};

function createSkillSystem(
    combatLevel: number,
    hp: number,
    maxHp: number,
    overrides: Partial<Record<number, Partial<SkillEntryLike>>> = {},
) {
    const skills = new Map<number, SkillEntryLike>();
    for (const id of SKILL_IDS) {
        const override = overrides[id] ?? {};
        skills.set(id, {
            baseLevel: override.baseLevel ?? (id === 3 ? maxHp : 50),
            boost: override.boost ?? 0,
            xp: override.xp ?? 13_034_431,
        });
    }

    return {
        combatLevel,
        getHitpointsCurrent: () => hp,
        getHitpointsMax: () => maxHp,
        getSkill: (id: number) => skills.get(id)!,
    };
}

function createMockPlayer(options: MockPlayerOptions): PlayerState {
    const inventory = new Array(28).fill(undefined) as Array<
        { itemId: number; quantity: number } | undefined
    >;
    for (let slot = 0; slot < (options.inventory?.length ?? 0); slot++) {
        inventory[slot] = options.inventory?.[slot];
    }

    return {
        id: options.id,
        name: options.name,
        tileX: options.tileX,
        tileY: options.tileY,
        level: options.level ?? 0,
        worldViewId: options.worldViewId ?? -1,
        skillSystem: createSkillSystem(
            options.combatLevel ?? 75,
            options.hp ?? 55,
            options.maxHp ?? 70,
        ),
        energy: {
            getRunEnergyPercent: () => options.runEnergy ?? 88,
        },
        specEnergy: {
            getPercent: () => options.specialEnergy ?? 100,
            isActivated: () => options.specialAttackActive ?? false,
        },
        prayer: {
            getActivePrayers: () => new Set(options.activePrayers ?? []),
            areQuickPrayersEnabled: () => options.quickPrayersEnabled ?? false,
        },
        account: {
            accountStage: options.accountStage ?? 1,
        },
        combat: {
            isAttacking: () => options.inCombat ?? false,
            getCombatTarget: () => options.target ?? null,
        },
        isBeingAttacked: () => options.inCombat ?? false,
        items: {
            getInventoryEntries: () => inventory,
        },
        exportEquipmentSnapshot: () => options.equipment ?? [],
        agent: options.agent as PlayerState["agent"],
    } as unknown as PlayerState;
}

function createMockNpc(options: MockNpcOptions): NpcState {
    return {
        id: options.id,
        typeId: options.typeId,
        tileX: options.tileX,
        tileY: options.tileY,
        level: options.level ?? 0,
        size: options.size ?? 1,
        worldViewId: options.worldViewId ?? -1,
        name: options.name,
        getHitpoints: () => options.hp ?? 10,
        getCombatLevel: () => options.combatLevel ?? 2,
        isInCombat: () => options.inCombat ?? false,
    } as unknown as NpcState;
}

function createServices(options: {
    players: PlayerState[];
    npcs?: NpcState[];
    groundItems?: GroundItemStack[];
    placements?: Array<{ id: number; x: number; y: number; level: number; type: number; rotation: number }>;
    dynamicChanges?: DynamicLocChangeState[];
    itemNames?: Record<number, string>;
    npcNames?: Record<number, string>;
    locDefs?: Record<number, { name?: string; actions?: string[]; isInteractive?: number }>;
}): ServerServices {
    const placements = options.placements ?? [];
    const players = options.players;
    const npcs = options.npcs ?? [];
    const locDefs = options.locDefs ?? {};

    const getLocsAtTile = (level: number, x: number, y: number) =>
        placements.filter((entry) => entry.level === level && entry.x === x && entry.y === y);

    return {
        dataLoaderService: {
            getObjType: (itemId: number) =>
                options.itemNames?.[itemId]
                    ? ({ name: options.itemNames[itemId] } as Record<string, unknown>)
                    : undefined,
            getLocDefinition: (locId: number) =>
                locDefs[locId]
                    ? ({
                          name: locDefs[locId].name,
                          actions: locDefs[locId].actions,
                          isInteractive: locDefs[locId].isInteractive ?? -1,
                      } as Record<string, unknown>)
                    : undefined,
        },
        players: {
            getAllPlayersForSync: () => players,
            getById: (id: number) => players.find((player) => player.id === id),
        },
        npcManager: {
            getNearby: () => npcs,
            getNpcType: (npc: NpcState | number) => {
                const typeId = typeof npc === "number" ? npc : npc.typeId;
                const name = options.npcNames?.[typeId];
                return name ? ({ name, actions: ["Talk-to", "Attack"] } as Record<string, unknown>) : undefined;
            },
        },
        groundItems: {
            queryArea: () => options.groundItems ?? [],
        },
        locTileLookup: {
            getLocsAtTile,
            getLocAt: (level: number, x: number, y: number, idHint?: number) =>
                getLocsAtTile(level, x, y).find((entry) => idHint === undefined || entry.id === idHint),
        },
        dynamicLocState: {
            queryScene: () => options.dynamicChanges ?? [],
        },
    } as unknown as ServerServices;
}

describe("BotSdkPerceptionBuilder", () => {
    test("builds an additive bounded snapshot with equipment, target, objects, and recent events", () => {
        const agent = createMockPlayer({
            id: 1,
            name: "agent",
            tileX: 3200,
            tileY: 3200,
            combatLevel: 90,
            hp: 62,
            maxHp: 70,
            runEnergy: 73,
            specialEnergy: 55,
            specialAttackActive: true,
            activePrayers: ["smite", "protect_from_magic"],
            quickPrayersEnabled: true,
            accountStage: 3,
            inCombat: true,
            target: {
                id: 2,
                isPlayer: true,
                tileX: 3202,
                tileY: 3200,
                level: 0,
            },
            inventory: [
                undefined,
                undefined,
                { itemId: 4151, quantity: 1 },
                { itemId: 995, quantity: 7500 },
            ],
            equipment: [
                { slot: 3, itemId: 4151 },
                { slot: 13, itemId: 9244, quantity: 150 },
            ],
            agent: { connected: true },
        });
        const human = createMockPlayer({
            id: 2,
            name: "human",
            tileX: 3202,
            tileY: 3200,
            inCombat: false,
        });
        const helperAgent = createMockPlayer({
            id: 3,
            name: "helper",
            tileX: 3201,
            tileY: 3201,
            inCombat: true,
            agent: { connected: true },
        });

        const goblin = createMockNpc({
            id: 200,
            typeId: 100,
            tileX: 3201,
            tileY: 3200,
            hp: 7,
            combatLevel: 5,
            inCombat: true,
        });

        const services = createServices({
            players: [agent, human, helperAgent],
            npcs: [goblin],
            groundItems: [
                {
                    id: 1,
                    itemId: 995,
                    quantity: 50,
                    tile: { x: 3201, y: 3200, level: 0 },
                    worldViewId: -1,
                    createdTick: 0,
                },
                {
                    id: 2,
                    itemId: 526,
                    quantity: 1,
                    tile: { x: 3200, y: 3202, level: 0 },
                    worldViewId: -1,
                    createdTick: 0,
                },
            ],
            placements: [
                { id: 500, x: 3201, y: 3200, level: 0, type: 10, rotation: 1 },
                { id: 700, x: 3203, y: 3200, level: 0, type: 10, rotation: 2 },
                { id: 900, x: 3205, y: 3200, level: 0, type: 22, rotation: 0 },
            ],
            dynamicChanges: [
                {
                    oldId: 700,
                    newId: 701,
                    level: 0,
                    oldTile: { x: 3203, y: 3200 },
                    newTile: { x: 3203, y: 3200 },
                    oldRotation: 2,
                    newRotation: 3,
                    newShape: 22,
                },
            ],
            itemNames: {
                4151: "Abyssal whip",
                9244: "Dragon bolts (e)",
                995: "Coins",
                526: "Bones",
            },
            npcNames: {
                100: "Goblin",
            },
            locDefs: {
                500: { name: "Bank booth", actions: ["Bank"], isInteractive: 1 },
                700: { name: "Closed chest", actions: ["Open"], isInteractive: 1 },
                701: { name: "Open chest", actions: ["Close"], isInteractive: 1 },
                900: { name: "null", actions: [], isInteractive: 0 },
            },
        });

        const builder = new BotSdkPerceptionBuilder({
            services: () => services,
            maxRecentEvents: 12,
            recentEvents: {
                getRecentForPlayer: () =>
                    Array.from({ length: 13 }, (_, index) => ({
                        kind: `evt_${index}`,
                        message: `event ${index}`,
                        timestamp: 1000 + index,
                    })),
            },
        });

        const snapshot = builder.build(agent, 450);

        expect(snapshot.self).toEqual({
            id: 1,
            name: "agent",
            combatLevel: 90,
            hp: 62,
            maxHp: 70,
            x: 3200,
            z: 3200,
            level: 0,
            runEnergy: 73,
            specialEnergy: 55,
            specialAttackActive: true,
            activePrayers: ["protect_from_magic", "smite"],
            quickPrayersEnabled: true,
            accountStage: 3,
            worldViewId: -1,
            inCombat: true,
            target: {
                kind: "player",
                id: 2,
                name: "human",
                x: 3202,
                z: 3200,
                level: 0,
            },
        });

        expect(snapshot.inventory).toEqual([
            { slot: 2, itemId: 4151, name: "Abyssal whip", count: 1 },
            { slot: 3, itemId: 995, name: "Coins", count: 7500 },
        ]);
        expect(snapshot.equipment).toEqual([
            { slot: 3, itemId: 4151, name: "Abyssal whip", count: 1 },
            { slot: 13, itemId: 9244, name: "Dragon bolts (e)", count: 150 },
        ]);

        expect(snapshot.nearbyPlayers.map((entry) => entry.id)).toEqual([3, 2]);
        expect(snapshot.nearbyPlayers[0]?.isAgent).toBe(true);

        expect(snapshot.nearbyNpcs).toEqual([
            {
                id: 200,
                defId: 100,
                name: "Goblin",
                x: 3201,
                z: 3200,
                level: 0,
                distance: 1,
                hp: 7,
                combatLevel: 5,
                inCombat: true,
                actions: ["Talk-to", "Attack"],
            },
        ]);

        expect(snapshot.nearbyGroundItems.map((entry) => [entry.itemId, entry.distance])).toEqual([
            [995, 1],
            [526, 2],
        ]);

        expect(snapshot.nearbyObjects).toEqual([
            {
                locId: 500,
                name: "Bank booth",
                x: 3201,
                z: 3200,
                type: 10,
                rotation: 1,
                distance: 1,
                actions: ["Bank"],
            },
            {
                locId: 701,
                name: "Open chest",
                x: 3203,
                z: 3200,
                type: 22,
                rotation: 3,
                distance: 3,
                actions: ["Close"],
            },
        ]);

        expect(snapshot.recentEvents).toHaveLength(12);
        expect(snapshot.recentEvents[0]?.kind).toBe("evt_1");
        expect(snapshot.recentEvents[11]?.kind).toBe("evt_12");
    });

    test("sorts and caps nearby collections deterministically", () => {
        const agent = createMockPlayer({
            id: 1,
            name: "agent",
            tileX: 3200,
            tileY: 3200,
        });
        const players = [
            agent,
            createMockPlayer({ id: 7, name: "bravo", tileX: 3201, tileY: 3201 }),
            createMockPlayer({ id: 5, name: "alpha", tileX: 3201, tileY: 3200 }),
            createMockPlayer({ id: 9, name: "charlie", tileX: 3202, tileY: 3200 }),
        ];
        const npcs = [
            createMockNpc({ id: 30, typeId: 102, tileX: 3201, tileY: 3201, combatLevel: 12 }),
            createMockNpc({ id: 20, typeId: 101, tileX: 3201, tileY: 3200, combatLevel: 3 }),
            createMockNpc({ id: 10, typeId: 100, tileX: 3202, tileY: 3200, combatLevel: 5 }),
        ];
        const services = createServices({
            players,
            npcs,
            groundItems: [
                {
                    id: 1,
                    itemId: 300,
                    quantity: 1,
                    tile: { x: 3201, y: 3200, level: 0 },
                    worldViewId: -1,
                    createdTick: 0,
                },
                {
                    id: 2,
                    itemId: 200,
                    quantity: 1,
                    tile: { x: 3201, y: 3200, level: 0 },
                    worldViewId: -1,
                    createdTick: 0,
                },
                {
                    id: 3,
                    itemId: 100,
                    quantity: 1,
                    tile: { x: 3202, y: 3200, level: 0 },
                    worldViewId: -1,
                    createdTick: 0,
                },
            ],
            placements: [
                { id: 601, x: 3201, y: 3200, level: 0, type: 10, rotation: 0 },
                { id: 600, x: 3201, y: 3200, level: 0, type: 10, rotation: 1 },
                { id: 602, x: 3202, y: 3200, level: 0, type: 10, rotation: 0 },
            ],
            itemNames: {
                100: "C",
                200: "B",
                300: "A",
            },
            npcNames: {
                100: "C",
                101: "A",
                102: "B",
            },
            locDefs: {
                600: { name: "B", actions: ["Use"], isInteractive: 1 },
                601: { name: "A", actions: ["Use"], isInteractive: 1 },
                602: { name: "C", actions: ["Use"], isInteractive: 1 },
            },
        });
        const builder = new BotSdkPerceptionBuilder({
            services: () => services,
            maxNearbyPlayers: 2,
            maxNearbyNpcs: 2,
            maxNearbyGroundItems: 2,
            maxNearbyObjects: 2,
        });

        const snapshot = builder.build(agent, 100);

        expect(snapshot.nearbyPlayers.map((entry) => entry.id)).toEqual([5, 7]);
        expect(snapshot.nearbyNpcs.map((entry) => entry.id)).toEqual([20, 30]);
        expect(snapshot.nearbyGroundItems.map((entry) => entry.itemId)).toEqual([200, 300]);
        expect(snapshot.nearbyObjects.map((entry) => entry.locId)).toEqual([600, 601]);
    });

    test("returns no nearby objects for non-overworld world views", () => {
        const player = createMockPlayer({
            id: 1,
            name: "agent",
            tileX: 3200,
            tileY: 3200,
            worldViewId: 77,
        });
        const services = createServices({
            players: [player],
            placements: [{ id: 500, x: 3201, y: 3200, level: 0, type: 10, rotation: 0 }],
            locDefs: {
                500: { name: "Bank booth", actions: ["Bank"], isInteractive: 1 },
            },
        });
        const builder = new BotSdkPerceptionBuilder({
            services: () => services,
        });

        expect(builder.build(player, 50).nearbyObjects).toEqual([]);
    });
});
