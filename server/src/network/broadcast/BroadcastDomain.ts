import type { WebSocket } from "ws";

import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";

/**
 * Provides transport-level send primitives to broadcast domains.
 * Each broadcaster receives this context during flush() so it can
 * send messages without depending on WSServer directly.
 */
export interface BroadcastContext {
    /** Send a message to a specific socket with error guarding. */
    sendWithGuard(sock: WebSocket | undefined, msg: string | Uint8Array, context: string): void;

    /** Broadcast a message to all connected players. */
    broadcast(msg: string | Uint8Array, context?: string): void;

    /** Look up a player's WebSocket by their player ID. */
    getSocketByPlayerId(playerId: number): WebSocket | undefined;

    /** Number of client cycles per server tick (tickMs / 20). */
    cyclesPerTick: number;
}

/**
 * A single broadcast domain responsible for flushing one category
 * of queued state updates to clients during the broadcast phase.
 *
 * Domains are called in strict OSRS-parity order by the coordinator.
 */
export interface BroadcastDomain {
    flush(frame: TickFrame, ctx: BroadcastContext): void;
}
