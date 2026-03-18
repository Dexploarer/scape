import { TimerKey } from "./TimerKey";

/**
 * Represents a persistent timer that will be saved through player sessions.
 */
export interface PersistentTimer {
    identifier: string;
    tickOffline: boolean;
    timeLeft: number;
    currentMs: number;
}

/**
 * A system responsible for storing and exposing TimerKeys and their associated
 * values. These values represent game cycles left for the timer to "complete".
 * RSMod parity: gg.rsmod.game.model.timer.TimerMap
 */
export class TimerMap {
    private timers: Map<TimerKey, number> = new Map();

    /**
     * Get the remaining ticks for a timer.
     * @throws Error if timer doesn't exist
     */
    get(key: TimerKey): number {
        const value = this.timers.get(key);
        if (value === undefined) {
            throw new Error(`Timer not found: ${key.toString()}`);
        }
        return value;
    }

    /**
     * Get the remaining ticks for a timer, or a default value if not set.
     */
    getOrDefault(key: TimerKey, defaultValue: number = 0): number {
        return this.timers.get(key) ?? defaultValue;
    }

    /**
     * Set the remaining ticks for a timer.
     */
    set(key: TimerKey, value: number): this {
        this.timers.set(key, value);
        return this;
    }

    /**
     * Check if a timer exists and has remaining time (> 0).
     */
    has(key: TimerKey): boolean {
        return (this.timers.get(key) ?? 0) > 0;
    }

    /**
     * Check if a timer key exists in the map (even if value is 0).
     */
    exists(key: TimerKey): boolean {
        return this.timers.has(key);
    }

    /**
     * Remove a timer from the map.
     */
    remove(key: TimerKey): void {
        this.timers.delete(key);
    }

    /**
     * Clear all timers.
     */
    clear(): void {
        this.timers.clear();
    }

    /**
     * Remove timers that match a predicate.
     */
    removeIf(predicate: (key: TimerKey) => boolean): void {
        for (const [key] of this.timers) {
            if (predicate(key)) {
                this.timers.delete(key);
            }
        }
    }

    /**
     * Decrement all timers by 1 tick and return timers that expired.
     * RSMod parity: timers trigger when their value is <= 0 at the start of a cycle,
     * and are removed unless reset by the consumer.
     */
    cycle(onExpire?: (key: TimerKey) => void): TimerKey[] {
        const expired: TimerKey[] = [];
        const iterator = this.timers.entries();
        for (const [key, value] of iterator) {
            if (value <= 0) {
                expired.push(key);
                onExpire?.(key);
                if (!this.has(key)) {
                    this.timers.delete(key);
                }
            }
        }

        for (const [key, value] of this.timers) {
            this.timers.set(key, value - 1);
        }
        return expired;
    }

    /**
     * Get all timers as an iterable.
     */
    entries(): IterableIterator<[TimerKey, number]> {
        return this.timers.entries();
    }

    /**
     * Check if any timers exist.
     */
    get isNotEmpty(): boolean {
        return this.timers.size > 0;
    }

    /**
     * Get the number of active timers.
     */
    get size(): number {
        return this.timers.size;
    }

    /**
     * Convert to persistent timers for saving.
     */
    toPersistentTimers(): PersistentTimer[] {
        const result: PersistentTimer[] = [];
        for (const [key, value] of this.timers) {
            if (key.persistenceKey !== null) {
                result.push({
                    identifier: key.persistenceKey,
                    tickOffline: key.tickOffline,
                    timeLeft: value,
                    currentMs: Date.now(),
                });
            }
        }
        return result;
    }

    /**
     * Remove all timers that should reset on death.
     */
    clearOnDeath(): void {
        this.removeIf((key) => key.resetOnDeath);
    }
}
