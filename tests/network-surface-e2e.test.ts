import { afterEach, describe, expect, test } from "bun:test";
import { decode, encode } from "@toon-format/toon";
import http from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket as WsClient, WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";

import { HostedSessionIssuerService } from "../server/src/auth/HostedSessionIssuerService";
import { HostedSessionService } from "../server/src/auth/HostedSessionService";
import { JsonAccountStore } from "../server/src/game/state/AccountStore";
import { LoginHandshakeService } from "../server/src/network/LoginHandshakeService";
import { buildServerStatus } from "../server/src/network/ServerStatus";
import { buildWorldDirectory } from "../server/src/network/WorldDirectory";
import { AgentPlayerFactory } from "../server/src/network/botsdk/AgentPlayerFactory";
import { BotSdkServer } from "../server/src/network/botsdk/BotSdkServer";
import { decodeServerPacket } from "../src/network/packet/ServerBinaryDecoder";
import { encodeClientMessage } from "../src/network/packet/ClientBinaryEncoder";

const NOW = 1_700_000_000_000;
const tempDirs = new Set<string>();

afterEach(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.clear();
});

function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.add(dir);
    return dir;
}

function rawToText(data: unknown): string {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString("utf-8");
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
    if (Array.isArray(data)) {
        return Buffer.concat(data.map((chunk) => Buffer.from(chunk))).toString("utf-8");
    }
    return Buffer.from(data as Uint8Array).toString("utf-8");
}

function rawToBytes(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (Buffer.isBuffer(data)) return new Uint8Array(data);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) {
        return new Uint8Array(Buffer.concat(data.map((chunk) => Buffer.from(chunk))));
    }
    throw new Error(`Unsupported raw payload: ${typeof data}`);
}

function decodeServerBinaryMessage(data: unknown) {
    const decoded = decodeServerPacket(rawToBytes(data));
    expect(decoded).not.toBeNull();
    return decoded!;
}

function decodeBotSdkMessage(data: unknown, format: "json" | "toon") {
    const text = rawToText(data);
    return format === "json" ? JSON.parse(text) : decode(text);
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function waitForEventTurn(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

function waitForOpen(ws: WsClient): Promise<void> {
    if (ws.readyState === WsClient.OPEN) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const onOpen = () => {
            cleanup();
            resolve();
        };
        const onError = (error: unknown) => {
            cleanup();
            reject(error);
        };
        const cleanup = () => {
            ws.off("open", onOpen);
            ws.off("error", onError);
        };
        ws.on("open", onOpen);
        ws.on("error", onError);
    });
}

function nextMessage(ws: WsClient, timeoutMs: number = 2_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for WebSocket message."));
        }, timeoutMs);
        const onMessage = (data: unknown) => {
            cleanup();
            resolve(data);
        };
        const onError = (error: unknown) => {
            cleanup();
            reject(error);
        };
        const cleanup = () => {
            clearTimeout(timer);
            ws.off("message", onMessage);
            ws.off("error", onError);
        };
        ws.on("message", onMessage);
        ws.on("error", onError);
    });
}

function waitForClose(ws: WsClient, timeoutMs: number = 2_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for WebSocket close."));
        }, timeoutMs);
        const onClose = () => {
            cleanup();
            resolve();
        };
        const onError = (error: unknown) => {
            cleanup();
            reject(error);
        };
        const cleanup = () => {
            clearTimeout(timer);
            ws.off("close", onClose);
            ws.off("error", onError);
        };
        ws.on("close", onClose);
        ws.on("error", onError);
    });
}

function listen(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve((server.address() as AddressInfo).port);
        });
    });
}

function closeHttpServer(server: http.Server): Promise<void> {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

function closeWebSocketServer(server: WebSocketServer): Promise<void> {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf-8").trim();
    return raw.length > 0 ? JSON.parse(raw) : {};
}

function writeJson(
    res: http.ServerResponse,
    status: number,
    payload: unknown,
    headers: Record<string, string> = {},
): void {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...headers,
    });
    res.end(JSON.stringify(payload));
}

