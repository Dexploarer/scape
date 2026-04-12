import type { EventSubscription } from "../../game/events/GameEventBus";
import type { PlayerState } from "../../game/player";
import type { ServerServices } from "../../game/ServerServices";

type LiveEventRelayDeps = {
    services: () => ServerServices;
    now?: () => number;
};

export interface BotSdkLiveEvent {
    event: string;
    timestamp: number;
    playerId?: number;
    payload?: Record<string, unknown>;
}

export class BotSdkLiveEventRelay {
    private readonly subscriptions: EventSubscription[] = [];
    private readonly now: () => number;

    constructor(
        private readonly deps: LiveEventRelayDeps,
        private readonly emit: (player: PlayerState, event: BotSdkLiveEvent) => void,
    ) {
        this.now = deps.now ?? (() => Date.now());
        const services = deps.services();

        this.subscriptions.push(
            services.eventBus.on("player:login", ({ player }) => {
                this.emit(player, { event: "player.login", timestamp: this.now(), playerId: player.id });
            }),
            services.eventBus.on("skill:xpGain", ({ player, skillId, xpGained, totalXp, source }) => {
                this.emit(player, {
                    event: "skill.xpGain",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: {
                        skillId,
                        xpGained: Math.floor(xpGained),
                        totalXp: Math.floor(totalXp),
                        source,
                    },
                });
            }),
            services.eventBus.on("skill:levelUp", ({ player, skillId, oldLevel, newLevel }) => {
                this.emit(player, {
                    event: "skill.levelUp",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: { skillId, oldLevel, newLevel },
                });
            }),
            services.eventBus.on("combat:levelUp", ({ player, oldLevel, newLevel }) => {
                this.emit(player, {
                    event: "combat.levelUp",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: { oldLevel, newLevel },
                });
            }),
            services.eventBus.on("equipment:equip", ({ player, itemId, slot }) => {
                this.emit(player, {
                    event: "equipment.equip",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: { itemId, slot },
                });
            }),
            services.eventBus.on("equipment:unequip", ({ player, itemId, slot }) => {
                this.emit(player, {
                    event: "equipment.unequip",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: { itemId, slot },
                });
            }),
            services.eventBus.on("npc:death", ({ npc, npcTypeId, killerPlayerId, tile }) => {
                if (!(killerPlayerId !== undefined && killerPlayerId >= 0)) return;
                const player = this.deps.services().players?.getById(killerPlayerId);
                if (!player) return;
                this.emit(player, {
                    event: "npc.death",
                    timestamp: this.now(),
                    playerId: player.id,
                    payload: {
                        npcId: npc.id,
                        npcTypeId,
                        x: tile.x,
                        z: tile.y,
                        level: tile.level,
                    },
                });
            }),
            services.eventBus.on("item:craft", ({ playerId, itemId, count }) => {
                const player = this.deps.services().players?.getById(playerId);
                if (!player) return;
                this.emit(player, {
                    event: "item.craft",
                    timestamp: this.now(),
                    playerId,
                    payload: {
                        itemId,
                        count: Math.max(1, Math.floor(count)),
                    },
                });
            }),
        );
    }

    dispose(): void {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
        this.subscriptions.length = 0;
    }
}
