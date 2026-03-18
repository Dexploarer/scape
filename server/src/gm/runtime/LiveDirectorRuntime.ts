import {
    type LiveDirectorActiveEvent,
    type LiveDirectorPhase,
    type LiveDirectorTemplateDefinition,
} from "../types";

const NEXT_PHASE: Partial<Record<LiveDirectorPhase, LiveDirectorPhase>> = {
    announce: "warmup",
    warmup: "active",
    active: "cooldown",
    cooldown: "cleanup",
};

function cloneActiveEvent(event: LiveDirectorActiveEvent): LiveDirectorActiveEvent {
    return {
        instanceId: event.instanceId,
        templateId: event.templateId,
        phase: event.phase,
        phaseStartedTick: event.phaseStartedTick,
        phaseEndsTick: event.phaseEndsTick,
        startedTick: event.startedTick,
        actor: event.actor,
        reason: event.reason,
    };
}

export interface LiveDirectorRuntimeTransition {
    kind: "phase_changed" | "completed";
    previousPhase: LiveDirectorPhase;
    nextPhase?: LiveDirectorPhase;
    event: LiveDirectorActiveEvent;
}

export class LiveDirectorRuntime {
    private activeEvent?: LiveDirectorActiveEvent;
    private nextInstanceId = 1;

    hasActiveEvent(): boolean {
        return !!this.activeEvent;
    }

    getActiveEvent(): LiveDirectorActiveEvent | undefined {
        if (!this.activeEvent) return undefined;
        return cloneActiveEvent(this.activeEvent);
    }

    startEvent(opts: {
        template: LiveDirectorTemplateDefinition;
        tick: number;
        actor: string;
        reason: string;
    }): LiveDirectorActiveEvent | undefined {
        if (this.activeEvent) {
            return undefined;
        }

        const phaseStartedTick = opts.tick;
        const phaseEndsTick = phaseStartedTick + opts.template.phaseDurations.announce;

        this.activeEvent = {
            instanceId: this.nextInstanceId++,
            templateId: opts.template.id,
            phase: "announce",
            phaseStartedTick,
            phaseEndsTick,
            startedTick: phaseStartedTick,
            actor: opts.actor,
            reason: opts.reason,
        };

        return cloneActiveEvent(this.activeEvent);
    }

    stopEvent(): LiveDirectorActiveEvent | undefined {
        const existing = this.activeEvent;
        this.activeEvent = undefined;
        if (!existing) return undefined;
        return cloneActiveEvent(existing);
    }

    processTick(
        tick: number,
        templateById: ReadonlyMap<string, LiveDirectorTemplateDefinition>,
    ): LiveDirectorRuntimeTransition[] {
        const transitions: LiveDirectorRuntimeTransition[] = [];

        while (this.activeEvent && tick >= this.activeEvent.phaseEndsTick) {
            const current = this.activeEvent;
            const template = templateById.get(current.templateId);
            if (!template) {
                transitions.push({
                    kind: "completed",
                    previousPhase: current.phase,
                    event: cloneActiveEvent(current),
                });
                this.activeEvent = undefined;
                break;
            }

            const nextPhase = NEXT_PHASE[current.phase];
            if (!nextPhase) {
                transitions.push({
                    kind: "completed",
                    previousPhase: current.phase,
                    event: cloneActiveEvent(current),
                });
                this.activeEvent = undefined;
                break;
            }

            const nextStartedTick = current.phaseEndsTick;
            const nextEndsTick = nextStartedTick + template.phaseDurations[nextPhase];

            const previousPhase = current.phase;
            current.phase = nextPhase;
            current.phaseStartedTick = nextStartedTick;
            current.phaseEndsTick = nextEndsTick;

            transitions.push({
                kind: "phase_changed",
                previousPhase,
                nextPhase,
                event: cloneActiveEvent(current),
            });
        }

        return transitions;
    }
}
