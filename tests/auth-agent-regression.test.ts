import { afterEach, describe, expect, test } from "bun:test";
import { decode, encode } from "@toon-format/toon";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonAccountStore } from "../server/src/game/state/AccountStore";
import { LoginHandshakeService } from "../server/src/network/LoginHandshakeService";
import { AgentPlayerFactory } from "../server/src/network/botsdk/AgentPlayerFactory";
import { BotSdkServer } from "../server/src/network/botsdk/BotSdkServer";
import { decodeServerPacket } from "../src/network/packet/ServerBinaryDecoder";

function makeTempDir(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

const tempDirs = new Set<string>();

afterEach(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.clear();
});

function createAccountStore(minPasswordLength: number = 8): {
    store: JsonAccountStore;
    accountsPath: string;
} {
    const dir = makeTempDir("xrsps-auth-");
    tempDirs.add(dir);
    const accountsPath = join(dir, "accounts.json");
    const store = new JsonAccountStore({ filePath: accountsPath, minPasswordLength });
    return { store, accountsPath };
}

function decodeSingleServerPacket(message: Uint8Array | string) {
    expect(message).toBeInstanceOf(Uint8Array);
    const decoded = decodeServerPacket(message as Uint8Array);
    expect(decoded).not.toBeNull();
    return decoded!;
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function createLoginHarness(accountStore: JsonAccountStore) {
    const sent: Array<{ context: string; message: Uint8Array | string }> = [];
    const svc = {
        networkLayer: {
            withDirectSendBypass: (_context: string, fn: () => void) => fn(),
            sendWithGuard: (_ws: unknown, message: Uint8Array | string, context: string) => {
                sent.push({ context, message });
            },
        },
        authService: {
            checkLoginRateLimit: () => false,
            isWorldFull: () => false,
            isPlayerAlreadyLoggedIn: () => false,
        },
        accountStore,
        cacheEnv: { info: { revision: 232 } },
        maintenanceMode: false,
    };
    return {
        service: new LoginHandshakeService(svc as any),
        sent,
    };
}

function createStubPlayer() {
    return {
        id: 41,
        name: "",
        tileX: 3200,
        tileY: 3200,
        level: 0,
        account: {
            accountStage: Number.NaN,
        },
        __saveKey: undefined as string | undefined,
        agent: undefined as unknown,
    };
}

describe("LoginHandshakeService.handleLoginMessage", () => {
    test("auto-registers a new human account and returns a success login_response", () => {
        const { store, accountsPath } = createAccountStore();
        const { service, sent } = createLoginHarness(store);
        const ws = { _socket: { remoteAddress: "127.0.0.1" } } as any;

        service.handleLoginMessage(ws, {
            username: "Alice",
            password: "hunter22",
            revision: 232,
        });

        expect(sent).toHaveLength(1);
        expect(sent[0]!.context).toBe("login_response");
        expect(decodeSingleServerPacket(sent[0]!.message)).toMatchObject({
            type: "login_response",
            payload: {
                success: true,
                displayName: "Alice",
            },
        });
        expect(service.consumePendingLoginState(ws)).toMatchObject({
            displayName: "Alice",
        });
        expect(store.exists("alice")).toBe(true);

        const persisted = JSON.parse(readFileSync(accountsPath, "utf-8")) as Record<string, unknown>;
        expect(Object.keys(persisted)).toEqual(["alice"]);
    });

    test("rejects a wrong password with the generic invalid-credentials response", () => {
        const { store } = createAccountStore();
        const { service, sent } = createLoginHarness(store);
        const ws = { _socket: { remoteAddress: "127.0.0.1" } } as any;

        expect(store.verifyOrRegister("alice", "hunter22")).toMatchObject({
            kind: "ok",
            created: true,
        });

        service.handleLoginMessage(ws, {
            username: "Alice",
            password: "wrong-password",
            revision: 232,
        });

        expect(sent).toHaveLength(1);
        expect(decodeSingleServerPacket(sent[0]!.message)).toMatchObject({
            type: "login_response",
            payload: {
                success: false,
                errorCode: 3,
                error: "Invalid username or password.",
            },
        });
        expect(service.consumePendingLoginState(ws)).toBeUndefined();
    });

    test("rejects a short first-login password without creating the account", () => {
        const { store } = createAccountStore(8);
        const { service, sent } = createLoginHarness(store);
        const ws = { _socket: { remoteAddress: "127.0.0.1" } } as any;

        service.handleLoginMessage(ws, {
            username: "Shorty",
            password: "short",
            revision: 232,
        });

        expect(sent).toHaveLength(1);
        expect(decodeSingleServerPacket(sent[0]!.message)).toMatchObject({
            type: "login_response",
            payload: {
                success: false,
                errorCode: 3,
                error: "Password must be at least 8 characters.",
            },
        });
        expect(store.exists("shorty")).toBe(false);
    });
});

describe("AgentPlayerFactory.spawn", () => {
    test("creates a new agent account, attaches the agent component, and marks fresh saves as accountStage=0", async () => {
        const { store } = createAccountStore();
        const player = createStubPlayer();
        const appliedKeys: string[] = [];
        const persistence = {
            applyToPlayer: (_player: unknown, key: string) => {
                appliedKeys.push(key);
            },
            hasKey: () => false,
            saveSnapshot: () => {},
            savePlayers: () => {},
        };
        const players = {
            hasConnectedPlayer: () => false,
            addBot: () => player,
            removeBot: () => {},
        };
        const factory = new AgentPlayerFactory({
            players: () => players as any,
            worldId: "default",
            gamemode: {
                getSpawnLocation: () => ({ x: 3200, y: 3201, level: 0 }),
            } as any,
            accountStore: store,
            playerPersistence: persistence as any,
        });

        const result = await factory.spawn({
            agentId: "agent-1",
            displayName: "Scout",
            password: "hunter22",
            controller: "hybrid",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.created).toBe(true);
        expect(result.saveKey).toBe("world:default:name:scout");
        expect(appliedKeys).toEqual(["world:default:name:scout"]);
        expect(player.name).toBe("scout");
        expect(player.__saveKey).toBe("world:default:name:scout");
        expect(player.account.accountStage).toBe(0);
        expect((player.agent as any)?.identity).toMatchObject({
            agentId: "agent-1",
            displayName: "scout",
            controller: "hybrid",
        });
    });

    test("restores an existing agent save and preserves a persisted account stage", async () => {
        const { store } = createAccountStore();
        expect(store.verifyOrRegister("scout", "hunter22")).toMatchObject({
            kind: "ok",
            created: true,
        });

        const player = createStubPlayer();
        const persistence = {
            applyToPlayer: (target: typeof player, key: string) => {
                expect(key).toBe("world:default:name:scout");
                target.account.accountStage = 2;
                target.tileX = 3212;
                target.tileY = 3214;
            },
            hasKey: () => true,
            saveSnapshot: () => {},
            savePlayers: () => {},
        };
        const players = {
            hasConnectedPlayer: () => false,
            addBot: () => player,
            removeBot: () => {},
        };
        const factory = new AgentPlayerFactory({
            players: () => players as any,
            worldId: "default",
            gamemode: {
                getSpawnLocation: () => ({ x: 3200, y: 3201, level: 0 }),
            } as any,
            accountStore: store,
            playerPersistence: persistence as any,
        });

        const result = await factory.spawn({
            agentId: "agent-2",
            displayName: "Scout",
            password: "hunter22",
            controller: "llm",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.created).toBe(false);
        expect(player.account.accountStage).toBe(2);
        expect(player.tileX).toBe(3212);
        expect(player.tileY).toBe(3214);
    });
});

describe("BotSdkServer message contract", () => {
    test("rejects spawn frames before auth with the unauth error", () => {
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
                serverName: "Local Development",
                standalone: false,
            },
            {
                factory: {
                    spawn: () => {
                        throw new Error("spawn should not run before auth");
                    },
                } as any,
                router: { dispatch: () => ({ success: true }) } as any,
                hookTicker: () => {},
                playerPersistence: {
                    applyToPlayer: () => {},
                    hasKey: () => false,
                    saveSnapshot: () => {},
                    savePlayers: () => {},
                } as any,
            },
        );
        const sent: string[] = [];
        const closed: Array<{ code: number; reason: string }> = [];
        const ws = {
            readyState: 1,
            send: (frame: string) => sent.push(frame),
            close: (code: number, reason: string) => closed.push({ code, reason }),
        } as any;

        (server as any).handleMessage(
            ws,
            { authed: false },
            encode({
                kind: "spawn",
                agentId: "agent-1",
                displayName: "Scout",
                password: "hunter22",
            }),
        );

        expect(sent).toHaveLength(1);
        expect(decode(sent[0]!)).toMatchObject({
            kind: "error",
            code: "unauth",
            message: "first frame must be `auth`",
        });
        expect(closed).toEqual([{ code: 1008, reason: "unauth" }]);
    });

    test("authenticates with BOT_SDK_TOKEN and returns spawnOk for a valid spawn", async () => {
        const spawnCalls: Array<Record<string, unknown>> = [];
        const server = new BotSdkServer(
            {
                host: "127.0.0.1",
                port: 0,
                token: "secret",
                serverName: "Local Development",
                standalone: false,
            },
            {
                factory: {
                    spawn: (request: Record<string, unknown>) => {
                        spawnCalls.push(request);
                        return {
                            ok: true,
                            created: true,
                            saveKey: "scout",
                            player: {
                                id: 77,
                                name: "scout",
                                tileX: 3210,
                                tileY: 3211,
                                level: 0,
                                agent: { identity: { agentId: "agent-1" } },
                            },
                        };
                    },
                } as any,
                router: { dispatch: () => ({ success: true }) } as any,
                hookTicker: () => {},
                playerPersistence: {
                    applyToPlayer: () => {},
                    hasKey: () => false,
                    saveSnapshot: () => {},
                    savePlayers: () => {},
                } as any,
            },
        );
        const sent: string[] = [];
        const ws = {
            readyState: 1,
            send: (frame: string) => sent.push(frame),
            close: () => {},
        } as any;
        const state = { authed: false } as any;

        (server as any).handleMessage(
            ws,
            state,
            encode({
                kind: "auth",
                token: "secret",
            }),
        );
        (server as any).handleMessage(
            ws,
            state,
            encode({
                kind: "spawn",
                agentId: "agent-1",
                displayName: "Scout",
                password: "hunter22",
            }),
        );
        await flushMicrotasks();

        expect(sent).toHaveLength(2);
        expect(decode(sent[0]!)).toMatchObject({
            kind: "authOk",
            server: "Local Development",
            version: 1,
        });
        expect(spawnCalls).toHaveLength(1);
        expect(spawnCalls[0]).toMatchObject({
            agentId: "agent-1",
            displayName: "Scout",
            password: "hunter22",
            controller: "hybrid",
        });
        expect(decode(sent[1]!)).toMatchObject({
            kind: "spawnOk",
            playerId: 77,
            x: 3210,
            z: 3211,
            level: 0,
        });
    });
});
