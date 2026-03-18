export type LiveDirectorPhase = "announce" | "warmup" | "active" | "cooldown" | "cleanup";

export const LIVE_DIRECTOR_PHASES: LiveDirectorPhase[] = [
    "announce",
    "warmup",
    "active",
    "cooldown",
    "cleanup",
];

export type LiveDirectorPhaseDurations = {
    announce: number;
    warmup: number;
    active: number;
    cooldown: number;
    cleanup: number;
};

export interface LiveDirectorTemplateDefinition {
    id: string;
    category: string;
    displayName: string;
    announceText: string;
    activeText?: string;
    completeText?: string;
    phaseDurations: LiveDirectorPhaseDurations;
    cooldownTicks: number;
    minOnlinePlayers?: number;
    maxConcurrent?: number;
    regions?: number[];
}

export interface LiveDirectorSeasonConfig {
    id: string;
    promptVersion: string;
    promptFile: string;
    templateWeights: ReadonlyMap<string, number>;
    disabledTemplates: ReadonlySet<string>;
}

export interface LiveDirectorRawConfig {
    enabled: boolean;
    autoDirectorEnabled: boolean;
    seasonId: string;
    basePromptFile: string;
    hotfixPromptFile?: string;
    evaluateIntervalTicks: number;
    minOnlinePlayersForAutoStart: number;
    maxConcurrentEvents: number;
    templates: LiveDirectorTemplateDefinition[];
}

export interface LiveDirectorLoadedConfig extends LiveDirectorRawConfig {
    sourcePath: string;
    seasonConfig: LiveDirectorSeasonConfig;
    basePrompt: string;
    seasonPrompt: string;
    hotfixPrompt: string;
    availableSeasons: string[];
}

export interface LiveDirectorTelemetrySnapshot {
    tick: number;
    onlinePlayers: number;
    npcCount: number;
}

export interface LiveDirectorPromptBundle {
    seasonId: string;
    promptVersion: string;
    basePrompt: string;
    seasonPrompt: string;
    hotfixPrompt: string;
    effectivePrompt: string;
}

export interface LiveDirectorProposal {
    templateId: string;
    reason: string;
    seasonId: string;
    promptVersion: string;
}

export interface LiveDirectorAuditEntry {
    timestamp: number;
    tick: number;
    actor: string;
    action: string;
    seasonId: string;
    promptVersion: string;
    templateId?: string;
    result: "ok" | "rejected" | "error";
    detail?: string;
}

export interface LiveDirectorActiveEvent {
    instanceId: number;
    templateId: string;
    phase: LiveDirectorPhase;
    phaseStartedTick: number;
    phaseEndsTick: number;
    startedTick: number;
    actor: string;
    reason: string;
}

export interface LiveDirectorStatusSnapshot {
    enabled: boolean;
    autoDirectorEnabled: boolean;
    seasonId: string;
    promptVersion: string;
    nextEvaluationTick: number;
    templateCount: number;
    activeEvent?: LiveDirectorActiveEvent;
    lastProposal?: LiveDirectorProposal;
}
