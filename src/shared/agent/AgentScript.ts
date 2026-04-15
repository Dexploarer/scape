export interface AgentScriptCommand {
    action: string;
    params?: Record<string, unknown>;
}

export interface AgentScriptActionStep {
    id: string;
    kind: "action";
    command: AgentScriptCommand;
    nextStepId?: string;
}

export interface AgentScriptWaitStep {
    id: string;
    kind: "wait";
    events: string[];
    timeoutMs?: number;
    nextStepId?: string;
    timeoutStepId?: string;
}

export interface AgentScriptGotoStep {
    id: string;
    kind: "goto";
    stepId: string;
}

export interface AgentScriptCompleteStep {
    id: string;
    kind: "complete";
    outcome?: "success" | "aborted" | "failed";
    message?: string;
}

export type AgentScriptStep =
    | AgentScriptActionStep
    | AgentScriptWaitStep
    | AgentScriptGotoStep
    | AgentScriptCompleteStep;

export interface AgentScriptInterruptHandler {
    policy: "abort" | "goto" | "complete";
    stepId?: string;
    message?: string;
}

export interface AgentScriptSpec {
    schemaVersion: 1;
    scriptId: string;
    name?: string;
    goal?: string;
    generatedBy?: "llm" | "operator" | "template";
    metadata?: Record<string, unknown>;
    steps: AgentScriptStep[];
    interrupts?: Record<string, AgentScriptInterruptHandler>;
}

export interface AgentScriptRuntimeState {
    runId: string;
    spec: AgentScriptSpec;
    currentStepId: string;
    status: "running" | "waiting";
    waitingForEvents?: string[];
    waitingStartedAt?: number;
    waitDeadlineAt?: number;
    lastEventName?: string;
}

export interface AgentScriptValidationOk {
    ok: true;
}

export interface AgentScriptValidationError {
    ok: false;
    error: string;
}

export type AgentScriptValidationResult =
    | AgentScriptValidationOk
    | AgentScriptValidationError;

export function getAgentScriptStep(
    spec: AgentScriptSpec,
    stepId: string,
): AgentScriptStep | undefined {
    return spec.steps.find((step) => step.id === stepId);
}

export function getNextSequentialStepId(
    spec: AgentScriptSpec,
    stepId: string,
): string | undefined {
    const index = spec.steps.findIndex((step) => step.id === stepId);
    if (index < 0 || index + 1 >= spec.steps.length) return undefined;
    return spec.steps[index + 1]?.id;
}

export function validateAgentScriptSpec(
    spec: AgentScriptSpec,
): AgentScriptValidationResult {
    if (spec.schemaVersion !== 1) {
        return { ok: false, error: "unsupported schemaVersion" };
    }
    if (!spec.scriptId || spec.scriptId.trim().length === 0) {
        return { ok: false, error: "scriptId is required" };
    }
    if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
        return { ok: false, error: "at least one step is required" };
    }

    const stepIds = new Set<string>();
    for (const step of spec.steps) {
        if (!step.id || step.id.trim().length === 0) {
            return { ok: false, error: "every step must have a non-empty id" };
        }
        if (stepIds.has(step.id)) {
            return { ok: false, error: `duplicate step id: ${step.id}` };
        }
        stepIds.add(step.id);
        if (step.kind === "action") {
            if (!step.command?.action || step.command.action.trim().length === 0) {
                return {
                    ok: false,
                    error: `action step ${step.id} must declare command.action`,
                };
            }
        }
        if (step.kind === "wait") {
            if (!Array.isArray(step.events) || step.events.length === 0) {
                return {
                    ok: false,
                    error: `wait step ${step.id} must declare at least one event`,
                };
            }
        }
    }

    const ensureStepRef = (label: string, ref?: string) => {
        if (!ref) return undefined;
        if (!stepIds.has(ref)) {
            return { ok: false as const, error: `${label} references unknown step: ${ref}` };
        }
        return undefined;
    };

    for (const step of spec.steps) {
        if (step.kind === "action") {
            const error = ensureStepRef(`action step ${step.id}`, step.nextStepId);
            if (error) return error;
        }
        if (step.kind === "wait") {
            const nextError = ensureStepRef(`wait step ${step.id}`, step.nextStepId);
            if (nextError) return nextError;
            const timeoutError = ensureStepRef(
                `wait step ${step.id} timeout`,
                step.timeoutStepId,
            );
            if (timeoutError) return timeoutError;
        }
        if (step.kind === "goto") {
            const error = ensureStepRef(`goto step ${step.id}`, step.stepId);
            if (error) return error;
        }
    }

    if (spec.interrupts) {
        for (const [interrupt, handler] of Object.entries(spec.interrupts)) {
            if (!interrupt || interrupt.trim().length === 0) {
                return { ok: false, error: "interrupt names must be non-empty" };
            }
            if (handler.policy === "goto") {
                const error = ensureStepRef(`interrupt ${interrupt}`, handler.stepId);
                if (error) return error;
            }
        }
    }

    return { ok: true };
}

const KEYWORD_INTERRUPT_PATTERNS: Array<[RegExp, string]> = [
    [/\b(stop|abort|cancel|halt)\b/i, "INTERRUPT_STOP"],
    [/\b(bank|deposit)\b/i, "INTERRUPT_BANK_NOW"],
    [/\bretreat|run away|fallback\b/i, "INTERRUPT_RETREAT"],
    [/\bhelp|assist|protect\b/i, "INTERRUPT_HELP"],
];

export function extractAgentScriptInterrupts(text: string): string[] {
    const found = new Set<string>();
    for (const [pattern, interrupt] of KEYWORD_INTERRUPT_PATTERNS) {
        if (pattern.test(text)) {
            found.add(interrupt);
        }
    }
    return Array.from(found);
}
