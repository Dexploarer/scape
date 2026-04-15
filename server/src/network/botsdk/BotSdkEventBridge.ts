import type { AgentPerceptionEvent } from "../../agent";
import type { GameEventBus, EventSubscription } from "../../game/events/GameEventBus";
import type { PlayerState } from "../../game/player";

import type { RuntimeEventFrame } from "./BotSdkProtocol";

export interface BotSdkEventBridgeOptions {
    eventBus: GameEventBus;
    resolvePlayerById: (playerId: number) => PlayerState | undefined;
    sink: (player: PlayerState, frame: RuntimeEventFrame) => void;
    maxRecentEvents?: number;
}

const DEFAULT_MAX_RECENT_EVENTS = 8;

function pushRecentEvent(
    player: PlayerState,
    event: AgentPerceptionEvent,
    maxRecentEvents: number,
): void {
    if (!player.agent) return;
    player.agent.recentEvents.push(event);
    if (player.agent.recentEvents.length > maxRecentEvents) {
        player.agent.recentEvents.splice(
            0,
            player.agent.recentEvents.length - maxRecentEvents,
        );
    }
}

export class BotSdkEventBridge {
    private readonly maxRecentEvents: number;
    private readonly subscriptions: EventSubscription[] = [];

    constructor(private readonly options: BotSdkEventBridgeOptions) {
        this.maxRecentEvents = Math.max(1, options.maxRecentEvents ?? DEFAULT_MAX_RECENT_EVENTS);
        this.subscriptions.push(
            this.options.eventBus.on("player:login", ({ player }) => {
                this.emitToPlayer(player, "player:login", {
                    playerId: player.id,
                    username: player.name ?? "",
                    x: player.tileX,
                    z: player.tileY,
                    level: player.level,
                }, {
                    kind: "lifecycle",
                    message: "Logged into the world.",
                });
            }),
            this.options.eventBus.on("skill:xpGain", ({ player, skillId, xpGained, totalXp, source }) => {
                this.emitToPlayer(player, "skill:xpGain", {
                    playerId: player.id,
                    skillId,
                    xpGained,
                    totalXp,
                    source,
                }, {
                    kind: "xp",
                    message: `Gained ${xpGained} xp in skill ${skillId}.`,
                });
            }),
            this.options.eventBus.on("skill:levelUp", ({ player, skillId, oldLevel, newLevel }) => {
                this.emitToPlayer(player, "skill:levelUp", {
                    playerId: player.id,
                    skillId,
                    oldLevel,
                    newLevel,
                }, {
                    kind: "level_up",
                    message: `Skill ${skillId} leveled from ${oldLevel} to ${newLevel}.`,
                });
            }),
            this.options.eventBus.on("combat:levelUp", ({ player, oldLevel, newLevel }) => {
                this.emitToPlayer(player, "combat:levelUp", {
                    playerId: player.id,
                    oldLevel,
                    newLevel,
                }, {
                    kind: "combat_level",
                    message: `Combat level increased from ${oldLevel} to ${newLevel}.`,
                });
            }),
            this.options.eventBus.on("equipment:equip", ({ player, itemId, slot }) => {
                this.emitToPlayer(player, "equipment:equip", {
                    playerId: player.id,
                    itemId,
                    slot,
                }, {
                    kind: "equipment",
                    message: `Equipped item ${itemId} in slot ${slot}.`,
                });
            }),
            this.options.eventBus.on("equipment:unequip", ({ player, itemId, slot }) => {
                this.emitToPlayer(player, "equipment:unequip", {
                    playerId: player.id,
                    itemId,
                    slot,
                }, {
                    kind: "equipment",
                    message: `Unequipped item ${itemId} from slot ${slot}.`,
                });
            }),
            this.options.eventBus.on("interfaces:closeInterruptible", ({ player }) => {
                this.emitToPlayer(player, "interfaces:closeInterruptible", {
                    playerId: player.id,
                }, {
                    kind: "interface",
                    message: "An interruptible interface was closed.",
                });
            }),
            this.options.eventBus.on("item:craft", ({ playerId, itemId, count }) => {
                const player = this.options.resolvePlayerById(playerId);
                if (!player) return;
                this.emitToPlayer(player, "item:craft", {
                    playerId,
                    itemId,
                    count,
                }, {
                    kind: "item",
                    message: `Crafted item ${itemId} x${count}.`,
                });
            }),
            this.options.eventBus.on("npc:death", ({ npc, npcTypeId, killerPlayerId, tile }) => {
                if (killerPlayerId === undefined) return;
                const player = this.options.resolvePlayerById(killerPlayerId);
                if (!player) return;
                this.emitToPlayer(player, "npc:death", {
                    playerId: killerPlayerId,
                    npcId: npc.id,
                    npcTypeId,
                    tile,
                }, {
                    kind: "combat",
                    message: `Defeated NPC ${npcTypeId}.`,
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

    private emitToPlayer(
        player: PlayerState | undefined,
        name: string,
        payload: Record<string, unknown>,
        recentEvent: Omit<AgentPerceptionEvent, "timestamp">,
    ): void {
        if (!player?.agent?.connected) return;
        const timestamp = Date.now();
        pushRecentEvent(
            player,
            {
                timestamp,
                kind: recentEvent.kind,
                message: recentEvent.message,
            },
            this.maxRecentEvents,
        );
        this.options.sink(player, {
            kind: "event",
            name,
            timestamp,
            payload,
        });
    }
}
