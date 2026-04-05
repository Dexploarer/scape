import type { WebSocket } from "ws";

import { resolveHitsplatTypeForObserver } from "../../game/combat/OsrsHitsplatIds";
import type { TickFrame } from "../../game/tick/TickPhaseOrchestrator";
import { encodeMessage } from "../messages";
import type { BroadcastContext, BroadcastDomain } from "./BroadcastDomain";

export interface CombatBroadcasterServices {
    enableBinaryNpcSync: boolean;
    forEachPlayer(fn: (sock: WebSocket, player: { id: number }) => void): void;
    withDirectSendBypass<T>(context: string, fn: () => T): T;
}

/**
 * Broadcasts combat-related packets: hitsplats, NPC effect events,
 * spot animations, and combat state snapshots.
 */
export class CombatBroadcaster implements BroadcastDomain {
    constructor(private readonly services: CombatBroadcasterServices) {}

    flush(frame: TickFrame, ctx: BroadcastContext): void {
        this.flushHitsplats(frame, ctx);
        this.flushNpcEffectEvents(frame, ctx);
        this.flushSpotAnimations(frame, ctx);
        this.flushCombatSnapshots(frame, ctx);
    }

    private flushHitsplats(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.hitsplats || frame.hitsplats.length === 0) return;

        for (const event of frame.hitsplats) {
            // When binary player sync is enabled, player hitsplats are encoded as update blocks.
            // Keep legacy broadcast only for NPC hitsplats (and for non-binary mode).
            if (event.targetType === "player") continue;
            if (this.services.enableBinaryNpcSync && event.targetType === "npc") {
                continue;
            }
            const payload: {
                targetType: "player" | "npc";
                targetId: number;
                damage: number;
                style: number;
                type2?: number;
                damage2?: number;
                delayCycles?: number;
                tick: number;
            } = {
                targetType: event.targetType,
                targetId: event.targetId,
                damage: event.damage,
                style: event.style,
                tick: event.tick ?? frame.tick,
            };
            const extraDelayTicks =
                event.delayTicks !== undefined ? Math.max(0, event.delayTicks) : 0;
            const delayServerTicks = Math.max(0, payload.tick - frame.tick) + extraDelayTicks;
            payload.delayCycles = Math.max(0, Math.round(delayServerTicks * ctx.cyclesPerTick));
            if (event.type2 !== undefined && event.damage2 !== undefined) {
                payload.type2 = event.type2;
                payload.damage2 = event.damage2;
            }
            this.services.forEachPlayer((sock, player) => {
                const resolvedPayload = {
                    ...payload,
                    style: resolveHitsplatTypeForObserver(
                        payload.style,
                        player.id,
                        event.targetType,
                        event.targetId,
                        event.sourcePlayerId,
                        event.sourceType,
                    ),
                    type2:
                        payload.type2 !== undefined
                            ? resolveHitsplatTypeForObserver(
                                  payload.type2,
                                  player.id,
                                  event.targetType,
                                  event.targetId,
                                  event.sourcePlayerId,
                                  event.sourceType,
                              )
                            : undefined,
                };
                ctx.sendWithGuard(
                    sock,
                    encodeMessage({ type: "hitsplat", payload: resolvedPayload }),
                    "hitsplat",
                );
            });
        }
    }

    private flushNpcEffectEvents(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.npcEffectEvents || frame.npcEffectEvents.length === 0) return;

        for (const npcEvent of frame.npcEffectEvents) {
            const hitsplat = npcEvent.hitsplat;
            if (!(hitsplat.amount > 0)) continue;
            if (this.services.enableBinaryNpcSync) continue;
            ctx.broadcast(
                encodeMessage({
                    type: "hitsplat",
                    payload: {
                        targetType: "npc" as const,
                        targetId: npcEvent.npcId,
                        damage: hitsplat.amount,
                        style: hitsplat.style,
                        tick: frame.tick,
                    },
                }),
            );
        }
    }

    private flushSpotAnimations(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.spotAnimations || frame.spotAnimations.length === 0) return;

        for (const event of frame.spotAnimations) {
            if (!(event && event.spotId >= 0)) continue;
            // When binary player sync is enabled, player spot animations are encoded as update blocks.
            // Keep legacy broadcast for NPCs and world tiles.
            if (event.playerId !== undefined) continue;
            if (this.services.enableBinaryNpcSync && event.npcId !== undefined) {
                continue;
            }
            const payload: {
                spotId: number;
                playerId?: number;
                npcId?: number;
                height?: number;
                delay?: number;
                tile?: { x: number; y: number; level?: number };
            } = {
                spotId: event.spotId,
            };
            if (event.delay !== undefined && Number.isFinite(event.delay)) {
                const delayServerTicks = Math.max(0, event.delay);
                payload.delay = Math.min(
                    0xffff,
                    Math.max(0, Math.round(delayServerTicks * ctx.cyclesPerTick)),
                );
            }
            if (event.height !== undefined && Number.isFinite(event.height)) {
                payload.height = event.height;
            }
            if (event.playerId !== undefined && event.playerId >= 0) {
                payload.playerId = event.playerId;
            } else if (event.npcId !== undefined && event.npcId >= 0) {
                payload.npcId = event.npcId;
            } else if (event.tile) {
                payload.tile = {
                    x: event.tile.x,
                    y: event.tile.y,
                    level: event.tile.level,
                };
            } else {
                continue;
            }
            this.services.withDirectSendBypass("combat_spot", () =>
                ctx.broadcast(encodeMessage({ type: "spot", payload }), "combat_spot"),
            );
        }
    }

    private flushCombatSnapshots(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.combatSnapshots || frame.combatSnapshots.length === 0) return;

        for (const snapshot of frame.combatSnapshots) {
            const sock = ctx.getSocketByPlayerId(snapshot.playerId);
            ctx.sendWithGuard(
                sock,
                encodeMessage({
                    type: "combat",
                    payload: {
                        weaponCategory: snapshot.weaponCategory,
                        weaponItemId: snapshot.weaponItemId,
                        autoRetaliate: snapshot.autoRetaliate,
                        activeStyle: snapshot.activeStyle,
                        activePrayers: snapshot.activePrayers,
                        activeSpellId: snapshot.activeSpellId,
                        specialEnergy: snapshot.specialEnergy,
                        specialActivated: snapshot.specialActivated,
                        quickPrayers: snapshot.quickPrayers,
                        quickPrayersEnabled: snapshot.quickPrayersEnabled,
                    },
                }),
                "combat_snapshot",
            );
        }
    }
}
