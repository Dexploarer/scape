/**
 * A key that represents a timer in a TimerMap.
 * RSMod parity: gg.rsmod.game.model.timer.TimerKey
 *
 * @param id - Unique identifier for this timer key
 * @param persistenceKey - If set, timer persists through player sessions
 * @param tickOffline - If true, timer ticks down while player is offline
 * @param resetOnDeath - If true, timer is removed on pawn death
 */
export class TimerKey {
    private static nextId = 0;
    readonly id: number;

    constructor(
        public readonly persistenceKey: string | null = null,
        public readonly tickOffline: boolean = true,
        public readonly resetOnDeath: boolean = false,
    ) {
        this.id = TimerKey.nextId++;
    }

    equals(other: TimerKey): boolean {
        if (this.persistenceKey !== null) {
            return (
                other.persistenceKey === this.persistenceKey &&
                other.tickOffline === this.tickOffline &&
                other.resetOnDeath === this.resetOnDeath
            );
        }
        return this === other;
    }

    toString(): string {
        return `TimerKey(id=${this.id}, persistenceKey=${this.persistenceKey}, tickOffline=${this.tickOffline}, resetOnDeath=${this.resetOnDeath})`;
    }
}

/**
 * Factory function to create timer keys.
 * Usage: const MY_TIMER = timerKey() or timerKey("persistent_name")
 */
export function timerKey(
    persistenceKey: string | null = null,
    tickOffline: boolean = true,
    resetOnDeath: boolean = false,
): TimerKey {
    return new TimerKey(persistenceKey, tickOffline, resetOnDeath);
}
