export type AgentContextMillis = number;

export type AgentObjectiveMode =
    | "idle"
    | "travel"
    | "gather"
    | "bank"
    | "dialogue"
    | "combat"
    | "recover"
    | "escape";

export type AgentRuntimeSessionStatus =
    | "connecting"
    | "active"
    | "paused"
    | "disconnected";

export interface AgentProfileRow {
    agentId: string;
    displayName: string;
    runtimeKind: string;
    worldId: string;
    teamId?: string;
    createdAt?: AgentContextMillis;
    updatedAt?: AgentContextMillis;
}

export interface AgentRuntimeSessionRow {
    sessionId: string;
    agentId: string;
    runId: string;
    status: AgentRuntimeSessionStatus;
    botsdkPlayerId?: number;
    lastTick?: number;
    lastSeenAt?: AgentContextMillis;
}

export interface AgentPromptSelfSlotRow {
    agentId: string;
    tick?: number;
    playerId?: number;
    x: number;
    z: number;
    level: number;
    hp: number;
    maxHp: number;
    runEnergy: number;
    inCombat: boolean;
    freeInventorySlots: number;
    inventoryFull: boolean;
    lowHp: boolean;
    moving: boolean;
    movementLocked: boolean;
    bankOpen: boolean;
    dialogueOpen: boolean;
}

export interface AgentPromptObjectiveSlotRow {
    agentId: string;
    mode: AgentObjectiveMode;
    goal: string;
    priority: number;
    status?: "active" | "blocked" | "done";
    summary?: string;
    successSignal?: string;
    fallbackAction?: string;
    operatorDirective?: string;
}

export interface AgentPromptAffordanceSlotRow {
    slotId: string;
    agentId: string;
    kind: string;
    label: string;
    reachable: boolean;
    score: number;
    distance?: number;
    targetType?: string;
    targetId?: string;
    reasonUnavailable?: string;
}

export interface AgentPromptRecentEventSlotRow {
    slotId: string;
    agentId: string;
    rank: number;
    kind: string;
    message: string;
    code?: string;
    occurredAt?: AgentContextMillis;
}

export interface AgentPromptMemorySlotRow {
    slotId: string;
    agentId: string;
    kind: string;
    fact: string;
    confidence: number;
    score: number;
    sourceKind?: string;
}

export interface AgentPromptTeamSlotRow {
    slotId: string;
    agentId: string;
    kind: string;
    message: string;
    score: number;
    teamId?: string;
    sourceAgentId?: string;
}

export interface AgentActionResultDelta {
    kind: "action_result";
    correlationId?: string;
    status: "progress" | "success" | "failed" | "blocked" | "cancelled";
    code: string;
    message: string;
}

export interface AgentEventDelta {
    kind: "event";
    eventKind: string;
    message: string;
    code?: string;
}

export type AgentFreshDelta = AgentActionResultDelta | AgentEventDelta;

export interface AgentPromptIdentity {
    agentId: string;
    displayName: string;
    runtimeKind?: string;
    worldId?: string;
    teamId?: string;
}

export interface AgentPromptObjective {
    mode: AgentObjectiveMode;
    goal: string;
    priority: number;
    status?: string;
    summary?: string;
    successSignal?: string;
    fallbackAction?: string;
    operatorDirective?: string;
}

export interface AgentPromptSelf {
    tick?: number;
    playerId?: number;
    x: number;
    z: number;
    level: number;
    hp: number;
    maxHp: number;
    runEnergy: number;
    inCombat: boolean;
}

export interface AgentPromptConstraints {
    freeInventorySlots: number;
    inventoryFull: boolean;
    lowHp: boolean;
    moving: boolean;
    movementLocked: boolean;
    bankOpen: boolean;
    dialogueOpen: boolean;
}

export interface AgentPromptAffordance {
    id: string;
    kind: string;
    label: string;
    reachable: boolean;
    distance?: number;
    score: number;
    targetType?: string;
    targetId?: string;
    reasonUnavailable?: string;
}

export interface AgentPromptRecentEvent {
    kind: string;
    message: string;
    code?: string;
}

export interface AgentPromptMemory {
    kind: string;
    fact: string;
    confidence: number;
    score: number;
    sourceKind?: string;
}

export interface AgentPromptTeamContext {
    kind: string;
    message: string;
    score: number;
    teamId?: string;
    sourceAgentId?: string;
}

export interface AgentPromptDocument {
    identity: AgentPromptIdentity;
    objective?: AgentPromptObjective;
    session?: {
        runId: string;
        status: AgentRuntimeSessionStatus;
        botsdkPlayerId?: number;
        lastTick?: number;
    };
    self?: AgentPromptSelf;
    constraints?: AgentPromptConstraints;
    affordances: AgentPromptAffordance[];
    recent: AgentPromptRecentEvent[];
    memory: AgentPromptMemory[];
    team: AgentPromptTeamContext[];
    freshDelta?: AgentFreshDelta;
}

export interface AgentPromptAssemblyInput {
    profile: AgentProfileRow;
    session?: AgentRuntimeSessionRow;
    self?: AgentPromptSelfSlotRow;
    objective?: AgentPromptObjectiveSlotRow;
    affordances?: AgentPromptAffordanceSlotRow[];
    recent?: AgentPromptRecentEventSlotRow[];
    memory?: AgentPromptMemorySlotRow[];
    team?: AgentPromptTeamSlotRow[];
    freshDelta?: AgentFreshDelta;
}

export interface AgentPromptAssemblyOptions {
    maxAffordances?: number;
    maxRecent?: number;
    maxMemory?: number;
    maxTeam?: number;
}

export const DEFAULT_AGENT_PROMPT_LIMITS = {
    maxAffordances: 12,
    maxRecent: 20,
    maxMemory: 12,
    maxTeam: 8,
} as const;
