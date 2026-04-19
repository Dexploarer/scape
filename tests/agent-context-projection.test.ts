import { describe, expect, test } from "bun:test";

import { buildAgentPromptDocument } from "../src/shared/agent-context";
import {
    buildProjectedPromptAssemblyInput,
    inferAffordanceSlotsFromSnapshot,
    toFreshDeltaFromActionResult,
} from "../server/src/agent";

function makeSnapshot() {
    return {
        tick: 1234,
        self: {
            id: 7,
            name: "miner01",
            combatLevel: 12,
            hp: 17,
            maxHp: 23,
            x: 3222,
            z: 3218,
            level: 0,
            runEnergy: 91,
            inCombat: false,
        },
        skills: [],
        inventory: [
            { slot: 0, itemId: 436, name: "Copper ore", count: 9 },
        ],
        equipment: [],
        ui: { openInterface: "none" as const },
        constraints: {
            freeInventorySlots: 19,
            inventoryFull: false,
            lowHp: false,
            moving: true,
            movementLocked: false,
            bankOpen: false,
            dialogueOpen: false,
        },
        nearbyNpcs: [
            {
                id: 99,
                defId: 1001,
                name: "Goblin",
                x: 3225,
                z: 3219,
                hp: 5,
                combatLevel: 2,
            },
        ],
        nearbyPlayers: [],
        nearbyGroundItems: [
            {
                itemId: 995,
                name: "Coins",
                x: 3223,
                z: 3218,
                count: 23,
            },
        ],
        nearbyObjects: [
            {
                locId: 7488,
                name: "Copper rock",
                x: 3223,
                z: 3218,
            },
            {
                locId: 6943,
                name: "Bank booth",
                x: 3234,
                z: 3218,
            },
        ],
        recentEvents: [
            {
                timestamp: 10,
                kind: "xp_gain",
                message: "Gained 17 XP in mining",
            },
            {
                timestamp: 11,
                kind: "operator_command",
                message: "mine copper ore in varrock",
            },
        ],
    };
}

describe("agent context projection", () => {
    test("infers ranked affordances from snapshot and objective relevance", () => {
        const affordances = inferAffordanceSlotsFromSnapshot(
            "scape-miner-01",
            makeSnapshot() as any,
            {
                agentId: "scape-miner-01",
                mode: "gather",
                goal: "mine copper ore in varrock and bank when full",
                priority: 90,
            },
        );

        expect(affordances[0]?.slotId).toBe("object:7488:3223:3218");
        expect(affordances[0]?.kind).toBe("resource");
        expect(affordances.some((row) => row.kind === "loot")).toBe(true);
        expect(affordances.some((row) => row.kind === "combat")).toBe(true);
        expect(affordances.some((row) => row.kind === "bank")).toBe(true);
    });

    test("buildProjectedPromptAssemblyInput maps live snapshot into the shared prompt contract", () => {
        const input = buildProjectedPromptAssemblyInput({
            profile: {
                agentId: "scape-miner-01",
                displayName: "miner01",
                runtimeKind: "milady",
                worldId: "vanilla",
                teamId: "miners",
            },
            session: {
                sessionId: "sess-1",
                agentId: "scape-miner-01",
                runId: "run-1",
                status: "active",
                botsdkPlayerId: 7,
                lastTick: 1234,
            },
            objective: {
                agentId: "scape-miner-01",
                mode: "gather",
                goal: "mine copper ore in varrock and bank when full",
                priority: 90,
                operatorDirective: "mine copper ore in varrock",
            },
            snapshot: makeSnapshot() as any,
            freshDelta: toFreshDeltaFromActionResult({
                kind: "actionResult",
                correlationId: "walk-1",
                status: "progress",
                code: "path_started",
                message: "walking toward (3223, 3218)",
            }),
        });

        expect(input.self?.x).toBe(3222);
        expect(input.self?.freeInventorySlots).toBe(19);
        expect(input.recent?.[0]?.kind).toBe("operator_command");
        expect(input.freshDelta?.kind).toBe("action_result");

        const document = buildAgentPromptDocument(input, {
            maxAffordances: 3,
            maxRecent: 2,
        });

        expect(document.identity.agentId).toBe("scape-miner-01");
        expect(document.affordances[0]?.kind).toBe("resource");
        expect(document.recent[0]?.kind).toBe("operator_command");
        expect(document.freshDelta?.kind).toBe("action_result");
    });
});
