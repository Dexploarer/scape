import { SkillId } from "../../../../../../src/rs/skill/skills";
import { type ScriptModule } from "../../types";
import { readPositiveEnvInteger } from "../../utils/env";
import { BURIABLE_BONES_XP } from "./prayerData";
import { formatBuryMessage } from "./prayerMessages";

// Keep animation id local to the skill module
const BURY_BONE_SEQ = 827;
const BURY_BONE_SOUND = 2738;
// Use tick-based timing for consistency with server cadence.
const BURY_COOLDOWN_TICKS = readPositiveEnvInteger("PRAYER_BURY_DELAY_TICKS") ?? 2; // default 2 ticks (1.2s at 600ms)

// Track last bury tick per player
const lastBuryTick: Map<number, number> = new Map();

// Queue of scheduled completions (xp + second message)
type PendingBury = {
    at: number;
    player: any; // PlayerState (typed as any to avoid circular deps)
    itemId: number;
    xp: number;
    message?: string;
};
const pending: PendingBury[] = [];

export const prayerModule: ScriptModule = {
    id: "skills.prayer",
    register(registry, services) {
        const ids = Array.from(BURIABLE_BONES_XP.keys());
        // Per-tick processor for delayed XP + message
        registry.registerTickHandler(({ tick, services: svc }) => {
            if (pending.length === 0) return;
            for (let i = pending.length - 1; i >= 0; i--) {
                const job = pending[i];
                if (job.at <= tick) {
                    try {
                        svc?.addSkillXp?.(job.player, SkillId.Prayer, job.xp);
                        // OSRS message mentions the specific bone type if known
                        const text = job.message ?? formatBuryMessage();
                        svc.sendGameMessage(job.player, text);
                    } finally {
                        pending.splice(i, 1);
                    }
                }
            }
        });

        const bury = (id: number) =>
            registry.registerItemAction(
                id,
                ({ tick, player, source, services: svc }) => {
                    const slot = source.slot;
                    const itemId = source.itemId;
                    const xp = BURIABLE_BONES_XP.get(itemId) ?? 5;
                    const consume = svc?.consumeItem;
                    // Cooldown: block if last bury within configured ticks
                    const pid = player?.id as number;
                    const last = lastBuryTick.get(pid) ?? -Infinity;
                    if (tick <= last + BURY_COOLDOWN_TICKS) return;

                    if (!consume || !consume(player, slot)) return;
                    lastBuryTick.set(pid, tick);

                    // Immediate animation + sound (OSRS shows no early chat)
                    svc?.playPlayerSeq?.(player, BURY_BONE_SEQ);
                    svc?.playLocSound?.({
                        soundId: BURY_BONE_SOUND,
                        tile: { x: player.tileX, y: player.tileY },
                        level: player.level,
                    });
                    const name = (() => {
                        try {
                            const obj = svc?.getObjType?.(itemId);
                            return (obj?.name as string) || "bones";
                        } catch {
                            return "bones";
                        }
                    })();
                    // Schedule XP + second message in BURY_COOLDOWN_TICKS (slower cadence)
                    pending.push({
                        at: tick + BURY_COOLDOWN_TICKS,
                        player,
                        itemId: itemId,
                        xp: xp,
                        message: formatBuryMessage(name),
                    });
                    if (svc) {
                        svc.snapshotInventoryImmediate(player);
                    }
                },
                "bury",
            );
        for (const id of ids) bury(id);
    },
};
