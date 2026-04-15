import { describe, expect, test } from "bun:test";

import { HostedSessionService } from "../server/src/auth/HostedSessionService";
import { LoginHandshakeService } from "../server/src/network/LoginHandshakeService";
import { AgentPlayerFactory } from "../server/src/network/botsdk/AgentPlayerFactory";

describe("hosted auth flows", () => {
    test("human login accepts a hosted session token and stores pending world identity", () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "human-secret",
            now: () => now,
        });
        const token = hostedSessionService.issue({
            kind: "human",
            principalId: "principal:alice",
            worldId: "toonscape",
            worldCharacterId: "char-7",
            displayName: "Alice",
            issuedAt: now,
            expiresAt: now + 60_000,
        });

        const sent: Array<{ context: string; message: string | Uint8Array }> = [];
        const fakeWs = {} as never;
        const service = new LoginHandshakeService({
            worldId: "toonscape",
            hostedSessionService,
            cacheEnv: { info: { revision: 232 } },
            authService: {
                checkLoginRateLimit: () => false,
                isWorldFull: () => false,
                isPlayerAlreadyLoggedIn: () => false,
            },
            accountStore: {
                verifyOrRegister() {
                    throw new Error("password auth should not run in hosted mode");
                },
            },
            networkLayer: {
                withDirectSendBypass(_context: string, fn: () => void) {
                    fn();
                },
                sendWithGuard(_ws: unknown, message: string | Uint8Array, context: string) {
                    sent.push({ context, message });
                },
            },
            maintenanceMode: false,
        } as never);

        service.handleLoginMessage(fakeWs, {
            revision: 232,
            sessionToken: token,
            worldCharacterId: "char-7",
        });

        expect(sent).toHaveLength(1);
        expect(sent[0]?.context).toBe("login_response");
        expect(service.consumePendingLoginState(fakeWs)).toEqual({
            displayName: "Alice",
            principalId: "principal:alice",
            worldId: "toonscape",
            worldCharacterId: "char-7",
        });
    });

    test("agent spawn accepts hosted sessions without touching the password account store", async () => {
        const now = 1_700_000_000_000;
        const hostedSessionService = new HostedSessionService({
            secret: "agent-secret",
            now: () => now,
        });
        const token = hostedSessionService.issue({
            kind: "agent",
            principalId: "principal:agent-77",
            worldId: "toonscape",
            worldCharacterId: "toon-77",
            displayName: "Toon Agent",
            agentId: "agent-77",
            issuedAt: now,
            expiresAt: now + 60_000,
        });

        const player = {
            id: 77,
            tileX: 3200,
            tileY: 3200,
            level: 0,
            account: {},
        } as any;
        const applyCalls: string[] = [];
        const factory = new AgentPlayerFactory({
            players: () =>
                ({
                    hasConnectedPlayer: () => false,
                    addBot: () => player,
                }) as never,
            worldId: "toonscape",
            gamemode: {
                getSpawnLocation: () => ({ x: 3200, y: 3200, level: 0 }),
            } as never,
            accountStore: {
                verifyOrRegister() {
                    throw new Error("password auth should not run in hosted mode");
                },
            } as never,
            playerPersistence: {
                applyToPlayer(_player: unknown, key: string) {
                    applyCalls.push(key);
                },
                hasKey() {
                    return false;
                },
                saveSnapshot() {},
                savePlayers() {},
            },
            hostedSessionService,
        });

        const result = await factory.spawn({
            agentId: "agent-77",
            sessionToken: token,
            worldCharacterId: "toon-77",
            controller: "hybrid",
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.saveKey).toBe("world:toonscape:character:toon-77");
            expect(result.created).toBe(false);
        }
        expect(applyCalls).toEqual(["world:toonscape:character:toon-77"]);
        expect(player.name).toBe("toon agent");
        expect(player.account.accountStage).toBe(0);
        expect(player.agent?.identity.agentId).toBe("agent-77");
    });
});
