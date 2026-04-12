/**
 * BotSdkServer — the WebSocket endpoint agents connect to.
 *
 * By default this attaches to the main game HTTP server at `/botsdk`, which
 * keeps agent traffic behind the same single-port ingress as the human client.
 * Standalone mode still exists for local-only scenarios, but the shared route
 * is the production topology. Clients connect, authenticate with
 * `BOT_SDK_TOKEN`, send a `spawn` frame to create an agent-player, then
 * stream action frames for the rest of the session. The server pushes bounded
 * perception snapshots back on a timer driven by {@link BotSdkPerceptionEmitter}.
 *
 * **Scope boundary**: the server is pure networking + frame routing. It does
 * NOT contain any game logic. All decisions about "what happens when an
 * agent walks" are delegated to the existing services via
 * {@link BotSdkActionRouter}.
 *
 * **Disabled by default**: if `BOT_SDK_TOKEN` is unset, the server refuses
 * to start. This means casual deployments that don't need agents don't
 * inadvertently expose an additional unauthenticated endpoint.
 */

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

import type { PlayerState } from "../../game/player";
import type { PersistenceProvider } from "../../game/state/PersistenceProvider";
import type { ServerServices } from "../../game/ServerServices";
import { logger } from "../../utils/logger";

import { AgentPlayerFactory } from "./AgentPlayerFactory";
import {
    BotSdkActionRouter,
    type ActionDispatchResult,
} from "./BotSdkActionRouter";
import {
    decodeClientFrame,
    encodeServerFrame,
} from "./BotSdkCodec";
import type {
    AnyActionFrame,
    BotSdkFeature,
    ClientFrame,
    ServerFrame,
    SpawnFrame,
} from "./BotSdkProtocol";
import { BotSdkLiveEventRelay } from "./BotSdkLiveEventRelay";
import { BotSdkPerceptionEmitter } from "./BotSdkPerceptionEmitter";
import { BotSdkPerceptionBuilder } from "./BotSdkPerceptionBuilder";
import { BotSdkRecentEventStore } from "./BotSdkRecentEventStore";
import {
    BotSdkTrajectoryRecorder,
    JsonlBotSdkTrajectorySink,
} from "./BotSdkTrajectoryRecorder";

export interface BotSdkServerOptions {
    host: string;
    port: number;
    /** Shared secret. If empty/undefined the server refuses to start. */
    token: string;
    /** Display name shown in the `authOk` frame. Defaults to "xrsps". */
    serverName?: string;
    /** Perception emission cadence; default 3 game ticks. */
    perceptionEveryNTicks?: number;
    /**
     * When true, open a dedicated WebSocketServer on `{host, port}` —
     * the legacy behavior. When false (default), run in `noServer: true`
     * mode and expect the main HTTP server to route `/botsdk` upgrades
     * into {@link BotSdkServer.handleUpgrade}. The shared-HTTP path is
     * the only one that works behind Sevalla's single-port ingress, so
     * it's the default. Standalone is kept for local CLI / test
     * scenarios that don't want to boot the whole WSServer.
     */
    standalone?: boolean;
    worldId?: string;
    trajectoryLogPath?: string;
}

export interface BotSdkServerDeps {
    factory: AgentPlayerFactory;
    router: BotSdkActionRouter;
    services: () => ServerServices;
    /** Called on every game tick so the emitter can run. */
    hookTicker: (cb: (tick: number) => void) => void;
    /**
     * Same persistence layer humans use. The server calls `saveSnapshot`
     * on disconnect so agents retain their game state across sessions.
     */
    playerPersistence: PersistenceProvider;
}

interface AgentSession {
    ws: WebSocket;
    player: PlayerState;
    authedAt: number;
    saveKey: string;
    features: Set<BotSdkFeature>;
}

const PROTOCOL_VERSION = 1;

export class BotSdkServer {
    private wss: WebSocketServer | null = null;
    private readonly sessions = new Map<WebSocket, AgentSession>();
    private emitter: BotSdkPerceptionEmitter | null = null;
    private recentEvents: BotSdkRecentEventStore | null = null;
    private liveEvents: BotSdkLiveEventRelay | null = null;
    private trajectoryRecorder: BotSdkTrajectoryRecorder | null = null;

    constructor(
        private readonly options: BotSdkServerOptions,
        private readonly deps: BotSdkServerDeps,
    ) {}

