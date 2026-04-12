import { describe, expect, test } from "bun:test";

import { GameEventBus } from "../server/src/game/events/GameEventBus";
import type { PlayerState } from "../server/src/game/player";
import type { ServerServices } from "../server/src/game/ServerServices";
import {
    BotSdkRecentEventStore,
    MAX_RECENT_EVENTS_PER_PLAYER,
} from "../server/src/network/botsdk/BotSdkRecentEventStore";

function createPlayer(id: number, name: string): PlayerState {
    return { id, name } as unknown as PlayerState;
}

describe("BotSdkRecentEventStore", () => {
    test("records supported events by normalized player name and preserves reconnect continuity", () => {
        const eventBus = new GameEventBus();
        const players = new Map<number, PlayerState>();
        const firstSession = createPlayer(1, "Agent One");
        const secondSession = createPlayer(77, "  AGENT one ");
        players.set(1, firstSession);
        players.set(77, secondSession);

        let now = 1000;
        const services = {
            eventBus,
            players: {
                getById: (id: number) => players.get(id),
            },
            npcManager: {
                loadNpcTypeById: (id: number) =>
                    id === 99 ? ({ name: "Goblin" } as Record<string, unknown>) : undefined,
            },
        } as unknown as ServerServices;
        const store = new BotSdkRecentEventStore({
            services: () => services,
            now: () => ++now,
        });

        eventBus.emit("player:login", { player: firstSession });
        eventBus.emit("skill:xpGain", {
            player: firstSession,
            skillId: 0,
            xpGained: 125,
            totalXp: 1_000,
            source: "skill",
        });
        eventBus.emit("equipment:equip", {
            player: firstSession,
            itemId: 4151,
            slot: 3,
        });
        eventBus.emit("npc:death", {
            npc: { id: 200, name: undefined } as Record<string, unknown>,
            npcTypeId: 99,
            killerPlayerId: 1,
            tile: { x: 3200, y: 3201, level: 0 },
        } as Parameters<typeof eventBus.emit<"npc:death">>[1]);
        eventBus.emit("item:craft", {
            playerId: 1,
            itemId: 1265,
            count: 2,
        });
        eventBus.emit("player:login", { player: secondSession });

        const recent = store.getRecentForPlayer({ name: "agent one" } as PlayerState);

        expect(recent.map((entry) => entry.kind)).toEqual([
            "login",
            "xp",
            "equip",
            "npc_kill",
            "craft",
            "login",
        ]);
        expect(recent[2]).toMatchObject({
            kind: "equip",
            itemId: 4151,
            amount: 3,
        });
        expect(recent[3]).toMatchObject({
            kind: "npc_kill",
            npcId: 200,
            x: 3200,
            z: 3201,
            level: 0,
            message: "Killed Goblin at 3200,3201,0.",
        });
        expect(recent[5]?.timestamp).toBe(1006);

        store.dispose();
        eventBus.emit("player:login", { player: secondSession });
        expect(store.getRecentForPlayer({ name: "agent one" } as PlayerState)).toHaveLength(6);
    });

    test("drops oldest entries past the recent-event cap", () => {
        const eventBus = new GameEventBus();
        const player = createPlayer(5, "agent");
        const services = {
            eventBus,
            players: {
                getById: (id: number) => (id === 5 ? player : undefined),
            },
        } as unknown as ServerServices;
        const store = new BotSdkRecentEventStore({
            services: () => services,
            now: (() => {
                let current = 2000;
                return () => current++;
            })(),
        });

        for (let index = 0; index < MAX_RECENT_EVENTS_PER_PLAYER + 3; index++) {
            eventBus.emit("skill:xpGain", {
                player,
                skillId: 0,
                xpGained: index + 1,
                totalXp: 1_000 + index,
                source: "skill",
            });
        }

        const recent = store.getRecentForPlayer(player);
        expect(recent).toHaveLength(MAX_RECENT_EVENTS_PER_PLAYER);
        expect(recent[0]?.amount).toBe(4);
        expect(recent[MAX_RECENT_EVENTS_PER_PLAYER - 1]?.amount).toBe(
            MAX_RECENT_EVENTS_PER_PLAYER + 3,
        );
    });
});
