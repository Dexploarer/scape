import type {
    AgentContextMillis,
    AgentFreshDelta,
    AgentProfileRow,
    AgentPromptAffordanceSlotRow,
    AgentPromptObjectiveSlotRow,
    AgentPromptRecentEventSlotRow,
    AgentPromptSelfSlotRow,
    AgentRuntimeSessionRow,
} from "./AgentContextContract";

export interface AgentSessionStartedIngest {
    profile: AgentProfileRow;
    session: AgentRuntimeSessionRow;
    startedAt: AgentContextMillis;
}

export interface AgentSessionEndedIngest {
    agentId: string;
    sessionId: string;
    endedAt: AgentContextMillis;
    reason?: string;
}

export interface AgentPerceptionObservationIngest {
    agentId: string;
    tick: number;
    playerId: number;
    x: number;
    z: number;
    level: number;
    hp: number;
    maxHp: number;
    runEnergy: number;
    inCombat: boolean;
    openInterface: string;
    freeInventorySlots: number;
    inventoryFull: boolean;
    lowHp: boolean;
    moving: boolean;
    movementLocked: boolean;
    bankOpen: boolean;
    dialogueOpen: boolean;
    inventoryCount: number;
    equipmentCount: number;
    nearbyNpcCount: number;
    nearbyPlayerCount: number;
    nearbyGroundItemCount: number;
    nearbyObjectCount: number;
    recentEventCount: number;
    observedAt: AgentContextMillis;
}

export interface AgentPerceptionIngestBatch {
    profile: AgentProfileRow;
    session?: AgentRuntimeSessionRow;
    objective?: AgentPromptObjectiveSlotRow;
    self: AgentPromptSelfSlotRow;
    affordances: AgentPromptAffordanceSlotRow[];
    recent: AgentPromptRecentEventSlotRow[];
    observation: AgentPerceptionObservationIngest;
    freshDelta?: AgentFreshDelta;
}

export interface AgentActionAttemptIngest {
    agentId: string;
    playerId: number;
    action: string;
    correlationId?: string;
    targetType?: string;
    targetId?: string;
    x?: number;
    z?: number;
    level?: number;
    slot?: number;
    option?: string;
    text?: string;
    run?: boolean;
    recordedAt: AgentContextMillis;
}

export interface AgentActionOutcomeIngest {
    agentId: string;
    playerId: number;
    correlationId?: string;
    status: "progress" | "success" | "failed" | "blocked" | "cancelled";
    code: string;
    message: string;
    recordedAt: AgentContextMillis;
}

export interface AgentDirectiveIngest {
    agentId: string;
    source: "chat" | "admin";
    text: string;
    timestamp: AgentContextMillis;
    fromPlayerId?: number;
    fromPlayerName?: string;
}
