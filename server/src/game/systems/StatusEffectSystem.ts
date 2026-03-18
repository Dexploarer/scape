import { StatusHitsplat } from "../combat/HitEffects";
import { NpcState } from "../npc";
import { PlayerState } from "../player";

export class StatusEffectSystem {
    processPlayer(player: PlayerState, tick: number): StatusHitsplat[] | undefined {
        return player.tickHitpoints(tick);
    }

    processNpc(npc: NpcState, tick: number): StatusHitsplat[] | undefined {
        return npc.tickStatusEffects(tick);
    }
}
