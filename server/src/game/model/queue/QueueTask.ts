import { logger } from "../../../utils/logger";
import { TaskPriority } from "./TaskPriority";

/**
 * Condition that determines when a suspended task should resume.
 */
export interface SuspendCondition {
    resume(): boolean;
}

/**
 * Wait for a specific number of game cycles.
 */
export class WaitCondition implements SuspendCondition {
    private cyclesRemaining: number;

    constructor(cycles: number) {
        this.cyclesRemaining = cycles;
    }

    resume(): boolean {
        return --this.cyclesRemaining <= 0;
    }
}

/**
 * Wait for a predicate to return true.
 */
export class PredicateCondition implements SuspendCondition {
    constructor(private predicate: () => boolean) {}

    resume(): boolean {
        return this.predicate();
    }
}

/**
 * Represents a task that can be paused (suspended) and resumed.
 * Uses generators to simulate coroutine behavior.
 * RSMod parity: gg.rsmod.game.model.queue.QueueTask
 */
export class QueueTask<TContext = unknown> {
    /**
     * The context (usually player or NPC) this task belongs to.
     */
    readonly ctx: TContext;

    /**
     * The priority of this task.
     */
    readonly priority: TaskPriority;

    /**
     * Whether the task's logic has already been invoked.
     */
    invoked: boolean = false;

    /**
     * A value that can be requested by a task (e.g., dialog input).
     */
    requestReturnValue: unknown = null;

    /**
     * Action to execute if task is terminated early.
     */
    terminateAction: ((task: QueueTask<TContext>) => void) | null = null;

    /**
     * The generator function that represents this task's logic.
     */
    private generator: Generator<SuspendCondition, void, void> | null = null;

    /**
     * The current suspend condition, if any.
     */
    private currentCondition: SuspendCondition | null = null;

    /**
     * Whether this task has completed.
     */
    private _completed: boolean = false;

    constructor(ctx: TContext, priority: TaskPriority = TaskPriority.STANDARD) {
        this.ctx = ctx;
        this.priority = priority;
    }

    /**
     * Set the generator function for this task.
     */
    setCoroutine(generator: Generator<SuspendCondition, void, void>): void {
        this.generator = generator;
    }

    /**
     * Invoke the task logic for the first time (initial resume).
     * Returns true if the task is still running, false if completed.
     */
    invoke(): boolean {
        if (this._completed || !this.generator) {
            return false;
        }
        try {
            const result = this.generator.next();
            if (result.done) {
                this._completed = true;
                return false;
            }
            // Got a new suspend condition
            this.currentCondition = result.value;
            this.requestReturnValue = null;
            return true;
        } catch (e) {
            logger.info("[QueueTask] Error in task:", e);
            this._completed = true;
            return false;
        }
    }

    /**
     * Process one cycle for a suspended task.
     * Returns true if the task is still running, false if completed.
     */
    cycle(): boolean {
        if (this._completed || !this.generator) {
            return false;
        }

        if (!this.currentCondition) {
            return false;
        }

        if (!this.currentCondition.resume()) {
            return true;
        }

        this.currentCondition = null;

        try {
            const result = this.generator.next();
            if (result.done) {
                this._completed = true;
                return false;
            }
            this.currentCondition = result.value;
            this.requestReturnValue = null;
            return true;
        } catch (e) {
            logger.info("[QueueTask] Error in task:", e);
            this._completed = true;
            return false;
        }
    }

    /**
     * Check if this task is suspended (waiting for a condition).
     */
    suspended(): boolean {
        return this.currentCondition !== null;
    }

    /**
     * Check if this task has completed.
     */
    completed(): boolean {
        return this._completed;
    }

    /**
     * Terminate this task and invoke the terminate action if set.
     */
    terminate(): void {
        this.currentCondition = null;
        this.requestReturnValue = null;
        this._completed = true;
        if (this.terminateAction) {
            try {
                this.terminateAction(this);
            } catch (e) {
                logger.info("[QueueTask] Error in terminate action:", e);
            }
        }
    }

    /**
     * Set a return value that the task is waiting for.
     */
    setReturnValue(value: unknown): void {
        this.requestReturnValue = value;
    }
}

/**
 * Helper to create wait conditions for use in generator tasks.
 */
export const TaskConditions = {
    /**
     * Wait for the specified number of game cycles.
     */
    wait(cycles: number): SuspendCondition {
        if (cycles <= 0) {
            throw new Error("Wait cycles must be greater than 0");
        }
        return new WaitCondition(cycles);
    },

    /**
     * Wait for a predicate to return true.
     */
    waitUntil(predicate: () => boolean): SuspendCondition {
        return new PredicateCondition(predicate);
    },

    /**
     * Wait for a return value to be set.
     */
    waitReturnValue(task: QueueTask): SuspendCondition {
        return new PredicateCondition(() => task.requestReturnValue !== null);
    },
};

/**
 * Type for a task generator function.
 */
export type TaskGenerator<TContext = unknown> = (
    task: QueueTask<TContext>,
) => Generator<SuspendCondition, void, void>;

/**
 * Create a QueueTask from a generator function.
 */
export function createTask<TContext>(
    ctx: TContext,
    priority: TaskPriority,
    generatorFn: TaskGenerator<TContext>,
): QueueTask<TContext> {
    const task = new QueueTask(ctx, priority);
    task.setCoroutine(generatorFn(task));
    return task;
}