function createBotPlayer(id: number, x: number, y: number, level: number) {
    return {
        id,
        name: "",
        tileX: x,
        tileY: y,
        level,
        rot: 0,
        account: {
            accountStage: Number.NaN,
        },
        agent: undefined as unknown,
        __saveKey: undefined as string | undefined,
        __principalId: undefined as string | undefined,
        __worldCharacterId: undefined as string | undefined,
    };
}

function createBotPlayerManager() {
    let nextId = 1;
    const bots = new Map<number, ReturnType<typeof createBotPlayer>>();
    return {
        hasConnectedPlayer(name: string) {
            const normalized = name.trim().toLowerCase();
            for (const player of bots.values()) {
                if (player.name === normalized) {
                    return true;
                }
            }
            return false;
        },
        addBot(x: number, y: number, level: number) {
            const player = createBotPlayer(nextId++, x, y, level);
            bots.set(player.id, player);
            return player;
        },
        removeBot(player: ReturnType<typeof createBotPlayer>) {
            bots.delete(player.id);
        },
        count() {
            return bots.size;
        },
    };
}

async function createHarness() {
    const dir = makeTempDir("scape-network-e2e-");
    const accountsPath = join(dir, "accounts.json");
    const accountStore = new JsonAccountStore({
        filePath: accountsPath,
        minPasswordLength: 8,
    });
    const hostedSessionService = new HostedSessionService({
        secret: "hosted-secret",
        now: () => NOW,
    });
    const hostedSessionIssuer = new HostedSessionIssuerService({
        hostedSessionService,
        issuerSecret: "issuer-secret",
        worldId: "toonscape",
        worldName: "Toonscape",
        gamemodeId: "vanilla",
        now: () => NOW,
    });
    const players = createBotPlayerManager();
    const routerCalls: Array<{ playerId: number; action: string }> = [];
    const savedSnapshots: string[] = [];
    const appliedKeys: string[] = [];
    const playerPersistence = {
        warmKey: async () => {},
        applyToPlayer(_player: unknown, key: string) {
            appliedKeys.push(key);
        },
        hasKey() {
            return false;
        },
        saveSnapshot(key: string) {
            savedSnapshots.push(key);
        },
        savePlayers() {},
    };

    const factory = new AgentPlayerFactory({
        players: () => players as any,
        worldId: "toonscape",
        gamemode: {
            getSpawnLocation: () => ({ x: 3200, y: 3201, level: 0 }),
        } as any,
        accountStore,
        playerPersistence: playerPersistence as any,
        hostedSessionService,
    });
    const botSdkServer = new BotSdkServer(
        {
            host: "127.0.0.1",
            port: 0,
            token: "bot-secret",
            serverName: "Toonscape",
            worldId: "toonscape",
        },
        {
            factory,
            router: {
                dispatch(playerId: number, frame: { action: string }) {
                    routerCalls.push({ playerId, action: frame.action });
                    return {
                        success: true,
                        message: `handled ${frame.action}`,
                    };
                },
            } as any,
            playerPersistence: playerPersistence as any,
            hookTicker() {},
        },
    );
    botSdkServer.start();

    const loginSvc: Record<string, unknown> = {
        worldId: "toonscape",
        tickMs: 600,
        playerSyncSessions: new Map(),
        npcSyncSessions: new Map(),
        hostedSessionService,
        authService: {
            checkLoginRateLimit: () => false,
            isWorldFull: () => false,
            isPlayerAlreadyLoggedIn: () => false,
        },
        accountStore,
        cacheEnv: { info: { revision: 232 } },
        maintenanceMode: false,
        networkLayer: {
            withDirectSendBypass(_context: string, fn: () => void) {
                fn();
            },
            sendWithGuard(
                ws: WsClient,
                message: string | Uint8Array,
                _context: string,
            ) {
                ws.send(message);
            },
        },
    };
    const loginHandshakeService = new LoginHandshakeService(loginSvc as any);
    loginSvc.messageRouter = {
        dispatch(ws: WsClient, decoded: { type: string; payload?: unknown }) {
            if (decoded.type === "login") {
                loginHandshakeService.handleLoginMessage(ws as any, decoded.payload as any);
                return true;
            }
            return false;
        },
    };

    const mainWss = new WebSocketServer({ noServer: true });
    mainWss.on("connection", (ws) => loginHandshakeService.onConnection(ws));

    const httpServer = http.createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/status") {
            writeJson(
                res,
                200,
                buildServerStatus({
                    serverName: "Toonscape",
                    playerCount: players.count(),
                    maxPlayers: 2047,
                    runtimeMode: "development",
                }),
                { "Cache-Control": "no-store, no-cache, must-revalidate" },
            );
            return;
        }
        if (
            req.method === "GET" &&
            (url.pathname === "/worlds" || url.pathname === "/servers.json")
        ) {
            writeJson(
                res,
                200,
                buildWorldDirectory({
                    serverName: "Toonscape",
                    maxPlayers: 2047,
                    playerCount: players.count(),
                    hostHeader: req.headers.host,
                    forwardedProto: "http",
                }),
                { "Cache-Control": "no-store, no-cache, must-revalidate" },
            );
            return;
        }
        if (url.pathname === "/hosted-session/issue") {
            if (req.method === "OPTIONS") {
                writeJson(res, 204, {}, {
                    "Access-Control-Allow-Headers": "Authorization, Content-Type",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                });
                return;
            }
            if (req.method !== "POST") {
                writeJson(res, 405, {
                    code: "method_not_allowed",
                    error: "Use POST for hosted session issuing.",
                });
                return;
            }
            void readJsonBody(req)
                .then((body) =>
                    hostedSessionIssuer.issue(
                        typeof req.headers.authorization === "string"
                            ? req.headers.authorization
                            : undefined,
                        body,
                    ),
                )
                .then((result) =>
                    writeJson(res, result.status, result.payload, {
                        "Access-Control-Allow-Headers": "Authorization, Content-Type",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                    }),
                )
                .catch(() =>
                    writeJson(res, 500, {
                        code: "issuer_error",
                        error: "Hosted session issuing failed.",
                    }),
                );
            return;
        }

        res.writeHead(404);
        res.end();
    });

    httpServer.on("upgrade", (req, socket, head) => {
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        if (pathname === "/botsdk") {
            if (!botSdkServer.canAcceptUpgrade()) {
                socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
                socket.destroy();
                return;
            }
            botSdkServer.handleUpgrade(req, socket, head);
            return;
        }
        if (pathname === "/") {
            mainWss.handleUpgrade(req, socket, head, (ws) => {
                mainWss.emit("connection", ws, req);
            });
            return;
        }
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
    });

    const port = await listen(httpServer);

    return {
        accountStore,
        accountsPath,
        appliedKeys,
        hostedSessionService,
        routerCalls,
        savedSnapshots,
        async close() {
            botSdkServer.stop();
            for (const client of mainWss.clients) {
                client.close();
            }
            await closeWebSocketServer(mainWss);
            httpServer.closeAllConnections?.();
            await closeHttpServer(httpServer);
        },
        httpBaseUrl: `http://127.0.0.1:${port}`,
        wsBaseUrl: `ws://127.0.0.1:${port}`,
        players,
    };
}

