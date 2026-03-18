import { EventEmitter } from "events";

export interface TickEvent {
    tick: number;
    time: number; // ms since epoch
}

export declare interface GameTicker {
    on(event: "tick", listener: (data: TickEvent) => void | Promise<void>): this;
    emit(event: "tick", data: TickEvent): boolean;
}

const DEFAULT_MAX_CATCH_UP_TICKS = 5;

export class GameTicker extends EventEmitter {
    private timer: NodeJS.Timeout | null = null;
    private tickIdx = 0;
    private readonly tickMs: number;
    private readonly maxCatchUpTicks: number;
    private readonly driftWarnMs: number;
    private readonly clock: () => number;
    private running = false;
    private lastScheduledAt = 0;

    constructor(tickMs: number, opts?: { maxCatchUpTicks?: number; clock?: () => number }) {
        super();
        this.tickMs = Math.max(1, tickMs);
        this.maxCatchUpTicks = Math.max(1, opts?.maxCatchUpTicks ?? DEFAULT_MAX_CATCH_UP_TICKS);
        this.clock = opts?.clock ?? Date.now;
        this.driftWarnMs = Math.max(this.tickMs, Math.floor(this.tickMs * 1.5));
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.lastScheduledAt = this.clock();
        this.scheduleNext();
    }

    stop(): void {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    currentTick(): number {
        return this.tickIdx;
    }

    private scheduleNext(): void {
        if (!this.running) return;
        const nextTarget = this.lastScheduledAt + this.tickMs;
        const delay = Math.max(0, nextTarget - this.clock());
        this.timer = setTimeout(() => {
            this.tickLoop().catch((err) => {
                // eslint-disable-next-line no-console
                console.error?.("[GameTicker] tick loop exception", err);
            });
        }, delay);
    }

    private async tickLoop(): Promise<void> {
        if (!this.running) return;
        let iterations = 0;
        try {
            while (this.running && this.clock() >= this.lastScheduledAt + this.tickMs) {
                const scheduledTime = this.lastScheduledAt + this.tickMs;
                this.lastScheduledAt = scheduledTime;
                await this.dispatchTick(scheduledTime);
                iterations++;
                const now = this.clock();
                const behindMs = now - this.lastScheduledAt;
                if (behindMs >= this.tickMs) {
                    if (iterations >= this.maxCatchUpTicks) {
                        // eslint-disable-next-line no-console
                        console.warn?.(
                            `[GameTicker] unable to catch up after ${iterations} ticks (behind ${behindMs}ms); skipping ahead`,
                        );
                        this.lastScheduledAt = now;
                        break;
                    }
                    continue;
                }
                if (behindMs > this.driftWarnMs) {
                    // eslint-disable-next-line no-console
                    console.warn?.(
                        `[GameTicker] tick ${this.tickIdx} overran by ${behindMs}ms (budget=${this.tickMs}ms)`,
                    );
                }
                break;
            }
        } finally {
            this.scheduleNext();
        }
    }

    private async dispatchTick(time: number): Promise<void> {
        const payload: TickEvent = { tick: ++this.tickIdx, time: Math.floor(time) };
        const listeners = this.listeners("tick") as ((data: TickEvent) => void | Promise<void>)[];
        for (const listener of listeners) {
            try {
                await listener.call(this, payload);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error?.("[GameTicker] tick listener threw", err);
            }
        }
    }
}
