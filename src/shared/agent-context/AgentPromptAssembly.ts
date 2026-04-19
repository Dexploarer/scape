import { encode } from "@toon-format/toon";

import type {
    AgentPromptAffordance,
    AgentPromptAssemblyInput,
    AgentPromptAssemblyOptions,
    AgentPromptDocument,
    AgentPromptMemory,
    AgentPromptRecentEvent,
    AgentPromptTeamContext,
} from "./AgentContextContract";
import { DEFAULT_AGENT_PROMPT_LIMITS } from "./AgentContextContract";

function compareOptionalNumberAsc(a?: number, b?: number): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
}

function compareStrings(a: string, b: string): number {
    return a.localeCompare(b);
}

export function buildAgentPromptDocument(
    input: AgentPromptAssemblyInput,
    options: AgentPromptAssemblyOptions = {},
): AgentPromptDocument {
    const limits = {
        ...DEFAULT_AGENT_PROMPT_LIMITS,
        ...options,
    };

    const affordances = [...(input.affordances ?? [])]
        .sort(
            (a, b) =>
                b.score - a.score ||
                Number(b.reachable) - Number(a.reachable) ||
                compareOptionalNumberAsc(a.distance, b.distance) ||
                compareStrings(a.slotId, b.slotId),
        )
        .slice(0, limits.maxAffordances)
        .map<AgentPromptAffordance>((row) => ({
            id: row.slotId,
            kind: row.kind,
            label: row.label,
            reachable: row.reachable,
            distance: row.distance ?? -1,
            score: row.score,
            targetType: row.targetType ?? "",
            targetId: row.targetId ?? "",
            reasonUnavailable: row.reasonUnavailable ?? "",
        }));

    const recent = [...(input.recent ?? [])]
        .sort(
            (a, b) =>
                a.rank - b.rank ||
                compareOptionalNumberAsc(b.occurredAt, a.occurredAt) ||
                compareStrings(a.slotId, b.slotId),
        )
        .slice(0, limits.maxRecent)
        .map<AgentPromptRecentEvent>((row) => ({
            kind: row.kind,
            message: row.message,
            code: row.code ?? "",
        }));

    const memory = [...(input.memory ?? [])]
        .sort(
            (a, b) =>
                b.score - a.score ||
                b.confidence - a.confidence ||
                compareStrings(a.slotId, b.slotId),
        )
        .slice(0, limits.maxMemory)
        .map<AgentPromptMemory>((row) => ({
            kind: row.kind,
            fact: row.fact,
            confidence: row.confidence,
            score: row.score,
            sourceKind: row.sourceKind ?? "",
        }));

    const team = [...(input.team ?? [])]
        .sort(
            (a, b) =>
                b.score - a.score ||
                compareStrings(a.slotId, b.slotId),
        )
        .slice(0, limits.maxTeam)
        .map<AgentPromptTeamContext>((row) => ({
            kind: row.kind,
            message: row.message,
            score: row.score,
            teamId: row.teamId ?? "",
            sourceAgentId: row.sourceAgentId ?? "",
        }));

    return {
        identity: {
            agentId: input.profile.agentId,
            displayName: input.profile.displayName,
            runtimeKind: input.profile.runtimeKind,
            worldId: input.profile.worldId,
            teamId: input.profile.teamId,
        },
        objective: input.objective
            ? {
                  mode: input.objective.mode,
                  goal: input.objective.goal,
                  priority: input.objective.priority,
                  status: input.objective.status,
                  summary: input.objective.summary,
                  successSignal: input.objective.successSignal,
                  fallbackAction: input.objective.fallbackAction,
                  operatorDirective: input.objective.operatorDirective,
              }
            : undefined,
        session: input.session
            ? {
                  runId: input.session.runId,
                  status: input.session.status,
                  botsdkPlayerId: input.session.botsdkPlayerId,
                  lastTick: input.session.lastTick,
              }
            : undefined,
        self: input.self
            ? {
                  tick: input.self.tick,
                  playerId: input.self.playerId,
                  x: input.self.x,
                  z: input.self.z,
                  level: input.self.level,
                  hp: input.self.hp,
                  maxHp: input.self.maxHp,
                  runEnergy: input.self.runEnergy,
                  inCombat: input.self.inCombat,
              }
            : undefined,
        constraints: input.self
            ? {
                  freeInventorySlots: input.self.freeInventorySlots,
                  inventoryFull: input.self.inventoryFull,
                  lowHp: input.self.lowHp,
                  moving: input.self.moving,
                  movementLocked: input.self.movementLocked,
                  bankOpen: input.self.bankOpen,
                  dialogueOpen: input.self.dialogueOpen,
              }
            : undefined,
        affordances,
        recent,
        memory,
        team,
        freshDelta: input.freshDelta,
    };
}

export function encodeAgentPromptToToon(
    input: AgentPromptAssemblyInput,
    options?: AgentPromptAssemblyOptions,
): string {
    const document = buildAgentPromptDocument(input, options);
    return encode(document as unknown as Record<string, unknown>);
}
