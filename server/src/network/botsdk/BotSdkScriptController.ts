import {
    extractAgentScriptInterrupts,
    getAgentScriptStep,
    getNextSequentialStepId,
    type AgentScriptRuntimeState,
    type AgentScriptSpec,
    validateAgentScriptSpec,
} from "../../agent";
import type { PlayerState } from "../../game/player";

import type { ActionDispatchResult, BotSdkActionRouter } from "./BotSdkActionRouter";
import type { BotSdkTrajectoryRecorder } from "./BotSdkTrajectoryRecorder";
import type {
    AnyActionFrame,
    OperatorCommandFrame,
    RuntimeEventFrame,
} from "./BotSdkProtocol";

export interface BotSdkScriptControllerDeps {
    router: BotSdkActionRouter;
    recorder?: BotSdkTrajectoryRecorder;
    emitEvent: (player: PlayerState, frame: RuntimeEventFrame) => void;
    now?: () => number;
}

export type ScriptControlResult =
    | { ok: true; message: string }
    | { ok: false; message: string };

function scriptEvent(
    name: string,
    payload?: Record<string, unknown>,
    now: () => number = () => Date.now(),
): RuntimeEventFrame {
    return {
        kind: "event",
        name,
        timestamp: now(),
        payload,
    };
}

function nextStepId(spec: AgentScriptSpec, currentStepId: string): string | undefined {
    const step = getAgentScriptStep(spec, currentStepId);
    if (!step) return undefined;
    if (step.kind === "action") return step.nextStepId ?? getNextSequentialStepId(spec, step.id);
    if (step.kind === "wait") return step.nextStepId ?? getNextSequentialStepId(spec, step.id);
    return getNextSequentialStepId(spec, step.id);
}

function buildActionFrame(
    run: AgentScriptRuntimeState,
    stepId: string,
): AnyActionFrame | undefined {
    const step = getAgentScriptStep(run.spec, stepId);
    if (!step || step.kind !== "action") return undefined;
    const params = step.command.params ?? {};
    const correlationId = `${run.runId}:${step.id}`;
    switch (step.command.action) {
        case "walkTo":
            if (typeof params.x !== "number" || typeof params.z !== "number") return undefined;
            return {
                kind: "action",
                action: "walkTo",
                x: params.x,
                z: params.z,
                run: params.run === true,
                correlationId,
            };
        case "chatPublic":
            if (typeof params.text !== "string") return undefined;
            return {
                kind: "action",
                action: "chatPublic",
                text: params.text,
                correlationId,
            };
        case "attackNpc":
            if (typeof params.npcId !== "number") return undefined;
            return {
                kind: "action",
                action: "attackNpc",
                npcId: params.npcId,
                correlationId,
            };
        case "dropItem":
            if (typeof params.slot !== "number") return undefined;
            return {
                kind: "action",
                action: "dropItem",
                slot: params.slot,
                correlationId,
            };
        case "eatFood":
            return {
                kind: "action",
                action: "eatFood",
                slot: typeof params.slot === "number" ? params.slot : undefined,
                correlationId,
            };
        default:
            return undefined;
    }
}

export class BotSdkScriptController {
    private readonly now: () => number;

    constructor(private readonly deps: BotSdkScriptControllerDeps) {
        this.now = deps.now ?? (() => Date.now());
    }

    install(player: PlayerState, spec: AgentScriptSpec): ScriptControlResult {
        if (!player.agent) {
            return { ok: false, message: "player is not an agent" };
        }
        const validation = validateAgentScriptSpec(spec);
        if (!validation.ok) {
            return { ok: false, message: validation.error };
        }
        const firstStepId = spec.steps[0]?.id;
        if (!firstStepId) {
            return { ok: false, message: "script has no entry step" };
        }
        player.agent.script = {
            runId: `script-run:${player.id}:${this.now()}`,
            spec,
            currentStepId: firstStepId,
            status: "running",
        };
        this.deps.emitEvent(
            player,
            scriptEvent(
                "script:installed",
                {
                    scriptId: spec.scriptId,
                    runId: player.agent.script.runId,
                    stepId: firstStepId,
                    generatedBy: spec.generatedBy,
                },
                this.now,
            ),
        );
        return { ok: true, message: `installed script ${spec.scriptId}` };
    }