describe("network surface e2e", () => {
    test("serves live status and world directory endpoints", async () => {
        const harness = await createHarness();
        try {
            const status = await fetch(`${harness.httpBaseUrl}/status`).then((res) =>
                res.json(),
            );
            expect(status).toEqual({
                serverName: "Toonscape",
                playerCount: 0,
                maxPlayers: 2047,
                runtimeMode: "development",
            });

            const worlds = await fetch(`${harness.httpBaseUrl}/worlds`).then((res) =>
                res.json(),
            );
            expect(worlds).toHaveLength(1);
            expect(worlds[0]).toMatchObject({
                id: 1,
                name: "Toonscape",
                secure: false,
                playerCount: 0,
            });

            const servers = await fetch(`${harness.httpBaseUrl}/servers.json`).then((res) =>
                res.json(),
            );
            expect(servers).toEqual(worlds);
        } finally {
            await harness.close();
        }
    });

    test("issues hosted sessions over the live HTTP endpoint", async () => {
        const harness = await createHarness();
        try {
            const issueText = await fetch(`${harness.httpBaseUrl}/hosted-session/issue`, {
                method: "POST",
                headers: {
                    Authorization: "Bearer issuer-secret",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    kind: "human",
                    principalId: "principal:alice",
                    worldId: "toonscape",
                    worldCharacterId: "char-1",
                    displayName: "Alice",
                }),
            }).then((res) => res.text());

            expect(issueText).toContain('"sessionToken":"hs1.');
            expect(issueText).toContain('"worldCharacterId":"char-1"');
            expect(issueText).toContain('"displayName":"Alice"');
        } finally {
            await harness.close();
        }
    });

    test("accepts password logins over the live main websocket and auto-registers accounts", async () => {
        const harness = await createHarness();
        const ws = new WsClient(`${harness.wsBaseUrl}/`);
        try {
            await waitForOpen(ws);
            expect(decodeServerBinaryMessage(await nextMessage(ws))).toMatchObject({
                type: "welcome",
                payload: { tickMs: 600 },
            });

            ws.send(
                encodeClientMessage({
                    type: "login",
                    payload: {
                        username: "Alice",
                        password: "hunter22",
                        revision: 232,
                    },
                }),
            );

            expect(decodeServerBinaryMessage(await nextMessage(ws))).toMatchObject({
                type: "login_response",
                payload: {
                    success: true,
                    displayName: "Alice",
                },
            });
            expect(harness.accountStore.exists("alice")).toBe(true);
        } finally {
            ws.close();
            await harness.close();
        }
    });

    test("issues hosted human sessions and accepts them over the live main websocket", async () => {
        const harness = await createHarness();
        const sessionToken = harness.hostedSessionService.issue({
            kind: "human",
            principalId: "principal:alice",
            worldId: "toonscape",
            worldCharacterId: "char-1",
            displayName: "Alice",
            issuedAt: NOW,
            expiresAt: NOW + 60_000,
        });
        const ws = new WsClient(`${harness.wsBaseUrl}/`);
        try {
            expect(sessionToken.startsWith("hs1.")).toBe(true);

            await waitForOpen(ws);
            expect(decodeServerBinaryMessage(await nextMessage(ws))).toMatchObject({
                type: "welcome",
            });

            ws.send(
                encodeClientMessage({
                    type: "login",
                    payload: {
                        username: "",
                        password: "",
                        revision: 232,
                        sessionToken,
                        worldCharacterId: "char-1",
                    },
                }),
            );

            expect(decodeServerBinaryMessage(await nextMessage(ws))).toMatchObject({
                type: "login_response",
                payload: {
                    success: true,
                    displayName: "Alice",
                },
            });
        } finally {
            ws.close();
            await harness.close();
        }
    });

    test("accepts generic JSON agent clients using type-based auth, signup, and action frames", async () => {
        const harness = await createHarness();
        const ws = new WsClient(`${harness.wsBaseUrl}/botsdk`);
        try {
            await waitForOpen(ws);

            ws.send(JSON.stringify({ type: "auth", token: "bot-secret" }));
            expect(decodeBotSdkMessage(await nextMessage(ws), "json")).toMatchObject({
                kind: "authOk",
                server: "Toonscape",
                version: 1,
            });

            ws.send(
                JSON.stringify({
                    type: "spawn",
                    agentId: "agent-json-1",
                    displayName: "Scout",
                    password: "hunter22",
                    controller: "hybrid",
                }),
            );
            const spawn = decodeBotSdkMessage(await nextMessage(ws), "json");
            expect(spawn).toMatchObject({
                kind: "spawnOk",
                playerId: expect.any(Number),
                x: 3200,
                z: 3201,
                level: 0,
            });

            ws.send(
                JSON.stringify({
                    type: "action",
                    action: "chatPublic",
                    text: "hello world",
                    correlationId: "act-1",
                }),
            );
            expect(decodeBotSdkMessage(await nextMessage(ws), "json")).toEqual({
                kind: "ack",
                correlationId: "act-1",
                success: true,
                message: "handled chatPublic",
            });

            expect(harness.accountStore.exists("scout")).toBe(true);
            expect(harness.appliedKeys).toContain("world:toonscape:name:scout");
            expect(harness.routerCalls).toContainEqual({
                playerId: spawn.playerId,
                action: "chatPublic",
            });

            ws.send(JSON.stringify({ type: "disconnect", reason: "done" }));
            await waitForClose(ws);
            await flushMicrotasks();
            await waitForEventTurn();

            expect(harness.savedSnapshots).toContain("world:toonscape:name:scout");
            expect(harness.players.count()).toBe(0);
            const persistedAccounts = JSON.parse(
                readFileSync(harness.accountsPath, "utf-8"),
            ) as Record<string, unknown>;
            expect(Object.keys(persistedAccounts)).toContain("scout");
        } finally {
            if (ws.readyState === WsClient.OPEN || ws.readyState === WsClient.CONNECTING) {
                ws.close();
            }
            await harness.close();
        }
    });

    test("accepts hosted agent sessions over JSON and persists them by worldCharacterId", async () => {
        const harness = await createHarness();
        const sessionToken = harness.hostedSessionService.issue({
            kind: "agent",
            principalId: "principal:agent-77",
            worldId: "toonscape",
            worldCharacterId: "toon-77",
            displayName: "Toon Agent",
            agentId: "agent-77",
            issuedAt: NOW,
            expiresAt: NOW + 60_000,
        });
        const ws = new WsClient(`${harness.wsBaseUrl}/botsdk`);
        try {
            expect(sessionToken.startsWith("hs1.")).toBe(true);

            await waitForOpen(ws);
            ws.send(JSON.stringify({ type: "auth", token: "bot-secret" }));
            expect(decodeBotSdkMessage(await nextMessage(ws), "json")).toMatchObject({
                kind: "authOk",
            });

            ws.send(
                JSON.stringify({
                    type: "spawn",
                    agentId: "agent-77",
                    sessionToken,
                    worldCharacterId: "toon-77",
                    controller: "llm",
                }),
            );
            const spawn = decodeBotSdkMessage(await nextMessage(ws), "json");
            expect(spawn).toMatchObject({
                kind: "spawnOk",
                playerId: expect.any(Number),
            });
            expect(harness.appliedKeys).toContain(
                "world:toonscape:character:toon-77",
            );

            ws.send(
                JSON.stringify({
                    type: "action",
                    action: "walkTo",
                    x: 3202,
                    z: 3202,
                    correlationId: "act-2",
                }),
            );
            expect(decodeBotSdkMessage(await nextMessage(ws), "json")).toEqual({
                kind: "ack",
                correlationId: "act-2",
                success: true,
                message: "handled walkTo",
            });

            ws.send(JSON.stringify({ type: "disconnect", reason: "done" }));
            await waitForClose(ws);
            await flushMicrotasks();
            await waitForEventTurn();
            expect(harness.savedSnapshots).toContain(
                "world:toonscape:character:toon-77",
            );
        } finally {
            if (ws.readyState === WsClient.OPEN || ws.readyState === WsClient.CONNECTING) {
                ws.close();
            }
            await harness.close();
        }
    });

    test("preserves legacy TOON bot-sdk clients over the live websocket", async () => {
        const harness = await createHarness();
        const ws = new WsClient(`${harness.wsBaseUrl}/botsdk`);
        try {
            await waitForOpen(ws);
            ws.send(encode({ kind: "auth", token: "bot-secret" }));
            expect(decodeBotSdkMessage(await nextMessage(ws), "toon")).toMatchObject({
                kind: "authOk",
                server: "Toonscape",
            });

            ws.send(
                encode({
                    kind: "spawn",
                    agentId: "agent-toon-1",
                    displayName: "Legacy",
                    password: "hunter22",
                    controller: "hybrid",
                }),
            );
            expect(decodeBotSdkMessage(await nextMessage(ws), "toon")).toMatchObject({
                kind: "spawnOk",
                x: 3200,
                z: 3201,
            });
        } finally {
            ws.close();
            await harness.close();
        }
    });
});
