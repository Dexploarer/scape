import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import { encodeMessage } from "../messages";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

/**
 * Broadcasts varp and varbit updates to individual players.
 *
 * OSRS parity: varps/varbits are sent BEFORE non-close widget events
 * so scripts have correct state when interfaces open.
 */
export class VarBroadcaster implements BroadcastDomain {
    flush(frame: TickFrame, ctx: BroadcastContext): void {
        if (frame.varps && frame.varps.length > 0) {
            for (const varp of frame.varps) {
                const sock = ctx.getSocketByPlayerId(varp.playerId);
                if (!sock) continue;
                ctx.sendWithGuard(
                    sock,
                    encodeMessage({
                        type: "varp",
                        payload: { varpId: varp.varpId, value: varp.value },
                    }),
                    "varp",
                );
            }
        }

        if (frame.varbits && frame.varbits.length > 0) {
            for (const varbit of frame.varbits) {
                const sock = ctx.getSocketByPlayerId(varbit.playerId);
                if (!sock) continue;
                ctx.sendWithGuard(
                    sock,
                    encodeMessage({
                        type: "varbit",
                        payload: { varbitId: varbit.varbitId, value: varbit.value },
                    }),
                    "varbit",
                );
            }
        }
    }
}
