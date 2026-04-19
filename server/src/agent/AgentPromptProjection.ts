import {
    buildAgentPromptDocument,
    encodeAgentPromptToToon,
    type AgentFreshDelta,
    type AgentProfileRow,
    type AgentPromptAssemblyOptions,
    type AgentPromptDocument,
    type AgentPromptObjectiveSlotRow,
    type AgentRuntimeSessionRow,
} from "../../../src/shared/agent-context";

import type { AgentIdentity } from "./AgentIdentity";
import type { AgentPerceptionSnapshot } from "./AgentPerception";
import { buildProjectedPromptAssemblyInput } from "./AgentContextProjection";

export interface ProjectIdentityToProfileOptions {
    worldId: string;
    runtimeKind?: string;
    teamId?: string;
}

export function projectIdentityToProfileRow(
    identity: AgentIdentity,
    options: ProjectIdentityToProfileOptions,
): AgentProfileRow {
    return {
        agentId: identity.agentId,
        displayName: identity.displayName,
        runtimeKind: options.runtimeKind ?? "scape-botsdk",
        worldId: options.worldId,
        teamId: options.teamId,
        createdAt: identity.createdAt,
        updatedAt: identity.createdAt,
    };
}

export interface BuildLiveAgentPromptDocumentOptions {
    identity: AgentIdentity;
    snapshot: AgentPerceptionSnapshot;
    worldId: string;
    runtimeKind?: string;
    teamId?: string;
    session?: AgentRuntimeSessionRow;
    objective?: AgentPromptObjectiveSlotRow;
    freshDelta?: AgentFreshDelta;
    assembly?: AgentPromptAssemblyOptions;
}

export function buildLiveAgentPromptDocument(
    options: BuildLiveAgentPromptDocumentOptions,
): AgentPromptDocument {
    const input = buildProjectedPromptAssemblyInput({
        profile: projectIdentityToProfileRow(options.identity, {
            worldId: options.worldId,
            runtimeKind: options.runtimeKind,
            teamId: options.teamId,
        }),
        snapshot: options.snapshot,
        session: options.session,
        objective: options.objective,
        freshDelta: options.freshDelta,
        maxAffordances: options.assembly?.maxAffordances,
    });
    return buildAgentPromptDocument(input, options.assembly);
}

export function encodeLiveAgentPromptToToon(
    options: BuildLiveAgentPromptDocumentOptions,
): string {
    const input = buildProjectedPromptAssemblyInput({
        profile: projectIdentityToProfileRow(options.identity, {
            worldId: options.worldId,
            runtimeKind: options.runtimeKind,
            teamId: options.teamId,
        }),
        snapshot: options.snapshot,
        session: options.session,
        objective: options.objective,
        freshDelta: options.freshDelta,
        maxAffordances: options.assembly?.maxAffordances,
    });
    return encodeAgentPromptToToon(input, options.assembly);
}
