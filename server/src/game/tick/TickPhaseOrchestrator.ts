import { performance } from "perf_hooks";

import { logger } from "../../utils/logger";

/**
 * Tick frame data passed to each phase.
 */
export interface TickFrame {
    tick: number;
    time: number;
    [key: string]: any;
}

/**
 * A single tick phase definition.
 */
export interface TickPhase {
    name: string;
    fn: () => void | Promise<void>;
    yieldAfter?: boolean;
}

/**
 * Services required by the tick orchestrator.
 */
export interface TickPhaseOrchestratorServices {
    getTickMs: () => number;
    createTickFrame: (tick: number, time: number) => TickFrame;
    setActiveFrame: (frame: TickFrame | undefined) => void;
    restorePendingFrame: (frame: TickFrame) => void;
    yieldToEventLoop: (stage: string) => Promise<void>;
    maybeRunAutosave: (frame: TickFrame) => void;
}

/**
 * Phase provider interface - allows wsServer to define phase implementations.
 */
export interface TickPhaseProvider {
    broadcastTick: (frame: TickFrame) => void;
    runPreMovementPhase: (frame: TickFrame) => void;
    runMovementPhase: (frame: TickFrame) => void;
    runMusicPhase: (frame: TickFrame) => void;
    runScriptPhase: (frame: TickFrame) => void;
    runCombatPhase: (frame: TickFrame) => void;
    runDeathPhase: (frame: TickFrame) => void;
    runPostScriptPhase: (frame: TickFrame) => void;
    runPostEffectsPhase: (frame: TickFrame) => void;
    runOrphanedPlayersPhase: (frame: TickFrame) => void;
    runBroadcastPhase: (frame: TickFrame) => void;
}

/**
 * Orchestrates all tick phases in the correct order.
 * Extracted from wsServer.ts to improve separation of concerns.
 */
export class TickPhaseOrchestrator {
    private services: TickPhaseOrchestratorServices;
    private phaseProvider: TickPhaseProvider;
    private profileEnabled: boolean;

    constructor(services: TickPhaseOrchestratorServices, phaseProvider: TickPhaseProvider) {
        this.services = services;
        this.phaseProvider = phaseProvider;
        this.profileEnabled = (process.env.TICK_PROFILE ?? "") === "1";
    }

    /**
     * Execute all tick phases for a given tick event.
     */
    async processTick(tick: number, time: number): Promise<void> {
        const frame = this.services.createTickFrame(tick, time);
        this.services.setActiveFrame(frame);

        const startedAt = performance.now();
        const stageTimes: Array<{ name: string; ms: number }> = [];

        const stages = this.buildPhaseList(frame);

        try {
            for (const stage of stages) {
                const stageStart = performance.now();
                if (!(await this.runTickStage(stage.name, stage.fn, frame))) {
                    return;
                }
                stageTimes.push({ name: stage.name, ms: performance.now() - stageStart });

                if (stage.yieldAfter) {
                    const yieldStart = performance.now();
                    await this.services.yieldToEventLoop(stage.name);
                    stageTimes.push({
                        name: `${stage.name}:yield`,
                        ms: performance.now() - yieldStart,
                    });
                }
            }

            const elapsedMs = performance.now() - startedAt;
            this.logTickTiming(frame.tick, elapsedMs, stageTimes);
            this.services.maybeRunAutosave(frame);
        } finally {
            this.services.setActiveFrame(undefined);
        }
    }

    /**
     * Build the ordered list of tick phases.
     */
    private buildPhaseList(frame: TickFrame): TickPhase[] {
        return [
            {
                name: "broadcast",
                fn: () => this.phaseProvider.broadcastTick(frame),
                yieldAfter: true,
            },
            {
                name: "pre_movement",
                fn: () => this.phaseProvider.runPreMovementPhase(frame),
                yieldAfter: true,
            },
            { name: "movement", fn: () => this.phaseProvider.runMovementPhase(frame) },
            { name: "music", fn: () => this.phaseProvider.runMusicPhase(frame) },
            { name: "scripts", fn: () => this.phaseProvider.runScriptPhase(frame) },
            { name: "combat", fn: () => this.phaseProvider.runCombatPhase(frame) },
            { name: "death", fn: () => this.phaseProvider.runDeathPhase(frame) },
            { name: "post_scripts", fn: () => this.phaseProvider.runPostScriptPhase(frame) },
            { name: "post_effects", fn: () => this.phaseProvider.runPostEffectsPhase(frame) },
            {
                name: "orphaned_players",
                fn: () => this.phaseProvider.runOrphanedPlayersPhase(frame),
            },
            { name: "broadcast_phase", fn: () => this.phaseProvider.runBroadcastPhase(frame) },
        ];
    }

    /**
     * Run a single tick stage with error handling.
     */
    private async runTickStage(
        name: string,
        fn: () => void | Promise<void>,
        frame: TickFrame,
    ): Promise<boolean> {
        try {
            await fn();
            return true;
        } catch (err) {
            this.services.restorePendingFrame(frame);
            logger.error(`[tick] stage ${name} failed (tick=${frame.tick})`, err);
            return false;
        }
    }

    /**
     * Log tick timing information.
     */
    private logTickTiming(
        tick: number,
        elapsedMs: number,
        stageTimes: Array<{ name: string; ms: number }>,
    ): void {
        const tickMs = this.services.getTickMs();

        if (elapsedMs > tickMs) {
            logger.warn(
                `[tick] tick ${tick} exceeded budget: ${elapsedMs.toFixed(1)}ms > ${tickMs}ms`,
            );
            stageTimes.sort((a, b) => b.ms - a.ms);
            const top = stageTimes.slice(0, 5);
            logger.warn(
                `[tick] breakdown tick=${tick} total=${elapsedMs.toFixed(1)}ms ` +
                    top.map((t) => `${t.name}=${t.ms.toFixed(1)}ms`).join(" "),
            );
        } else if (this.profileEnabled) {
            stageTimes.sort((a, b) => b.ms - a.ms);
            const top = stageTimes.slice(0, 5);
            logger.info(
                `[tick] breakdown tick=${tick} total=${elapsedMs.toFixed(1)}ms ` +
                    top.map((t) => `${t.name}=${t.ms.toFixed(1)}ms`).join(" "),
            );
        }
    }
}
