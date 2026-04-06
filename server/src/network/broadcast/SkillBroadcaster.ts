import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import { encodeMessage } from "../messages";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

/**
 * Broadcasts skill/stat snapshot packets to individual players.
 *
 * skill/stat packets must arrive before combat visuals and actor sync
 * so CS2 stat-transmit XP drops fire ahead of attack sequences and hitsplats.
 */
export class SkillBroadcaster implements BroadcastDomain {
    flush(frame: TickFrame, ctx: BroadcastContext): void {
        const snapshots = frame.skillSnapshots;
        if (!snapshots || snapshots.length === 0) return;

        for (const snapshot of snapshots) {
            const sock = ctx.getSocketByPlayerId(snapshot.playerId);
            const update = snapshot.update;
            ctx.sendWithGuard(
                sock,
                encodeMessage({
                    type: "skills",
                    payload: {
                        kind: update.snapshot ? ("snapshot" as const) : ("delta" as const),
                        skills: update.skills,
                        totalLevel: update.totalLevel,
                        combatLevel: update.combatLevel,
                    },
                }),
                "skill_snapshot",
            );
        }
    }
}
