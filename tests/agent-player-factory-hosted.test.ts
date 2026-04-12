import { describe, expect, test } from "bun:test";

import { HostedSessionService } from "../server/src/auth/HostedSessionService";
import type { PlayerState } from "../server/src/game/player";
import { AgentPlayerFactory } from "../server/src/network/botsdk/AgentPlayerFactory";

describe("AgentPlayerFactory hosted sessions", () => {
    test("uses hosted world-character identity without touching the password account store", () => {
        const hostedSessionService = new HostedSessionService({
            secret: "agent-hosted-secret",
            now: () => 1_000,
        });
        const sessionToken = hostedSessionService.issue({
            kind: "agent",
            principalId: "principal-77",
            worldId: "toonscape",
            worldCharacterId: "toon-77",
            displayName: "Toon Agent",
            agentId: "agent-77",
            issuedAt: 1_000,
            expiresAt: 11_000,
        });

        const player = {
            id: 77,
            name: "",
            tileX: 3200,
            tileY: 3200,
            level: 0,
            account: {},
        } as unknown as PlayerState;
        let accountStoreCalls = 0;

        const factory = new AgentPlayerFactory({
            players: () =>
                ({
                    hasConnectedPlayer: () => false,
                    addBot: () => player,
                }) as any,
            worldId: "toonscape",
            gamemode: {
                getSpawnLocation: () => ({ x: 3200, y: 3200, level: 0 }),
            } as any,
            accountStore: {
                verifyOrRegister: () => {
                    accountStoreCalls += 1;
                    throw new Error("password auth should not run in hosted mode");
                },
            } as any,
            playerPersistence: {
                applyToPlayer: () => {},
                hasKey: () => false,
                saveSnapshot: () => {},
                savePlayers: () => {},
            },
            hostedSessionService,
        });

        const result = factory.spawn({
            agentId: "agent-77",
            displayName: "wrong-name",
            sessionToken,
            worldCharacterId: "toon-77",
            controller: "hybrid",
        });

        expect(result).toMatchObject({
            ok: true,
            created: false,
            saveKey: "world:toonscape:character:toon-77",
        });
        expect(accountStoreCalls).toBe(0);
        expect(player.name).toBe("toon agent");
        expect(player.__saveKey).toBe("world:toonscape:character:toon-77");
    });
});
