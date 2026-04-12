import { SKILL_NAME } from "../../../../src/rs/skill/skills";
import type { AgentPerceptionEvent } from "../../agent";
import { getItemDefinition } from "../../data/items";
import type { EventSubscription } from "../../game/events/GameEventBus";
import type { PlayerState } from "../../game/player";
import type { ServerServices } from "../../game/ServerServices";
import { normalizePlayerAccountName } from "../../game/state/PlayerSessionKeys";

export const MAX_RECENT_EVENTS_PER_PLAYER = 12;

type RecentEventStoreDeps = {
    services: () => ServerServices;
    now?: () => number;
};

function normalizePlayerKey(player: Pick<PlayerState, "name"> | string | undefined): string | undefined {
    const name = typeof player === "string" ? player : player?.name;
    return normalizePlayerAccountName(name);
}

function isMeaningfulName(name: string | undefined): name is string {
    const trimmed = name?.trim();
    return !!trimmed && trimmed.toLowerCase() !== "null";
}

export class BotSdkRecentEventStore {
    private readonly recentByPlayer = new Map<string, AgentPerceptionEvent[]>();
    private readonly subscriptions: EventSubscription[] = [];
    private readonly now: () => number;

    constructor(private readonly deps: RecentEventStoreDeps) {
        this.now = deps.now ?? (() => Date.now());
        const services = this.deps.services();

        this.subscriptions.push(
            services.eventBus.on("player:login", ({ player }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                this.push(key, {
                    kind: "login",
                    timestamp: this.now(),
                    message: "Logged in.",
                });
            }),
            services.eventBus.on("skill:xpGain", ({ player, skillId, xpGained, totalXp }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                const skillName = SKILL_NAME[skillId] ?? `skill_${skillId}`;
                this.push(key, {
                    kind: "xp",
                    timestamp: this.now(),
                    message: `Gained ${Math.floor(xpGained)} xp in ${skillName} (total ${Math.floor(totalXp)}).`,
                    skillId,
                    amount: Math.floor(xpGained),
                });
            }),
            services.eventBus.on("skill:levelUp", ({ player, skillId, oldLevel, newLevel }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                const skillName = SKILL_NAME[skillId] ?? `skill_${skillId}`;
                this.push(key, {
                    kind: "level_up",
                    timestamp: this.now(),
                    message: `${skillName} level ${oldLevel} -> ${newLevel}.`,
                    skillId,
                    amount: newLevel,
                });
            }),
            services.eventBus.on("combat:levelUp", ({ player, oldLevel, newLevel }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                this.push(key, {
                    kind: "combat_level_up",
                    timestamp: this.now(),
                    message: `Combat level ${oldLevel} -> ${newLevel}.`,
                    amount: newLevel,
                });
            }),
            services.eventBus.on("equipment:equip", ({ player, itemId, slot }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                const itemName = this.resolveItemName(itemId);
                this.push(key, {
                    kind: "equip",
                    timestamp: this.now(),
                    message: `Equipped ${itemName} in slot ${slot}.`,
                    itemId,
                    amount: slot,
                });
            }),
            services.eventBus.on("equipment:unequip", ({ player, itemId, slot }) => {
                const key = normalizePlayerKey(player);
                if (!key) return;
                const itemName = this.resolveItemName(itemId);
                this.push(key, {
                    kind: "unequip",
                    timestamp: this.now(),
                    message: `Unequipped ${itemName} from slot ${slot}.`,
                    itemId,
                    amount: slot,
                });
            }),
            services.eventBus.on("npc:death", ({ npc, npcTypeId, killerPlayerId, tile }) => {
                if (!(killerPlayerId !== undefined && killerPlayerId >= 0)) {
                    return;
                }
                const player = this.deps.services().players?.getById(killerPlayerId);
                const key = normalizePlayerKey(player);
                if (!key) return;
                const npcName = this.resolveNpcName(npcTypeId, npc.name);
                this.push(key, {
                    kind: "npc_kill",
                    timestamp: this.now(),
                    message: `Killed ${npcName} at ${tile.x},${tile.y},${tile.level}.`,
                    npcId: npc.id,
                    x: tile.x,
                    z: tile.y,
                    level: tile.level,
                });
            }),
            services.eventBus.on("item:craft", ({ playerId, itemId, count }) => {
                const player = this.deps.services().players?.getById(playerId);
                const key = normalizePlayerKey(player);
                if (!key) return;
                const itemName = this.resolveItemName(itemId);
                this.push(key, {
                    kind: "craft",
                    timestamp: this.now(),
                    message: `Crafted ${itemName} x${Math.max(1, Math.floor(count))}.`,
                    itemId,
                    amount: Math.max(1, Math.floor(count)),
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

    getRecentForPlayer(player: Pick<PlayerState, "name">): AgentPerceptionEvent[] {
        const key = normalizePlayerKey(player);
        if (!key) return [];
        return [...(this.recentByPlayer.get(key) ?? [])];
    }

    private resolveItemName(itemId: number): string {
        const itemName = getItemDefinition(itemId)?.name;
        if (isMeaningfulName(itemName)) {
            return itemName.trim();
        }
        return `item_${itemId}`;
    }

    private resolveNpcName(npcTypeId: number, liveName: string | undefined): string {
        if (isMeaningfulName(liveName)) {
            return liveName.trim();
        }
        const cacheName = this.deps.services().npcManager?.loadNpcTypeById(npcTypeId)?.name;
        if (isMeaningfulName(cacheName)) {
            return cacheName.trim();
        }
        return `npc_${npcTypeId}`;
    }

    private push(key: string, event: AgentPerceptionEvent): void {
        const next = [...(this.recentByPlayer.get(key) ?? []), event];
        if (next.length > MAX_RECENT_EVENTS_PER_PLAYER) {
            next.splice(0, next.length - MAX_RECENT_EVENTS_PER_PLAYER);
        }
        this.recentByPlayer.set(key, next);
    }
}
