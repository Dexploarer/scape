import { describe, expect, test } from "bun:test";

import {
    buildAgentPromptDocument,
    encodeAgentPromptToToon,
    type AgentPromptAssemblyInput,
} from "../src/shared/agent-context";

function makeInput(): AgentPromptAssemblyInput {
    return {
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
        self: {
            agentId: "scape-miner-01",
            tick: 1234,
            playerId: 7,
            x: 3222,
            z: 3218,
            level: 0,
            hp: 17,
            maxHp: 23,
            runEnergy: 91,
            inCombat: false,
            freeInventorySlots: 9,
            inventoryFull: false,
            lowHp: false,
            moving: true,
            movementLocked: false,
            bankOpen: false,
            dialogueOpen: false,
        },
        objective: {
            agentId: "scape-miner-01",
            mode: "gather",
            goal: "mine copper ore in varrock and bank when full",
            priority: 90,
            successSignal: "inventory_full",
            fallbackAction: "walk to east bank",
            operatorDirective: "mine copper ore in varrock",
        },
        affordances: [
            {
                slotId: "bank-booth-east",
                agentId: "scape-miner-01",
                kind: "bank",
                label: "open bank",
                reachable: true,
                score: 0.41,
                distance: 14,
            },
            {
                slotId: "copper-east-1",
                agentId: "scape-miner-01",
                kind: "resource",
                label: "mine copper",
                reachable: true,
                score: 0.94,
                distance: 2,
            },
            {
                slotId: "goblin-9",
                agentId: "scape-miner-01",
                kind: "threat",
                label: "avoid goblin",
                reachable: false,
                score: 0.18,
                distance: 6,
            },
        ],
        recent: [
            {
                slotId: "evt-2",
                agentId: "scape-miner-01",
                rank: 2,
                kind: "operator_command",
                message: "mine copper ore in varrock",
            },
            {
                slotId: "evt-1",
                agentId: "scape-miner-01",
                rank: 1,
                kind: "action_result",
                code: "path_started",
                message: "walking toward copper-east-1",
            },
        ],
        memory: [
            {
                slotId: "mem-2",
                agentId: "scape-miner-01",
                kind: "failure",
                fact: "west rock is often blocked by players",
                confidence: 0.71,
                score: 0.71,
                sourceKind: "summary",
            },
            {
                slotId: "mem-1",
                agentId: "scape-miner-01",
                kind: "route",
                fact: "varrock east bank to copper rocks is safe",
                confidence: 0.82,
                score: 0.82,
                sourceKind: "fact",
            },
        ],
        team: [
            {
                slotId: "team-1",
                agentId: "scape-miner-01",
                teamId: "miners",
                kind: "directive",
                message: "miners prioritize eastern rocks",
                score: 0.63,
                sourceAgentId: "foreman-1",
            },
        ],
        freshDelta: {
            kind: "action_result",
            status: "progress",
            code: "path_started",
            message: "walking toward (3223,3218)",
        },
    };
}

describe("agent prompt contract", () => {
    test("buildAgentPromptDocument sorts and caps ranked sections deterministically", () => {
        const document = buildAgentPromptDocument(makeInput(), {
            maxAffordances: 2,
            maxMemory: 1,
        });

        expect(document.affordances).toHaveLength(2);
        expect(document.affordances[0]?.id).toBe("copper-east-1");
        expect(document.affordances[1]?.id).toBe("bank-booth-east");

        expect(document.recent[0]?.kind).toBe("action_result");
        expect(document.recent[1]?.kind).toBe("operator_command");

        expect(document.memory).toHaveLength(1);
        expect(document.memory[0]?.kind).toBe("route");
        expect(document.freshDelta?.kind).toBe("action_result");
    });

    test("encodeAgentPromptToToon emits a table-friendly TOON document", () => {
        const toon = encodeAgentPromptToToon(makeInput(), {
            maxAffordances: 2,
            maxRecent: 2,
            maxMemory: 2,
            maxTeam: 1,
        });

        expect(toon).toContain("identity:");
        expect(toon).toContain("objective:");
        expect(toon).toContain(
            "affordances[2]{id,kind,label,reachable,distance,score,targetType,targetId,reasonUnavailable}:",
        );
        expect(toon).toContain("recent[2]{kind,message,code}:");
        expect(toon).toContain("memory[2]{kind,fact,confidence,score,sourceKind}:");
        expect(toon).toContain("freshDelta:");
    });
});
