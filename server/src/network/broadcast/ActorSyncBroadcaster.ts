import type { WebSocket } from "ws";

import type { PlayerState } from "../../game/player";
import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

/**
 * Callback that builds and sends player sync, NPC sync, and WorldEntity info
 * packets for a single player. The actual encoding is delegated to the existing
 * PlayerPacketEncoder / NpcPacketEncoder / WorldEntityInfoEncoder instances
 * owned by WSServer, keeping session state management in one place.
 */
export type ActorSyncCallback = (
    sock: WebSocket,
    player: PlayerState,
    frame: TickFrame,
    ctx: BroadcastContext,
) => void;

/**
 * Broadcasts player sync, NPC sync, and WorldEntity info packets.
 *
 * player + NPC sync are sent before widget/dialog events
 * so UI handlers read up-to-date actor positions.
 */
export class ActorSyncBroadcaster implements BroadcastDomain {
    private syncCallback: ActorSyncCallback | undefined;
    private forEachPlayer:
        | ((fn: (sock: WebSocket, player: PlayerState) => void) => void)
        | undefined;
    private applyAppearanceSnapshots:
        | ((frame: TickFrame) => void)
        | undefined;

    setSyncCallback(callback: ActorSyncCallback): void {
        this.syncCallback = callback;
    }

    setForEachPlayer(
        fn: (callback: (sock: WebSocket, player: PlayerState) => void) => void,
    ): void {
        this.forEachPlayer = fn;
    }

    setApplyAppearanceSnapshots(fn: (frame: TickFrame) => void): void {
        this.applyAppearanceSnapshots = fn;
    }

    flush(frame: TickFrame, ctx: BroadcastContext): void {
        // Apply appearance snapshots before building player sync packets.
        if (this.applyAppearanceSnapshots) {
            this.applyAppearanceSnapshots(frame);
        }

        if (!this.forEachPlayer || !this.syncCallback) return;

        this.forEachPlayer((sock, player) => {
            this.syncCallback!(sock, player, frame, ctx);
        });
    }
}
