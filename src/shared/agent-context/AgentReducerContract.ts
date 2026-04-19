import type {
    AgentActionAttemptIngest,
    AgentActionOutcomeIngest,
    AgentDirectiveIngest,
    AgentPerceptionIngestBatch,
    AgentSessionEndedIngest,
    AgentSessionStartedIngest,
} from "./AgentIngestContract";

export const AGENT_CONTEXT_REDUCERS = {
    beginRuntimeSession: "begin_runtime_session",
    endRuntimeSession: "end_runtime_session",
    ingestPerceptionDelta: "ingest_perception_delta",
    recordActionAttempt: "record_action_attempt",
    recordActionOutcome: "record_action_outcome",
    publishOperatorDirective: "publish_operator_directive",
} as const;

export interface AgentReducerInvocation<TName extends string, TPayload> {
    reducer: TName;
    payload: TPayload;
}

export type BeginRuntimeSessionReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.beginRuntimeSession,
    AgentSessionStartedIngest
>;

export type EndRuntimeSessionReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.endRuntimeSession,
    AgentSessionEndedIngest
>;

export type IngestPerceptionDeltaReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.ingestPerceptionDelta,
    AgentPerceptionIngestBatch
>;

export type RecordActionAttemptReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.recordActionAttempt,
    AgentActionAttemptIngest
>;

export type RecordActionOutcomeReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.recordActionOutcome,
    AgentActionOutcomeIngest
>;

export type PublishOperatorDirectiveReducerCall = AgentReducerInvocation<
    typeof AGENT_CONTEXT_REDUCERS.publishOperatorDirective,
    AgentDirectiveIngest
>;

export type AgentReducerCall =
    | BeginRuntimeSessionReducerCall
    | EndRuntimeSessionReducerCall
    | IngestPerceptionDeltaReducerCall
    | RecordActionAttemptReducerCall
    | RecordActionOutcomeReducerCall
    | PublishOperatorDirectiveReducerCall;

export function beginRuntimeSessionCall(
    payload: AgentSessionStartedIngest,
): BeginRuntimeSessionReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.beginRuntimeSession,
        payload,
    };
}

export function endRuntimeSessionCall(
    payload: AgentSessionEndedIngest,
): EndRuntimeSessionReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.endRuntimeSession,
        payload,
    };
}

export function ingestPerceptionDeltaCall(
    payload: AgentPerceptionIngestBatch,
): IngestPerceptionDeltaReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.ingestPerceptionDelta,
        payload,
    };
}

export function recordActionAttemptCall(
    payload: AgentActionAttemptIngest,
): RecordActionAttemptReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.recordActionAttempt,
        payload,
    };
}

export function recordActionOutcomeCall(
    payload: AgentActionOutcomeIngest,
): RecordActionOutcomeReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.recordActionOutcome,
        payload,
    };
}

export function publishOperatorDirectiveCall(
    payload: AgentDirectiveIngest,
): PublishOperatorDirectiveReducerCall {
    return {
        reducer: AGENT_CONTEXT_REDUCERS.publishOperatorDirective,
        payload,
    };
}
