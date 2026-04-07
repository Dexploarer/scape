import { logger } from "../../utils/logger";
import type { GameEventMap, GameEventName } from "./GameEvents";

export interface EventSubscription {
    unsubscribe(): void;
}

export interface GameEvent {
    /** Set to true to prevent lower-priority listeners from running. */
    handled: boolean;
}

interface ListenerEntry<E extends GameEventName> {
    priority: number;
    handler: (event: GameEventMap[E] & GameEvent) => void;
}

/**
 * Typed, synchronous game event bus.
 *
 * - Listeners execute in priority order (higher = first) within the same tick.
 * - A listener can set `event.handled = true` to stop propagation to lower-priority listeners.
 * - Each listener is error-isolated: one failing handler does not stop others.
 * - Subscriptions return an unsubscribe handle for cleanup.
 */
export class GameEventBus {
    private listeners = new Map<GameEventName, ListenerEntry<any>[]>();
    private sorted = new Map<GameEventName, boolean>();

    /**
     * Subscribe to a game event.
     *
     * @param event    - The event name from GameEventMap.
     * @param handler  - Callback invoked when the event fires.
     * @param priority - Higher runs first. Default 0.
     */
    on<E extends GameEventName>(
        event: E,
        handler: (payload: GameEventMap[E] & GameEvent) => void,
        priority?: number,
    ): EventSubscription;
    /**
     * @deprecated Pass priority as the third argument instead of an id string.
     */
    on<E extends GameEventName>(
        event: E,
        id: string,
        handler: (payload: GameEventMap[E] & GameEvent) => void,
        priority?: number,
    ): EventSubscription;
    on<E extends GameEventName>(
        event: E,
        handlerOrId: string | ((payload: GameEventMap[E] & GameEvent) => void),
        handlerOrPriority?: number | ((payload: GameEventMap[E] & GameEvent) => void),
        maybePriority?: number,
    ): EventSubscription {
        let handler: (payload: GameEventMap[E] & GameEvent) => void;
        let priority: number;

        if (typeof handlerOrId === "string") {
            handler = handlerOrPriority as (payload: GameEventMap[E] & GameEvent) => void;
            priority = maybePriority ?? 0;
        } else {
            handler = handlerOrId;
            priority = (handlerOrPriority as number) ?? 0;
        }

        const entry: ListenerEntry<E> = { priority, handler };
        let bucket = this.listeners.get(event);
        if (!bucket) {
            bucket = [];
            this.listeners.set(event, bucket);
        }
        bucket.push(entry);
        this.sorted.set(event, false);
        return {
            unsubscribe: () => {
                const arr = this.listeners.get(event);
                if (!arr) return;
                const idx = arr.indexOf(entry);
                if (idx >= 0) arr.splice(idx, 1);
                if (arr.length === 0) this.listeners.delete(event);
            },
        };
    }

    /**
     * Emit a game event synchronously.
     * Listeners run in priority order. If any listener sets `handled = true`,
     * remaining lower-priority listeners are skipped.
     */
    emit<E extends GameEventName>(event: E, payload: GameEventMap[E]): void {
        const bucket = this.listeners.get(event);
        if (!bucket || bucket.length === 0) return;

        if (!this.sorted.get(event)) {
            bucket.sort((a, b) => b.priority - a.priority);
            this.sorted.set(event, true);
        }

        const eventObj = payload as GameEventMap[E] & GameEvent;
        eventObj.handled = false;

        for (const entry of bucket) {
            try {
                entry.handler(eventObj);
            } catch (err) {
                logger.error(`[EventBus] listener for "${event}" threw`, err);
            }
            if (eventObj.handled) break;
        }
    }

    /**
     * Remove all listeners for a specific event, or all events if none specified.
     */
    clear(event?: GameEventName): void {
        if (event) {
            this.listeners.delete(event);
            this.sorted.delete(event);
        } else {
            this.listeners.clear();
            this.sorted.clear();
        }
    }

    /**
     * Get the number of listeners registered for an event.
     */
    listenerCount(event: GameEventName): number {
        return this.listeners.get(event)?.length ?? 0;
    }
}