    /**
     * Bring the endpoint up. Must be called after the rest of the server
     * is wired, because the action router needs a live `PlayerManager`.
     * No-op (with a warning) if `BOT_SDK_TOKEN` is empty.
     *
     * In the shared-HTTP-server topology the BotSdkServer does NOT open
     * its own port — instead it creates a {@link WebSocketServer} in
     * `noServer: true` mode that the main wsServer routes `/botsdk`
     * upgrades into via {@link handleUpgrade}. Set `BOT_SDK_PORT=0`
     * (or just don't set it; the main server ignores it in shared mode)
     * to use that path. To retain the legacy standalone behavior
     * (separate port), pass a nonzero `options.port` AND set
     * `options.standalone === true`.
     */
    start(): void {
        if (!this.options.token || this.options.token.length === 0) {
            logger.info(
                "[botsdk] disabled — BOT_SDK_TOKEN not set. Agents cannot connect.",
            );
            return;
        }

        if (this.options.standalone) {
            // Legacy mode: open our own port. Useful for local dev
            // and tests that don't want to wire up the shared HTTP
            // server.
            this.wss = new WebSocketServer({
                host: this.options.host,
                port: this.options.port,
            });
            this.wss.on("listening", () => {
                logger.info(
                    `[botsdk] (standalone) listening on ws://${this.options.host}:${this.options.port} (token=set)`,
                );
            });
            this.wss.on("error", (err) => {
                logger.error("[botsdk] server error:", err);
            });
            this.wss.on("connection", (ws) => this.handleConnection(ws));
        } else {
            // Shared-HTTP mode: create the WSS with no listener of its
            // own. The main wsServer calls handleUpgrade() when a
            // `/botsdk` upgrade request lands. We still own the
            // connection lifecycle after handoff.
            this.wss = new WebSocketServer({ noServer: true });
            this.wss.on("connection", (ws) => this.handleConnection(ws));
            this.wss.on("error", (err) => {
                logger.error("[botsdk] server error:", err);
            });
            logger.info(
                `[botsdk] attached to main HTTP server at path /botsdk (token=set)`,
            );
        }

        this.recentEvents = new BotSdkRecentEventStore({
            services: this.deps.services,
        });
        this.liveEvents = new BotSdkLiveEventRelay(
            {
                services: this.deps.services,
            },
            (player, event) => {
                this.trajectoryRecorder?.recordWakeEvent(player, event);
                const session = this.findSessionByPlayer(player);
                if (!session || !session.features.has("liveEvents")) {
                    return;
                }
                this.sendFrame(session.ws, {
                    kind: "event",
                    event: event.event,
                    timestamp: event.timestamp,
                    playerId: event.playerId,
                    worldId: this.deps.services().worldId,
                    payload: event.payload,
                });
            },
        );
        if (this.options.trajectoryLogPath?.trim()) {
            this.trajectoryRecorder = new BotSdkTrajectoryRecorder({
                worldId: this.options.worldId ?? this.deps.services().worldId,
                sink: new JsonlBotSdkTrajectorySink(this.options.trajectoryLogPath.trim()),
            });
        }
        const builder = new BotSdkPerceptionBuilder({
            services: this.deps.services,
            recentEvents: this.recentEvents,
        });
        this.emitter = new BotSdkPerceptionEmitter(
            () => this.iterAgentPlayers(),
            (player, snapshot) => {
                const session = this.findSessionByPlayer(player);
                if (!session) return;
                this.sendFrame(session.ws, {
                    kind: "perception",
                    snapshot,
                });
            },
            builder,
            { everyNTicks: this.options.perceptionEveryNTicks },
        );
        this.deps.hookTicker((tick) => this.emitter?.onTick(tick));
    }

    /**
     * True when the server is ready to accept incoming upgrades at the
     * `/botsdk` path. False if BOT_SDK_TOKEN is unset (start() bailed)
     * or if start() hasn't been called yet. The main wsServer's upgrade
     * handler consults this before delegating to {@link handleUpgrade}.
     */
    canAcceptUpgrade(): boolean {
        return this.wss !== null && !this.options.standalone;
    }

