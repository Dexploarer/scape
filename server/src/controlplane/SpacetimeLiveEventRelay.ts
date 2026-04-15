import type { NpcState } from "../game/npc";
import type { PlayerState } from "../game/player";
import { type EventSubscription, GameEventBus } from "../game/events/GameEventBus";
import { buildLocalPrincipalId, nowMicros } from "../game/state/SpacetimeStateIds";
import { normalizePlayerAccountName } from "../game/state/PlayerSessionKeys";
import { safeJsonStringify } from "../utils/safeJsonStringify";
import { logger } from "../utils/logger";

import type { ControlPlaneClient } from "./ControlPlaneClient";

export interface SpacetimeLiveEventRelayOptions {
    controlPlane: ControlPlaneClient;
    worldId: string;
    eventBus: GameEventBus;
}

interface SerializedLiveEvent {
    principalId?: string;
    worldCharacterId?: string;
    playerId?: number;
    payload: unknown;
}

function serializePlayer(player: PlayerState | undefined) {
    if (!player) return undefined;
    return {
        playerId: player.id,
        username: player.name ?? "",
        principalId: player.__principalId,
        worldCharacterId: player.__worldCharacterId,
        agentId: player.agent?.identity.agentId,
        x: player.tileX,
        z: player.tileY,
        level: player.level,
    };
}

function serializeNpc(npc: NpcState | undefined) {
    if (!npc) return undefined;
    return {
        npcId: npc.id,
        npcTypeId: npc.typeId,
        x: npc.tileX,
        z: npc.tileY,
        level: npc.level,
    };
}

export class SpacetimeLiveEventRelay {
    private readonly subscriptions: EventSubscription[] = [];
    private writeChain: Promise<void> = Promise.resolve();
    private nextEventSerial = 0;

    constructor(private readonly options: SpacetimeLiveEventRelayOptions) {
        this.subscriptions.push(
            this.options.eventBus.on("player:login", ({ player }) => {
                this.record("player:login", {
                    principalId: player.__principalId,
                    worldCharacterId: player.__worldCharacterId,
                    playerId: player.id,
                    payload: serializePlayer(player),
                });
            }),
            this.options.eventBus.on("player:logout", ({ playerId, username }) => {
                const canonical = normalizePlayerAccountName(username);
                this.record("player:logout", {
                    principalId: canonical ? buildLocalPrincipalId(canonical) : undefined,
                    playerId,
                    payload: { playerId, username },
                });
            }),
            this.options.eventBus.on(
                "skill:xpGain",
                ({ player, skillId, xpGained, totalXp, source }) => {
                    this.record("skill:xpGain", {
                        principalId: player.__principalId,
                        worldCharacterId: player.__worldCharacterId,
                        playerId: player.id,
                        payload: {
                            player: serializePlayer(player),
                            skillId,
                            xpGained,
                            totalXp,
                            source,
                        },
                    });
                },
            ),
            this.options.eventBus.on(
                "skill:levelUp",
                ({ player, skillId, oldLevel, newLevel }) => {
                    this.record("skill:levelUp", {
                        principalId: player.__principalId,
                        worldCharacterId: player.__worldCharacterId,
                        playerId: player.id,
                        payload: {
                            player: serializePlayer(player),
                            skillId,
                            oldLevel,
                            newLevel,
                        },
                    });
                },
            ),
            this.options.eventBus.on(
                "combat:levelUp",
                ({ player, oldLevel, newLevel }) => {
                    this.record("combat:levelUp", {
                        principalId: player.__principalId,
                        worldCharacterId: player.__worldCharacterId,
                        playerId: player.id,
                        payload: {
                            player: serializePlayer(player),
                            oldLevel,
                            newLevel,
                        },
                    });
                },
            ),
            this.options.eventBus.on("equipment:equip", ({ player, itemId, slot }) => {
                this.record("equipment:equip", {
                    principalId: player.__principalId,
                    worldCharacterId: player.__worldCharacterId,
                    playerId: player.id,
                    payload: {
                        player: serializePlayer(player),
                        itemId,
                        slot,
                    },
                });
            }),
            this.options.eventBus.on("equipment:unequip", ({ player, itemId, slot }) => {
                this.record("equipment:unequip", {
                    principalId: player.__principalId,
                    worldCharacterId: player.__worldCharacterId,
                    playerId: player.id,
                    payload: {
                        player: serializePlayer(player),
                        itemId,
                        slot,
                    },
                });
            }),
            this.options.eventBus.on(
                "npc:death",
                ({ npc, npcTypeId, combatLevel, killerPlayerId, tile }) => {
                    this.record("npc:death", {
                        playerId: killerPlayerId,
                        payload: {
                            npc: serializeNpc(npc),
                            npcTypeId,
                            combatLevel,
                            killerPlayerId,
                            tile,
                        },
                    });
                },
            ),
            this.options.eventBus.on("interfaces:closeInterruptible", ({ player }) => {
                this.record("interfaces:closeInterruptible", {
                    principalId: player.__principalId,
                    worldCharacterId: player.__worldCharacterId,
                    playerId: player.id,
                    payload: {
                        player: serializePlayer(player),
                    },
                });
            }),
            this.options.eventBus.on("item:craft", ({ playerId, itemId, count }) => {
                this.record("item:craft", {
                    playerId,
                    payload: {
                        playerId,
                        itemId,
                        count,
                    },
                });
            }),
        );
    }

    async dispose(): Promise<void> {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
        this.subscriptions.length = 0;
        await this.writeChain;
    }

    private record(eventName: string, event: SerializedLiveEvent): void {
        const recordedAt = nowMicros();
        const serial = ++this.nextEventSerial;
        const payloadJson = safeJsonStringify(event.payload);
        this.writeChain = this.writeChain.then(async () => {
            await this.options.controlPlane.putLiveEvent({
                event_id: `live-event:${this.options.worldId}:${recordedAt.toString()}:${serial}`,
                world_id: this.options.worldId,
                principal_id: event.principalId,
                world_character_id: event.worldCharacterId,
                player_id: event.playerId,
                source: "game_event_bus",
                event_name: eventName,
                payload_json: payloadJson,
                recorded_at: recordedAt,
            });
        }).catch((error) => {
            logger.error(`[spacetime] live event relay failed for ${eventName}`, error);
        });
    }
}
