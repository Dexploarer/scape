/**
 * Agent component layer — public exports for the server's agent machinery.
 *
 * Import from `../agent` rather than individual files to keep the rest of
 * the codebase decoupled from the internal file layout.
 */

export type { AgentIdentity } from "./AgentIdentity";
export type { AgentComponent } from "./AgentComponent";
export type {
    AgentScriptSpec,
    AgentScriptStep,
    AgentScriptRuntimeState,
    AgentScriptInterruptHandler,
    AgentScriptCommand,
} from "./AgentScript";
export {
    AgentActionQueue,
    type AgentActionCommand,
} from "./AgentActionQueue";
export {
    buildProjectedPromptAssemblyInput,
    inferAffordanceSlotsFromSnapshot,
    projectSnapshotToPromptSelfSlot,
    projectSnapshotToRecentEventSlots,
    toFreshDeltaFromActionResult,
    toFreshDeltaFromEvent,
    type BuildProjectedPromptAssemblyInputOptions,
} from "./AgentContextProjection";
export {
    projectActionAttemptIngest,
    projectActionOutcomeIngest,
    projectDirectiveIngest,
    projectFreshDeltaForIngest,
    projectPerceptionIngestBatch,
    projectSessionEndedIngest,
    projectSessionStartedIngest,
    type ProjectPerceptionIngestBatchOptions,
    type ProjectSessionStartedIngestOptions,
} from "./AgentIngestProjection";
export {
    extractAgentScriptInterrupts,
    getAgentScriptStep,
    getNextSequentialStepId,
    validateAgentScriptSpec,
} from "./AgentScript";
export {
    AGENT_CONTEXT_REDUCERS,
    beginRuntimeSessionCall,
    endRuntimeSessionCall,
    ingestPerceptionDeltaCall,
    publishOperatorDirectiveCall,
    recordActionAttemptCall,
    recordActionOutcomeCall,
    type AgentReducerCall,
} from "../../../src/shared/agent-context";
export {
    buildLiveAgentPromptDocument,
    encodeLiveAgentPromptToToon,
    projectIdentityToProfileRow,
    type BuildLiveAgentPromptDocumentOptions,
    type ProjectIdentityToProfileOptions,
} from "./AgentPromptProjection";
export type {
    AgentPerceptionSnapshot,
    AgentPerceptionSelf,
    AgentPerceptionInventoryItem,
    AgentPerceptionSkill,
    AgentPerceptionNpc,
    AgentPerceptionPlayer,
    AgentPerceptionGroundItem,
    AgentPerceptionObject,
    AgentPerceptionEvent,
    AgentPerceptionUiState,
    AgentPerceptionConstraints,
} from "./AgentPerception";