    clear(player: PlayerState, reason?: string): ScriptControlResult {
        if (!player.agent?.script) {
            return { ok: false, message: "no active script" };
        }
        const { scriptId, runId } = {
            scriptId: player.agent.script.spec.scriptId,
            runId: player.agent.script.runId,
        };
        player.agent.script = undefined;
        this.deps.emitEvent(
            player,
            scriptEvent(
                "script:cleared",
                { scriptId, runId, reason },
                this.now,
            ),
        );
        return { ok: true, message: `cleared script ${scriptId}` };
    }

    interrupt(player: PlayerState, interrupt: string, reason?: string): ScriptControlResult {
        const run = player.agent?.script;
        if (!run) {
            return { ok: false, message: "no active script" };
        }
        const handler = run.spec.interrupts?.[interrupt];
        if (!handler) {
            return { ok: false, message: `no interrupt handler for ${interrupt}` };
        }
        if (handler.policy === "abort") {
            const message = handler.message ?? reason ?? `aborted by ${interrupt}`;
            const result = this.clear(player, message);
            this.deps.emitEvent(
                player,
                scriptEvent(
                    "script:interrupted",
                    {
                        scriptId: run.spec.scriptId,
                        runId: run.runId,
                        interrupt,
                        policy: "abort",
                        message,
                    },
                    this.now,
                ),
            );
            return result;
        }
        if (handler.policy === "complete") {
            player.agent!.script = undefined;
            this.deps.emitEvent(
                player,
                scriptEvent(
                    "script:completed",
                    {
                        scriptId: run.spec.scriptId,
                        runId: run.runId,
                        interrupt,
                        message: handler.message ?? reason,
                        outcome: "aborted",
                    },
                    this.now,
                ),
            );
            return { ok: true, message: `completed script ${run.spec.scriptId}` };
        }
        if (!handler.stepId) {
            return { ok: false, message: `interrupt ${interrupt} is missing a target step` };
        }
        run.currentStepId = handler.stepId;
        run.status = "running";
        run.waitingForEvents = undefined;
        run.waitingStartedAt = undefined;
        run.waitDeadlineAt = undefined;
        this.deps.emitEvent(
            player,
            scriptEvent(
                "script:interrupted",
                {
                    scriptId: run.spec.scriptId,
                    runId: run.runId,
                    interrupt,
                    policy: "goto",
                    stepId: handler.stepId,
                    message: handler.message ?? reason,
                },
                this.now,
            ),
        );
        return { ok: true, message: `interrupted script ${run.spec.scriptId}` };
    }

    onOperatorCommand(
        player: PlayerState,
        frame: Pick<OperatorCommandFrame, "text" | "source">,
    ): void {
        for (const interrupt of extractAgentScriptInterrupts(frame.text)) {
            this.interrupt(player, interrupt, `${frame.source}:${frame.text}`);
        }
    }

    onRuntimeEvent(player: PlayerState, frame: RuntimeEventFrame): void {
        const run = player.agent?.script;
        if (!run) return;
        run.lastEventName = frame.name;
        if (run.status !== "waiting") return;
        const step = getAgentScriptStep(run.spec, run.currentStepId);
        if (!step || step.kind !== "wait") return;
        if (!step.events.includes(frame.name) && !step.events.includes("*")) {
            return;
        }
        run.status = "running";
        run.waitingForEvents = undefined;
        run.waitingStartedAt = undefined;
        run.waitDeadlineAt = undefined;
        const next = step.nextStepId ?? getNextSequentialStepId(run.spec, step.id);
        if (!next) {
            player.agent!.script = undefined;
            this.deps.emitEvent(
                player,
                scriptEvent(
                    "script:completed",
                    {
                        scriptId: run.spec.scriptId,
                        runId: run.runId,
                        outcome: "success",
                    },
                    this.now,
                ),
            );
            return;
        }
        run.currentStepId = next;
        this.deps.emitEvent(
            player,
            scriptEvent(
                "script:wake",
                {
                    scriptId: run.spec.scriptId,
                    runId: run.runId,
                    event: frame.name,
                    stepId: next,
                },
                this.now,
            ),
        );
    }

