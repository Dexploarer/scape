import { QueueTask, TaskGenerator, createTask } from "./QueueTask";
import { TaskPriority } from "./TaskPriority";

type MenuAwareContext = {
    hasMenuOpen?: () => boolean;
};

/**
 * Manages a set of queue tasks for a pawn.
 * RSMod parity: gg.rsmod.game.model.queue.QueueTaskSet
 */
export class QueueTaskSet<TContext = unknown> {
    private tasks: QueueTask<TContext>[] = [];
    private readonly ctx: TContext;

    constructor(ctx: TContext) {
        this.ctx = ctx;
    }

    /**
     * Queue a new task.
     */
    queue(priority: TaskPriority, generatorFn: TaskGenerator<TContext>): QueueTask<TContext> {
        if (priority === TaskPriority.STRONG) {
            this.terminateTasks();
        }

        const task = createTask(this.ctx, priority, generatorFn);
        // RSMod: addFirst (most recent task runs first)
        this.tasks.unshift(task);
        return task;
    }

    /**
     * Queue a weak task (can be interrupted by player input).
     */
    queueWeak(generatorFn: TaskGenerator<TContext>): QueueTask<TContext> {
        return this.queue(TaskPriority.WEAK, generatorFn);
    }

    /**
     * Queue a standard task.
     */
    queueStandard(generatorFn: TaskGenerator<TContext>): QueueTask<TContext> {
        return this.queue(TaskPriority.STANDARD, generatorFn);
    }

    /**
     * Queue a strong task.
     */
    queueStrong(generatorFn: TaskGenerator<TContext>): QueueTask<TContext> {
        return this.queue(TaskPriority.STRONG, generatorFn);
    }

    /**
     * Process tasks for one game cycle.
     */
    cycle(): void {
        while (true) {
            const task = this.tasks[0];
            if (!task) break;

            const ctx = task.ctx as TContext & MenuAwareContext;
            if (task.priority === TaskPriority.STANDARD && ctx.hasMenuOpen?.()) {
                break;
            }

            if (!task.invoked) {
                task.invoked = true;
                task.invoke();
            }

            task.cycle();

            if (!task.suspended()) {
                this.tasks.shift();
                continue;
            }

            break;
        }
    }

    /**
     * Submit a return value for the current task.
     */
    submitReturnValue(value: unknown): void {
        const task = this.tasks[0];
        if (!task) return;
        task.requestReturnValue = value;
    }

    /**
     * Terminate all tasks.
     */
    terminateTasks(): void {
        for (const task of this.tasks) {
            task.terminate();
        }
        this.tasks = [];
    }

    /**
     * Check if any tasks are currently running.
     */
    hasActiveTasks(): boolean {
        return this.tasks.length > 0;
    }

    /**
     * Check if any tasks of the given priority are running.
     */
    hasTasksOfPriority(priority: TaskPriority): boolean {
        return this.tasks.some((task) => task.priority === priority);
    }

    /**
     * Get the number of active tasks.
     */
    get size(): number {
        return this.tasks.length;
    }

    /**
     * Check if any task is currently suspended (waiting).
     */
    hasSuspendedTasks(): boolean {
        return this.tasks.some((task) => task.suspended());
    }
}
