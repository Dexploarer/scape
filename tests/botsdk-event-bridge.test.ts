import { describe, expect, test } from "bun:test";

import { GameEventBus } from "../server/src/game/events/GameEventBus";
import { BotSdkEventBridge } from "../server/src/network/botsdk/BotSdkEventBridge";

describe("BotSdkEventBridge", () => {
    test("pushes TOON event frames and buffers recent agent events", () => {
        const eventBus = new GameEventBus();
        const frames: Array<{ playerId: number; frame: unknown }> = [];
        const player = {
            id: 12,
            name: "Alice",
            agent: {
                connected: true,
                recentEvents: [],
            },
        } as any;

        const bridge = new BotSdkEventBridge({
            eventBus,
            resolvePlayerById: (playerId) => (playerId === 12 ? player : undefined),
            sink: (target, frame) => {
                frames.push({ playerId: target.id, frame });
            },
            maxRecentEvents: 2,
        });

        eventBus.emit("skill:levelUp", {
            player,
            skillId: 14,
            oldLevel: 9,
            newLevel: 10,
        });
        eventBus.emit("equipment:equip", {
            player,
            itemId: 4151,
            slot: 3,
        });
        eventBus.emit("combat:levelUp", {
            player,
            oldLevel: 15,
            newLevel: 16,
        });

        bridge.dispose();

        expect(frames).toHaveLength(3);
        expect(frames[0]?.frame).toMatchObject({
            kind: "event",
            name: "skill:levelUp",
            payload: {
                playerId: 12,
                skillId: 14,
                oldLevel: 9,
                newLevel: 10,
            },
        });
        expect(player.agent.recentEvents).toHaveLength(2);
        expect(player.agent.recentEvents[0]).toMatchObject({
            kind: "equipment",
            message: "Equipped item 4151 in slot 3.",
        });
        expect(player.agent.recentEvents[1]).toMatchObject({
            kind: "combat_level",
            message: "Combat level increased from 15 to 16.",
        });
    });
});