    /**
     * Handle a WebSocket upgrade request routed from the main HTTP
     * server. Only valid in shared-HTTP mode (see {@link start}).
     */
    handleUpgrade(
        req: IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ): void {
        if (!this.wss) {
            try {
                socket.write(
                    "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
                );
                socket.destroy();
            } catch {}
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss!.emit("connection", ws, req);
        });
    }

    stop(): void {
        for (const session of this.sessions.values()) {
            try {
                session.ws.close(1001, "server_shutdown");
            } catch {
                // swallow — the socket may already be dead
            }
        }
        this.sessions.clear();
        this.wss?.close();
        this.wss = null;
        this.recentEvents?.dispose();
        this.recentEvents = null;
        this.liveEvents?.dispose();
        this.liveEvents = null;
        this.trajectoryRecorder?.dispose();
        this.trajectoryRecorder = null;
        this.emitter = null;
    }

    /**
     * Fan out an operator-steering command to every connected agent.
     *
     * Called from the chat handler when a human player sends
     * `::steer <text>`. The command becomes a server → client
     * `operatorCommand` frame that the plugin's BotSdk handles by
     * injecting the text into the next LLM prompt as the agent's
     * highest-priority directive.
     *
     * No-op if no agents are connected or if the endpoint is disabled.
     */
    broadcastOperatorCommand(
        source: "chat" | "admin",
        text: string,
        fromPlayerId?: number,
        fromPlayerName?: string,
    ): number {
        if (!this.wss) return 0;
        const trimmed = text.trim();
        const frame = {
            kind: "operatorCommand" as const,
            source,
            text: trimmed,
            timestamp: Date.now(),
            fromPlayerId,
            fromPlayerName,
        };
        let count = 0;
        for (const session of this.sessions.values()) {
            this.sendFrame(session.ws, frame);
            count += 1;
        }
        if (count > 0) {
            logger.info(
                `[botsdk] broadcast operator command → ${count} agent(s) source=${source} text="${trimmed.slice(0, 60)}"`,
            );
        }
        return count;
    }

    // ──────────────────────────────────────────────────────────────────
    // Connection handling
    // ──────────────────────────────────────────────────────────────────

    private handleConnection(ws: WebSocket): void {
        const sessionState: { authed: boolean; session?: AgentSession; features: Set<BotSdkFeature> } = {
            authed: false,
            features: new Set<BotSdkFeature>(),
        };

        ws.on("message", (data) => {
            const text =
                typeof data === "string"
                    ? data
                    : Buffer.isBuffer(data)
                        ? data.toString("utf-8")
                        : Buffer.from(data as ArrayBuffer).toString("utf-8");
            this.handleMessage(ws, sessionState, text);
        });

        ws.on("close", () => {
            const existing = this.sessions.get(ws);
            if (existing) {
                // 1. Persist the agent's game state so the next spawn resumes
                //    skills, inventory, position, etc. — same save path humans
                //    use during logout.
                try {
                    this.deps.playerPersistence.saveSnapshot(
                        existing.saveKey,
                        existing.player,
                    );
                    logger.info(
                        `[botsdk] saved state for agent ${existing.player.agent?.identity.agentId} (key=${existing.saveKey})`,
                    );
                } catch (err) {
                    logger.warn(
                        `[botsdk] failed to save state for agent ${existing.player.agent?.identity.agentId}`,
                        err,
                    );
                }

                // 2. Mark the component disconnected (perception emitter
                //    stops sending to this agent immediately).
                this.deps.factory.markDisconnected(existing.player);

                // 3. Remove the PlayerState from the world entirely so the
                //    agent's display name is freed for subsequent logins.
                //    The save file is the source of truth from here on.
                try {
                    this.deps.factory.destroy(existing.player);
                } catch (err) {
                    logger.warn(
                        `[botsdk] failed to destroy agent player ${existing.player.id}`,
                        err,
                    );
                }

                this.sessions.delete(ws);
                logger.info(
                    `[botsdk] session closed for player ${existing.player.id} (agent=${existing.player.agent?.identity.agentId})`,
                );
            }
        });

        ws.on("error", (err) => {
            logger.warn("[botsdk] socket error:", err);
        });
    }

    private handleMessage(
        ws: WebSocket,
        state: { authed: boolean; session?: AgentSession; features: Set<BotSdkFeature> },
        raw: string,
    ): void {
        const decoded = decodeClientFrame(raw);
        if (!decoded.ok) {
            this.sendError(ws, "bad_frame", decoded.error);
            return;
        }
        const frame: ClientFrame = decoded.value;

        // Auth must come first.
        if (!state.authed) {
            if (frame.kind !== "auth") {
                this.sendError(ws, "unauth", "first frame must be `auth`");
                ws.close(1008, "unauth");
                return;
            }
            if (frame.token !== this.options.token) {
                this.sendError(ws, "bad_token", "BOT_SDK_TOKEN mismatch");
                ws.close(1008, "bad_token");
                return;
            }
            state.features = new Set((frame.features ?? []).filter(this.isKnownFeature));
            state.authed = true;
            const supportedFeatures: BotSdkFeature[] = ["liveEvents"];
            if (this.deps.services().hostedSessionService?.isEnabled()) {
                supportedFeatures.unshift("hostedSessions");
            }
            this.sendFrame(ws, {
                kind: "authOk",
                server: this.options.serverName ?? "xrsps",
                version: PROTOCOL_VERSION,
                features: supportedFeatures,
            });
            return;
        }

        // Post-auth flow.
        switch (frame.kind) {
            case "auth":
                // Re-auth attempt — ignore silently.
                return;
            case "spawn":
                this.handleSpawn(ws, state, frame);
                return;
            case "action":
                this.handleAction(ws, state, frame);
                return;
            case "disconnect":
                logger.info(
                    `[botsdk] client requested disconnect: ${frame.reason ?? "(no reason)"}`,
                );
                ws.close(1000, frame.reason ?? "client_disconnect");
                return;
        }
    }

    private handleSpawn(
        ws: WebSocket,
        state: { authed: boolean; session?: AgentSession; features: Set<BotSdkFeature> },
        frame: SpawnFrame,
    ): void {
        if (state.session) {
            this.sendError(
                ws,
                "already_spawned",
                `agent ${state.session.player.agent?.identity.agentId} already owns this socket`,
            );
            return;
        }

        if (frame.worldId && frame.worldId !== this.deps.services().worldId) {
            this.sendError(
                ws,
                "bad_world",
                `spawn worldId="${frame.worldId}" does not match server world "${this.deps.services().worldId}"`,
            );
            return;
        }

        const result = this.deps.factory.spawn({
            agentId: frame.agentId,
            displayName: frame.displayName,
            password: frame.password,
            sessionToken: frame.sessionToken,
            worldCharacterId: frame.worldCharacterId,
            controller: frame.controller ?? "hybrid",
            persona: frame.persona,
        });
        if (!result.ok) {
            this.sendError(ws, result.code, result.message);
            return;
        }

        const session: AgentSession = {
            ws,
            player: result.player,
            authedAt: Date.now(),
            saveKey: result.saveKey,
            features: new Set(state.features),
        };
        state.session = session;
        this.sessions.set(ws, session);

        if (result.created) {
            logger.info(
                `[botsdk] new agent account registered: ${result.player.name}`,
            );
        }

        this.sendFrame(ws, {
            kind: "spawnOk",
            playerId: result.player.id,
            x: result.player.tileX,
            z: result.player.tileY,
            level: result.player.level,
        });
    }

    private handleAction(
        ws: WebSocket,
        state: { authed: boolean; session?: AgentSession },
        frame: AnyActionFrame,
    ): void {
        if (!state.session) {
            this.sendError(
                ws,
                "not_spawned",
                "must send `spawn` frame before `action`",
            );
            return;
        }

        this.trajectoryRecorder?.recordActionDispatch(state.session.player, frame);
        const dispatch: ActionDispatchResult = this.deps.router.dispatch(
            state.session.player.id,
            frame,
        );
        this.trajectoryRecorder?.recordActionAck(state.session.player, frame, dispatch);

        if (frame.correlationId) {
            this.sendFrame(ws, {
                kind: "ack",
                correlationId: frame.correlationId,
                success: dispatch.success,
                message: dispatch.message,
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private isKnownFeature(value: string): value is BotSdkFeature {
        return value === "hostedSessions" || value === "liveEvents";
    }

    private sendFrame(ws: WebSocket, frame: ServerFrame): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(encodeServerFrame(frame));
        } catch (err) {
            logger.warn("[botsdk] failed to send frame:", err);
        }
    }

    private sendError(ws: WebSocket, code: string, message: string): void {
        this.sendFrame(ws, { kind: "error", code, message });
    }

    private *iterAgentPlayers(): Iterable<PlayerState> {
        for (const session of this.sessions.values()) {
            if (session.player.agent?.connected) {
                yield session.player;
            }
        }
    }

    private findSessionByPlayer(player: PlayerState): AgentSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.player.id === player.id) return session;
        }
        return undefined;
    }
}