    onTick(player: PlayerState): void {
        const run = player.agent?.script;
        if (!run || !player.agent?.connected) return;

        if (run.status === "waiting") {
            if (
                typeof run.waitDeadlineAt === "number" &&
                this.now() >= run.waitDeadlineAt
            ) {
                const step = getAgentScriptStep(run.spec, run.currentStepId);
                if (!step || step.kind !== "wait") {
                    player.agent!.script = undefined;
                    return;
                }
                if (step.timeoutStepId) {
                    run.status = "running";
                    run.currentStepId = step.timeoutStepId;
                    run.waitingForEvents = undefined;
                    run.waitingStartedAt = undefined;
                    run.waitDeadlineAt = undefined;
                    this.deps.emitEvent(
                        player,
                        scriptEvent(
                            "script:timeout",
                            {
                                scriptId: run.spec.scriptId,
                                runId: run.runId,
                                stepId: step.id,
                                timeoutStepId: step.timeoutStepId,
                            },
                            this.now,
                        ),
                    );
                }
            }
            return;
        }

        for (let budget = 0; budget < 8; budget++) {
            const active = player.agent?.script;
            if (!active || active.status !== "running") return;
            const step = getAgentScriptStep(active.spec, active.currentStepId);
            if (!step) {
                player.agent!.script = undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:failed",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            message: `missing step ${active.currentStepId}`,
                        },
                        this.now,
                    ),
                );
                return;
            }

            if (step.kind === "goto") {
                active.currentStepId = step.stepId;
                continue;
            }

            if (step.kind === "complete") {
                player.agent!.script = undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:completed",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            stepId: step.id,
                            outcome: step.outcome ?? "success",
                            message: step.message,
                        },
                        this.now,
                    ),
                );
                return;
            }

            if (step.kind === "wait") {
                active.status = "waiting";
                active.waitingForEvents = step.events.slice();
                active.waitingStartedAt = this.now();
                active.waitDeadlineAt =
                    typeof step.timeoutMs === "number"
                        ? active.waitingStartedAt + step.timeoutMs
                        : undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:waiting",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            stepId: step.id,
                            events: step.events,
                            timeoutMs: step.timeoutMs,
                        },
                        this.now,
                    ),
                );
                return;
            }

            const frame = buildActionFrame(active, step.id);
            if (!frame) {
                player.agent!.script = undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:failed",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            stepId: step.id,
                            message: `unsupported script action ${step.command.action}`,
                        },
                        this.now,
                    ),
                );
                return;
            }

            this.deps.recorder?.recordActionDispatch(player, frame);
            const dispatch: ActionDispatchResult = this.deps.router.dispatch(player.id, frame);
            this.deps.recorder?.recordActionResult(player, frame, dispatch);
            if (!dispatch.success) {
                player.agent!.script = undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:failed",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            stepId: step.id,
                            message: dispatch.message,
                        },
                        this.now,
                    ),
                );
                return;
            }
            this.deps.emitEvent(
                player,
                scriptEvent(
                    "script:step",
                    {
                        scriptId: active.spec.scriptId,
                        runId: active.runId,
                        stepId: step.id,
                        action: frame.action,
                        message: dispatch.message,
                    },
                    this.now,
                ),
            );
            const next = nextStepId(active.spec, step.id);
            if (!next) {
                player.agent!.script = undefined;
                this.deps.emitEvent(
                    player,
                    scriptEvent(
                        "script:completed",
                        {
                            scriptId: active.spec.scriptId,
                            runId: active.runId,
                            stepId: step.id,
                            outcome: "success",
                        },
                        this.now,
                    ),
                );
                return;
            }
            active.currentStepId = next;
        }
    }
}
