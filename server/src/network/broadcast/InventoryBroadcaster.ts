import type { PlayerState } from "../../game/player";
import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import { encodeMessage } from "../messages";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

export interface InventoryBroadcasterServices {
    getPlayerById(id: number): PlayerState | undefined;
    getInventory(player: PlayerState): Array<{ itemId: number; quantity: number }>;
}

/**
 * Broadcasts inventory snapshot packets to individual players.
 */
export class InventoryBroadcaster implements BroadcastDomain {
    constructor(private readonly services: InventoryBroadcasterServices) {}

    flush(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.inventorySnapshots || frame.inventorySnapshots.length === 0) return;

        for (const snapshot of frame.inventorySnapshots) {
            const player = this.services.getPlayerById(snapshot.playerId);
            if (!player) continue;
            const slots = this.services.getInventory(player).map((entry, idx) => ({
                slot: idx,
                itemId: entry.itemId,
                quantity: entry.quantity,
            }));
            const sock = ctx.getSocketByPlayerId(snapshot.playerId);
            ctx.sendWithGuard(
                sock,
                encodeMessage({
                    type: "inventory",
                    payload: { kind: "snapshot", slots },
                }),
                "inventory_snapshot",
            );
        }
    }
}
